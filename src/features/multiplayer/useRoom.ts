import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Room, RoomLine, RoomPlayer } from '@/shared/types'
import {
  MAX_PLAYERS,
  clearLines,
  createRoom,
  ensureUser,
  fetchRoom,
  joinRoom,
  leaveRoom,
  submitLine,
  updateRoom,
  watchRoom,
  type RoomChannel,
  type RoomPatch,
} from './roomApi'

const SAVED_CODE = 'rapkrazy-room'
const MAX_LINES = 16
/** The host waits this long past the deadline so a last-second submit still lands. */
const GRACE_MS = 1500
/** Used when a player runs out of time. */
const FILLERS = [
  '(the mic cut out, the crowd went wild)',
  '(a mysterious beat drop fills the gap)',
  '(this player is still thinking)',
  '(silence, but make it cool)',
  '(the robot hums along instead)',
]
/** A player missing from presence this long is treated as gone; the referee skips their turn. */
const ABSENT_MS = 4000

/**
 * Collab game state for one browser. The host's browser is the referee: it moves turns on, fills in
 * for players who run out of time, and starts the reveal. Everyone else just reads the room.
 */
export function useRoom() {
  const me = ref('')
  const code = ref('')
  const room = ref<Room | null>(null)
  const players = ref<RoomPlayer[]>([])
  const lines = ref<RoomLine[]>([])
  const error = ref('')
  const busy = ref(false)
  const now = ref(Date.now())

  /** Players connected right now (Realtime presence); null until the first presence sync. */
  const online = ref<Set<string> | null>(null)
  /** Reveal 🔥 votes: voter id -> line index. Sent as broadcasts, not saved. */
  const votes = ref<Record<string, number>>({})

  let channel: RoomChannel | null = null
  let watchedAt = 0
  let poll: ReturnType<typeof setInterval> | undefined
  let tick: ReturnType<typeof setInterval> | undefined
  let refreshing = false
  let again = false
  /** Turn the referee already acted on, so one change does not fire twice. */
  let handled = ''

  const phase = computed<'home' | 'lobby' | 'writing' | 'reveal'>(
    () => room.value?.status ?? 'home',
  )
  const isHost = computed(() => !!room.value && room.value.hostId === me.value)
  const seated = computed(() => players.value.find((p) => p.id === me.value))
  const nameOf = (id: string) => players.value.find((p) => p.id === id)?.name ?? 'Someone'
  const seatsFull = computed(() => players.value.length >= MAX_PLAYERS)

  /*
   * Turn order is the seat order, and seats don't change during a game: nobody is removed from the
   * room mid-game (see onBeforeUnmount), so turns can't shift onto the wrong player. Someone who
   * leaves keeps their seat and the referee skips their turns.
   */
  const writerAt = (turn: number) => {
    const r = room.value
    if (!r || r.status !== 'writing' || !players.value.length || turn >= r.totalTurns) return null
    return players.value[turn % players.value.length] ?? null
  }
  const writer = computed(() => writerAt(room.value?.turnIndex ?? 0))
  /** Who writes after the current turn, for the "next up" badge. Null on the last turn. */
  const nextWriter = computed(() => writerAt((room.value?.turnIndex ?? 0) + 1))
  const isMyTurn = computed(() => writer.value?.id === me.value)

  /** False only once presence has had time to sync and the player isn't connected. */
  function isPresent(id: string) {
    if (!online.value || Date.now() - watchedAt < ABSENT_MS) return true
    return online.value.has(id)
  }
  /** Only the line right before this turn is ever shown while writing. */
  const previousLine = computed(() => {
    const r = room.value
    if (!r) return null
    return lines.value.find((l) => l.turnIndex === r.turnIndex - 1) ?? null
  })
  const alreadyWrote = computed(
    () => !!room.value && lines.value.some((l) => l.turnIndex === room.value!.turnIndex),
  )
  const secondsLeft = computed(() => {
    const d = room.value?.turnDeadline
    return d ? Math.max(0, Math.ceil((d - now.value) / 1000)) : 0
  })

  async function refresh() {
    if (!code.value) return
    if (refreshing) {
      again = true
      return
    }
    refreshing = true
    try {
      const snap = await fetchRoom(code.value)
      if (!snap || !snap.players.some((p) => p.id === me.value)) {
        reset()
        return
      }
      room.value = snap.room
      players.value = snap.players
      lines.value = snap.lines
      void referee()
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      refreshing = false
      if (again) {
        again = false
        void refresh()
      }
    }
  }

  /** Host-only: move turns on. Safe to call often. */
  async function referee() {
    const r = room.value
    if (!r) return
    if (!isHost.value) return handoff()
    if (r.status !== 'writing') return
    const key = `${r.code}:${r.turnIndex}:${alreadyWrote.value}`
    if (key === handled) return
    try {
      if (alreadyWrote.value) {
        handled = key
        const next = r.turnIndex + 1
        const patch: RoomPatch =
          next >= r.totalTurns
            ? { status: 'reveal', turnDeadline: null }
            : { turnIndex: next, turnDeadline: Date.now() + r.turnSeconds * 1000 }
        await updateRoom(r.code, patch, r.turnIndex)
      } else if (writer.value && r.turnDeadline) {
        const turnStart = r.turnDeadline - r.turnSeconds * 1000
        const timedOut = Date.now() > r.turnDeadline + GRACE_MS
        // A writer who left the game gets skipped after a short wait instead of the whole timer.
        const gone = !isPresent(writer.value.id) && Date.now() > turnStart + ABSENT_MS
        if (!timedOut && !gone) return
        handled = key
        const text = gone
          ? `(${writer.value.name} left the booth)`
          : FILLERS[r.turnIndex % FILLERS.length]!
        await submitLine(r.code, { turnIndex: r.turnIndex, playerId: writer.value.id, text })
      }
    } catch (e) {
      handled = ''
      error.value = (e as Error).message
    }
  }

  /**
   * If the host left (removed, or still seated but disconnected), the lowest connected seat takes
   * over as referee so the game keeps moving.
   */
  async function handoff() {
    const r = room.value
    if (!r) return
    const hostHere = players.value.some((p) => p.id === r.hostId) && isPresent(r.hostId)
    if (hostHere) return
    if (players.value.find((p) => isPresent(p.id))?.id !== me.value) return
    try {
      await updateRoom(r.code, { hostId: me.value })
    } catch (e) {
      error.value = (e as Error).message
    }
  }

  async function enter(c: string) {
    code.value = c
    try {
      sessionStorage.setItem(SAVED_CODE, c)
    } catch {
      /* private mode: rejoin after refresh just will not work */
    }
    channel?.close()
    online.value = null
    watchedAt = Date.now()
    channel = watchRoom(c, {
      me: me.value,
      onChange: () => void refresh(),
      onPresence: (ids) => (online.value = new Set(ids)),
      onMessage,
    })
    clearInterval(poll)
    poll = setInterval(() => void refresh(), 3000)
    clearInterval(tick)
    tick = setInterval(() => {
      now.value = Date.now()
      void referee()
    }, 500)
    await refresh()
  }

  /* 🔥 votes at the reveal. One vote per player (the latest counts). A player who arrives late
     says hello and everyone re-sends their vote. */
  function onMessage(event: string, payload: Record<string, unknown>) {
    if (event === 'fire' && typeof payload.voter === 'string' && typeof payload.line === 'number') {
      votes.value = { ...votes.value, [payload.voter]: payload.line }
    } else if (event === 'fire-hello') {
      const mine = votes.value[me.value]
      if (mine !== undefined) channel?.send('fire', { voter: me.value, line: mine })
    }
  }
  function vote(line: number) {
    votes.value = { ...votes.value, [me.value]: line }
    channel?.send('fire', { voter: me.value, line })
  }
  watch(phase, (p) => {
    if (p === 'reveal') channel?.send('fire-hello', {})
    else votes.value = {}
  })

  function reset() {
    channel?.close()
    channel = null
    online.value = null
    votes.value = {}
    clearInterval(poll)
    clearInterval(tick)
    code.value = ''
    room.value = null
    players.value = []
    lines.value = []
    handled = ''
    try {
      sessionStorage.removeItem(SAVED_CODE)
    } catch {
      /* nothing to clear */
    }
  }

  async function run(fn: () => Promise<void>) {
    busy.value = true
    error.value = ''
    try {
      await fn()
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      busy.value = false
    }
  }

  const host = (name: string) =>
    run(async () => {
      me.value = await ensureUser()
      await enter(await createRoom(name))
    })

  const join = (c: string, name: string) =>
    run(async () => {
      me.value = await ensureUser()
      await enter(await joinRoom(c, name))
    })

  /** Pick the room back up after a page refresh. */
  async function resume() {
    let saved: string | null = null
    try {
      saved = sessionStorage.getItem(SAVED_CODE)
    } catch {
      /* ignore */
    }
    if (!saved) return
    await run(async () => {
      me.value = await ensureUser()
      await enter(saved!)
    })
  }

  const leave = () =>
    run(async () => {
      const c = code.value
      reset()
      if (c && me.value) await leaveRoom(c, me.value)
    })

  const setBeat = (beatId: string) => run(() => updateRoom(code.value, { beatId }))
  const setSettings = (patch: { turnSeconds?: number; rounds?: number }) =>
    run(() => updateRoom(code.value, patch))

  /** `beatBars` caps the song length so every line lands on a bar of the chosen beat. */
  const start = (beatBars: number) =>
    run(async () => {
      const r = room.value
      if (!r || !r.beatId || players.value.length < 2) return
      await clearLines(r.code)
      const total = Math.min(players.value.length * r.rounds, beatBars, MAX_LINES)
      handled = ''
      await updateRoom(r.code, {
        status: 'writing',
        turnIndex: 0,
        totalTurns: total,
        turnDeadline: Date.now() + r.turnSeconds * 1000,
      })
    })

  const submit = (text: string) =>
    run(async () => {
      const r = room.value
      const clean = text.trim()
      if (!r || !clean || !isMyTurn.value || alreadyWrote.value) return
      await submitLine(r.code, { turnIndex: r.turnIndex, playerId: me.value, text: clean })
      await refresh()
    })

  const playAgain = () =>
    run(async () => {
      await clearLines(code.value)
      handled = ''
      await updateRoom(code.value, { status: 'lobby', turnIndex: 0, turnDeadline: null })
    })

  /*
   * Leaving the page through the app (back to the menu, another page) leaves the lobby too, so the next
   * visit to Collab starts at the host / join screen. A browser refresh does not run this, which is
   * what lets resume() put you back in your lobby. Mid-game the seat is kept so the turn order
   * doesn't shift; presence tells the others you're gone and your turns get skipped.
   */
  onBeforeUnmount(() => {
    const c = code.value
    if (c && me.value && phase.value !== 'writing') void leaveRoom(c, me.value)
    reset()
  })

  return {
    me,
    code,
    room,
    players,
    lines,
    error,
    busy,
    phase,
    isHost,
    seated,
    seatsFull,
    writer,
    nextWriter,
    isMyTurn,
    online,
    votes,
    vote,
    previousLine,
    alreadyWrote,
    secondsLeft,
    nameOf,
    host,
    join,
    resume,
    leave,
    setBeat,
    setSettings,
    start,
    submit,
    playAgain,
  }
}
