import type { Beat } from '@/shared/types'
import type { BeatPosition } from './timing'

export type Unsubscribe = () => void

/**
 * The music player contract. Everything timed to the beat (writing board's beat-per-line,
 * robot, soundboard, karaoke, export) reads time from here, never from its own timers.
 *
 * Use the shared instance from `@/shared/audio` (or `useBeatClock()` in components).
 * Today it is a timer-based stub; the Web Audio version replaces it behind this interface.
 */
export interface BeatClock {
  readonly beat: Beat | null
  readonly isPlaying: boolean
  /** Track length in seconds, 0 when nothing is loaded. */
  readonly duration: number
  readonly volume: number
  readonly rate: number

  load(beat: Beat): Promise<void>
  /** Call from a click handler: browsers block audio started without a user gesture. */
  play(): Promise<void>
  pause(): void
  /** Pause and return to 0. */
  stop(): void
  /** Jump to an absolute track time in seconds (clamped to the track). */
  seek(seconds: number): void
  /** Jump relative to now, e.g. `skip(-5)` for the ±2/5/10 s buttons. */
  skip(deltaSeconds: number): void
  /** 0..1 */
  setVolume(volume: number): void
  /** 0.5..2. In the Web Audio player this also shifts pitch. */
  setRate(rate: number): void

  /** Track time in seconds. Cheap; fine to poll every animation frame. */
  currentTime(): number
  position(): BeatPosition

  /**
   * Web Audio scheduling hooks for the robot and recordings. `null` on the stub.
   * `contextTimeAt(t)` is the AudioContext time at which track time `t` plays, or null
   * while paused.
   */
  readonly audioContext: AudioContext | null
  readonly output: AudioNode | null
  contextTimeAt(trackSeconds: number): number | null

  /** Fires when a new beat starts. */
  onBeat(cb: (pos: BeatPosition) => void): Unsubscribe
  /** Fires when a new bar starts (together with that bar's first onBeat). */
  onBar(cb: (pos: BeatPosition) => void): Unsubscribe
  /** Fires on load, play, pause, stop, seek, end, volume and rate changes. */
  onStateChange(cb: () => void): Unsubscribe
}
