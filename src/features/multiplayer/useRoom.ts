import { computed, onBeforeUnmount, ref } from 'vue'
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

  let unwatch: (() => void) | null = null
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

  const writer = computed(() => {
    const r = room.value
    if (!r || r.status !== 'writing' || !players.value.length) return null
    return players.value[r.turnIndex % players.value.length] ?? null
  })
  const isMyTurn = computed(() => writer.value?.id === me.value)
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
      } else if (r.turnDeadline && Date.now() > r.turnDeadline + GRACE_MS && writer.value) {
        handled = key
        const text = FILLERS[r.turnIndex % FILLERS.length]!
        await submitLine(r.code, { turnIndex: r.turnIndex, playerId: writer.value.id, text })
      }
    } catch (e) {
      handled = ''
      error.value = (e as Error).message
    }
  }

  /** If the host left, the lowest seat takes over so the game keeps moving. */
  async function handoff() {
    const r = room.value
    if (!r || players.value.some((p) => p.id === r.hostId)) return
    if (players.value[0]?.id !== me.value) return
    try {
      await updateRoom(r.code, { hostId: me.value })
    } catch (e) {
      error.value = (e as Error).message
    }
  }

  async function enter(c: string) {
    code.value = c
    try {
      localStorage.setItem(SAVED_CODE, c)
    } catch {
      /* private mode: rejoin after refresh just will not work */
    }
    unwatch?.()
    unwatch = watchRoom(c, () => void refresh())
    clearInterval(poll)
    poll = setInterval(() => void refresh(), 3000)
    clearInterval(tick)
    tick = setInterval(() => {
      now.value = Date.now()
      void referee()
    }, 500)
    await refresh()
  }

  function reset() {
    unwatch?.()
    unwatch = null
    clearInterval(poll)
    clearInterval(tick)
    code.value = ''
    room.value = null
    players.value = []
    lines.value = []
    handled = ''
    try {
      localStorage.removeItem(SAVED_CODE)
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
      saved = localStorage.getItem(SAVED_CODE)
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

  onBeforeUnmount(() => {
    unwatch?.()
    clearInterval(poll)
    clearInterval(tick)
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
    isMyTurn,
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
