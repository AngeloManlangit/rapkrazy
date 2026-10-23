import { computed, onBeforeUnmount, ref } from 'vue'
import type { DuelResult, DuelWord, Room, RoomLine, RoomMode, RoomPlayer } from '@/shared/types'
import { FALLBACK_WORDS, PRE_RAP_SECONDS, WORDS_SECONDS } from './duel/constants'
import {
  MAX_PLAYERS,
  clearDuel,
  clearLines,
  createRoom,
  ensureUser,
  fetchRoom,
  joinRoom,
  leaveRoom,
  submitLine,
  submitResult,
  submitWords,
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
  const words = ref<DuelWord[]>([])
  const results = ref<DuelResult[]>([])
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

  const phase = computed<'home' | Room['status']>(() => room.value?.status ?? 'home')
  const isHost = computed(() => !!room.value && room.value.hostId === me.value)
  const seated = computed(() => players.value.find((p) => p.id === me.value))
  const nameOf = (id: string) => players.value.find((p) => p.id === id)?.name ?? 'Someone'
  const maxPlayers = computed(() => (room.value?.mode === 'duel' ? 2 : MAX_PLAYERS))
  const seatsFull = computed(() => players.value.length >= maxPlayers.value)

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

  /* Rhyme Duel: each player raps the 4 words the other one wrote. */
  const opponent = computed(() => players.value.find((p) => p.id !== me.value) ?? null)
  const wordsOf = (id: string) =>
    words.value
      .filter((w) => w.playerId === id)
      .sort((a, b) => a.position - b.position)
      .map((w) => w.word)
  const myWordsDone = computed(() => wordsOf(me.value).length >= 4)
  const myTargets = computed(() => (opponent.value ? wordsOf(opponent.value.id) : []))
  const myResult = computed(() => results.value.find((r) => r.playerId === me.value) ?? null)

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
      words.value = snap.words
      results.value = snap.results
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
    if (r.mode === 'duel') return duelReferee(r)
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

  /** Host-only, Rhyme Duel: move on once both players have handed in their words, then their raps. */
  async function duelReferee(r: Room) {
    const need = players.value.length * r.lineCount
    let patch: RoomPatch | null = null
    let key = `${r.code}:${r.status}`

    if (r.status === 'words') {
      if (players.value.length === 2 && words.value.length >= need) {
        // Both locked in: a short countdown, then the rap starts on both screens.
        patch = { status: 'rap', turnDeadline: Date.now() + PRE_RAP_SECONDS * 1000 }
      } else if (r.turnDeadline && Date.now() > r.turnDeadline + GRACE_MS) {
        // Time is up. Fill in for anyone who has not handed in their words.
        key += ':fill'
        if (key === handled) return
        handled = key
        try {
          for (const p of players.value) {
            if (wordsOf(p.id).length < r.lineCount) {
              await submitWords(r.code, p.id, FALLBACK_WORDS.slice(0, r.lineCount))
            }
          }
        } catch (e) {
          handled = ''
          error.value = (e as Error).message
        }
        return
      }
    }
    if (r.status === 'rap' && results.value.length >= players.value.length) {
      patch = { status: 'results', turnDeadline: null }
    }
    if (!patch || key === handled) return
    handled = key
    try {
      await updateRoom(r.code, patch)
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
      sessionStorage.setItem(SAVED_CODE, c)
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
    words.value = []
    results.value = []
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
      const c = await createRoom(name)
      // Rhyme Duel is the only mode for now (Write together is hidden). New rooms start as 'write' in the database.
      await updateRoom(c, { mode: 'duel' })
      await enter(c)
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
  const setSettings = (patch: { turnSeconds?: number; rounds?: number; lineCount?: number }) =>
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

  const setMode = (mode: RoomMode) => run(() => updateRoom(code.value, { mode }))

  /** Rhyme Duel needs exactly 2 players and a beat with room for a count-in plus 4 bars. */
  const startDuel = (beatBars: number) =>
    run(async () => {
      const r = room.value
      if (!r || !r.beatId || players.value.length !== 2) return
      if (beatBars < r.lineCount + 1) {
        throw new Error(
          `That beat is too short for ${r.lineCount} lines. Pick a longer beat or fewer lines.`,
        )
      }
      await clearDuel(r.code)
      handled = ''
      await updateRoom(r.code, {
        status: 'words',
        turnDeadline: Date.now() + WORDS_SECONDS * 1000,
      })
    })

  const submitMyWords = (list: string[]) =>
    run(async () => {
      if (!code.value || list.length !== (room.value?.lineCount ?? 4)) return
      await submitWords(code.value, me.value, list)
      await refresh()
    })

  /** Not wrapped in run(): the rap screen shows its own busy and error states. */
  async function submitMyResult(result: DuelResult) {
    await submitResult(code.value, result)
    await refresh()
  }

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
      await clearDuel(code.value)
      handled = ''
      await updateRoom(code.value, { status: 'lobby', turnIndex: 0, turnDeadline: null })
    })

  /*
   * Leaving the page through the app (back to the menu, another page) leaves the lobby too, so the next
   * visit to Collab starts at the host / join screen. A browser refresh does not run this, which is
   * what lets resume() put you back in your lobby.
   */
  onBeforeUnmount(() => {
    const c = code.value
    if (c && me.value) void leaveRoom(c, me.value)
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
    maxPlayers,
    words,
    results,
    opponent,
    myWordsDone,
    myTargets,
    myResult,
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
    setMode,
    start,
    startDuel,
    submitMyWords,
    submitMyResult,
    submit,
    playAgain,
  }
}
