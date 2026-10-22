/**
 * Shared data contracts. Every feature builds against these, so changes need a heads-up
 * in the group chat and a small PR of their own. Keep this file free of runtime code.
 */

/** An instrumental beat. Listed in `public/beats/beats.json`. */
export interface Beat {
  id: string
  title: string
  creator: string
  /** Path from the site root, e.g. `/beats/princess-lullaby.mp3`. */
  file: string
  bpm: number
  /** Usually 4. */
  beatsPerBar: number
  /** Silence before beat 1 of bar 0, in milliseconds. */
  offsetMs: number
  /** Number of bars in the track (after the offset). */
  totalBars: number
  /** Short mood tag shown in the catalog, e.g. "lullaby", "boss fight". */
  vibe?: string
  coverArt?: string
}

/** One line of lyrics, anchored to the beat by bar number. */
export interface LyricLine {
  id: string
  text: string
  /** 0-based bar where the line starts. */
  bar: number
  /** How many bars the line spans. Default 1. */
  bars: number
  /** Player who wrote the line (multiplayer only). */
  authorId?: string
}

/** A song in progress: one beat plus the lyrics written over it. */
export interface Song {
  id: string
  title: string
  beatId: string
  lines: LyricLine[]
  createdAt: string
}

/* ---------- Mad Libs templates (template-gen owner may refine) ---------- */

export type BlankKind = 'noun' | 'verb' | 'adjective' | 'place' | 'name' | 'any'

export type TemplateToken =
  { type: 'text'; text: string } | { type: 'blank'; kind: BlankKind; value?: string }

/** A lyric line with blanks for the player to fill in. Becomes a `LyricLine` once filled. */
export interface TemplateLine {
  bar: number
  bars: number
  tokens: TemplateToken[]
}

/* ---------- Multiplayer (multiplayer owner may refine) ---------- */

export interface Player {
  id: string
  name: string
  avatar?: string
}

/** One player's turn. v1 is writing-only; `clipPath` is for the later singing mode. */
export interface Verse {
  id: string
  playerId: string
  turnIndex: number
  lines: LyricLine[]
  /** Set when the player recorded themselves; absent means the robot sings it. */
  clipPath?: string
  latencyMs?: number
}

// --- AI Writer ---

/** What the player fills in before generating. */
export interface WriterInputs {
  subject: string // a noun: "crown", "night bus"
  action: string // a verb: "climb", "outrun"
  adjective: string // "golden", "restless"
  topic: string // what the song is about
}

/** What comes back. `lines` maps 1:1 to bars on the writing board. */
export interface GeneratedLyrics {
  title: string
  lines: string[]
  fallback?: boolean
}

export type WriterStatus = 'form' | 'loading' | 'result' | 'error'
