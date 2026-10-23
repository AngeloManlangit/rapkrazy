import { supabase } from '@/shared/SupabaseClient'
import type { DuelResult, DuelWord, Room, RoomLine, RoomMode, RoomPlayer } from '@/shared/types'

export const MAX_PLAYERS = 5

/** Where Supabase is not set up, the Collab page shows a card instead of the lobby. */
export const hasBackend = supabase !== null

function db() {
  if (!supabase) throw new Error('Multiplayer needs Supabase keys in .env')
  return supabase
}

/** Anonymous sign-in: each browser gets a temporary player id that lasts until storage is cleared. */
export async function ensureUser(): Promise<string> {
  const { data } = await db().auth.getSession()
  if (data.session) return data.session.user.id
  const { data: signed, error } = await db().auth.signInAnonymously()
  if (error || !signed.user) {
    throw new Error('Could not sign in. Turn on Anonymous sign-ins in Supabase.')
  }
  return signed.user.id
}

export async function createRoom(name: string, turnSeconds = 45, rounds = 2): Promise<string> {
  await ensureUser()
  const { data, error } = await db().rpc('create_room', {
    p_name: name,
    p_turn_seconds: turnSeconds,
    p_rounds: rounds,
  })
  if (error) throw new Error(error.message)
  return data as string
}

export async function joinRoom(code: string, name: string): Promise<string> {
  await ensureUser()
  const clean = code.trim().toUpperCase()
  const { error } = await db().rpc('join_room', { p_code: clean, p_name: name })
  if (error) throw new Error(error.message)
  return clean
}

export async function leaveRoom(code: string, playerId: string): Promise<void> {
  await db().from('room_players').delete().eq('room_code', code).eq('player_id', playerId)
}

interface RoomRow {
  code: string
  host_id: string
  beat_id: string | null
  mode: RoomMode
  status: Room['status']
  turn_index: number
  total_turns: number
  turn_seconds: number
  rounds: number
  line_count: number
  turn_deadline: string | null
}

const toRoom = (r: RoomRow): Room => ({
  code: r.code,
  hostId: r.host_id,
  beatId: r.beat_id,
  mode: r.mode,
  status: r.status,
  turnIndex: r.turn_index,
  totalTurns: r.total_turns,
  turnSeconds: r.turn_seconds,
  rounds: r.rounds,
  lineCount: r.line_count,
  turnDeadline: r.turn_deadline ? Date.parse(r.turn_deadline) : null,
})

export interface RoomSnapshot {
  room: Room
  players: RoomPlayer[]
  lines: RoomLine[]
  words: DuelWord[]
  results: DuelResult[]
}

/** Everything the screens need, in one go. Null when the room is gone or we are not seated. */
export async function fetchRoom(code: string): Promise<RoomSnapshot | null> {
  const [room, players, lines, words, results] = await Promise.all([
    db().from('rooms').select('*').eq('code', code).maybeSingle(),
    db().from('room_players').select('player_id, name, seat').eq('room_code', code).order('seat'),
    db()
      .from('room_lines')
      .select('turn_index, player_id, text')
      .eq('room_code', code)
      .order('turn_index'),
    db().from('duel_words').select('player_id, position, word').eq('room_code', code),
    db().from('duel_results').select('player_id, lines, score').eq('room_code', code),
  ])
  if (room.error) throw new Error(room.error.message)
  if (!room.data) return null
  return {
    room: toRoom(room.data as RoomRow),
    players: (players.data ?? []).map((p) => ({ id: p.player_id, name: p.name, seat: p.seat })),
    lines: (lines.data ?? []).map((l) => ({
      turnIndex: l.turn_index,
      playerId: l.player_id,
      text: l.text,
    })),
    words: (words.data ?? []).map((w) => ({
      playerId: w.player_id,
      position: w.position,
      word: w.word,
    })),
    results: (results.data ?? []).map((r) => ({
      playerId: r.player_id,
      lines: r.lines,
      score: Number(r.score),
    })),
  }
}

export interface RoomPatch {
  beatId?: string | null
  mode?: RoomMode
  status?: Room['status']
  turnIndex?: number
  totalTurns?: number
  turnSeconds?: number
  rounds?: number
  lineCount?: number
  turnDeadline?: number | null
  hostId?: string
}

/** `onlyIfTurn` makes the update a no-op when another client already moved the turn on. */
export async function updateRoom(
  code: string,
  patch: RoomPatch,
  onlyIfTurn?: number,
): Promise<void> {
  const row: Record<string, unknown> = {}
  if (patch.beatId !== undefined) row.beat_id = patch.beatId
  if (patch.mode !== undefined) row.mode = patch.mode
  if (patch.status !== undefined) row.status = patch.status
  if (patch.turnIndex !== undefined) row.turn_index = patch.turnIndex
  if (patch.totalTurns !== undefined) row.total_turns = patch.totalTurns
  if (patch.turnSeconds !== undefined) row.turn_seconds = patch.turnSeconds
  if (patch.rounds !== undefined) row.rounds = patch.rounds
  if (patch.lineCount !== undefined) row.line_count = patch.lineCount
  if (patch.turnDeadline !== undefined) {
    row.turn_deadline =
      patch.turnDeadline === null ? null : new Date(patch.turnDeadline).toISOString()
  }
  if (patch.hostId !== undefined) row.host_id = patch.hostId
  let q = db().from('rooms').update(row).eq('code', code)
  if (onlyIfTurn !== undefined) q = q.eq('turn_index', onlyIfTurn)
  const { error } = await q
  if (error) throw new Error(error.message)
}

/** Duplicate turns (double click, or host filler racing the writer) are ignored. */
export async function submitLine(code: string, line: RoomLine): Promise<void> {
  const { error } = await db().from('room_lines').insert({
    room_code: code,
    turn_index: line.turnIndex,
    player_id: line.playerId,
    text: line.text,
  })
  if (error && error.code !== '23505') throw new Error(error.message)
}

export async function clearLines(code: string): Promise<void> {
  const { error } = await db().from('room_lines').delete().eq('room_code', code)
  if (error) throw new Error(error.message)
}

/** Live updates for one room. Calls `onChange` for any change; the caller refetches. */
export function watchRoom(code: string, onChange: () => void): () => void {
  const channel = db()
    .channel(`room:${code}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rooms', filter: `code=eq.${code}` },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'room_players', filter: `room_code=eq.${code}` },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'room_lines', filter: `room_code=eq.${code}` },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'duel_words', filter: `room_code=eq.${code}` },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'duel_results', filter: `room_code=eq.${code}` },
      onChange,
    )
    .subscribe()
  return () => {
    void db().removeChannel(channel)
  }
}

/** The 4 ending words one player wrote for their opponent. Repeats are ignored. */
export async function submitWords(code: string, playerId: string, words: string[]): Promise<void> {
  const rows = words.map((word, position) => ({
    room_code: code,
    player_id: playerId,
    position,
    word,
  }))
  const { error } = await db().from('duel_words').insert(rows)
  if (error && error.code !== '23505') throw new Error(error.message)
}

export async function submitResult(code: string, result: DuelResult): Promise<void> {
  const { error } = await db().from('duel_results').insert({
    room_code: code,
    player_id: result.playerId,
    lines: result.lines,
    score: result.score,
  })
  if (error && error.code !== '23505') throw new Error(error.message)
}

export async function clearDuel(code: string): Promise<void> {
  const words = await db().from('duel_words').delete().eq('room_code', code)
  if (words.error) throw new Error(words.error.message)
  const results = await db().from('duel_results').delete().eq('room_code', code)
  if (results.error) throw new Error(results.error.message)
}
