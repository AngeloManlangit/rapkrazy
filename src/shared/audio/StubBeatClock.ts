import type { Beat } from '@/shared/types'
import type { BeatClock, Unsubscribe } from './BeatClock'
import { positionAt, trackDuration, type BeatPosition } from './timing'

const TICK_MS = 10

/**
 * Silent, timer-driven BeatClock. Counts bars and beats from the beat's metadata without
 * loading audio, so features can be built before the real player lands. Timing is only
 * approximate (setInterval jitter); do not use it to judge sync.
 */
export class StubBeatClock implements BeatClock {
  beat: Beat | null = null
  isPlaying = false
  duration = 0
  volume = 1
  rate = 1
  readonly audioContext = null
  readonly output = null

  /** Track time at the moment playback last (re)started or was moved. */
  private anchorTrackTime = 0
  /** performance.now() at that moment. */
  private anchorWallTime = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private lastBeatIndex = -1

  private beatListeners = new Set<(pos: BeatPosition) => void>()
  private barListeners = new Set<(pos: BeatPosition) => void>()
  private stateListeners = new Set<() => void>()

  async load(beat: Beat): Promise<void> {
    this.stop()
    this.beat = beat
    this.duration = trackDuration(beat)
    this.emitState()
  }

  async play(): Promise<void> {
    if (!this.beat || this.isPlaying) return
    if (this.anchorTrackTime >= this.duration) this.anchorTrackTime = 0
    this.anchorWallTime = performance.now()
    this.isPlaying = true
    this.timer = setInterval(() => this.tick(), TICK_MS)
    this.emitState()
  }

  pause(): void {
    if (!this.isPlaying) return
    this.anchorTrackTime = this.currentTime()
    this.isPlaying = false
    this.clearTimer()
    this.emitState()
  }

  stop(): void {
    this.isPlaying = false
    this.clearTimer()
    this.anchorTrackTime = 0
    this.lastBeatIndex = -1
    this.emitState()
  }

  seek(seconds: number): void {
    this.anchorTrackTime = Math.min(Math.max(seconds, 0), this.duration)
    this.anchorWallTime = performance.now()
    this.lastBeatIndex = -1
    this.emitState()
  }

  skip(deltaSeconds: number): void {
    this.seek(this.currentTime() + deltaSeconds)
  }

  setVolume(volume: number): void {
    this.volume = Math.min(Math.max(volume, 0), 1)
    this.emitState()
  }

  setRate(rate: number): void {
    // Re-anchor so the change applies from now, not retroactively.
    this.anchorTrackTime = this.currentTime()
    this.anchorWallTime = performance.now()
    this.rate = Math.min(Math.max(rate, 0.5), 2)
    this.emitState()
  }

  currentTime(): number {
    if (!this.isPlaying) return this.anchorTrackTime
    const elapsed = ((performance.now() - this.anchorWallTime) / 1000) * this.rate
    return Math.min(this.anchorTrackTime + elapsed, this.duration)
  }

  position(): BeatPosition {
    const time = this.currentTime()
    return this.beat ? positionAt(this.beat, time) : { bar: -1, beat: -1, time }
  }

  contextTimeAt(): number | null {
    return null
  }

  onBeat(cb: (pos: BeatPosition) => void): Unsubscribe {
    this.beatListeners.add(cb)
    return () => this.beatListeners.delete(cb)
  }

  onBar(cb: (pos: BeatPosition) => void): Unsubscribe {
    this.barListeners.add(cb)
    return () => this.barListeners.delete(cb)
  }

  onStateChange(cb: () => void): Unsubscribe {
    this.stateListeners.add(cb)
    return () => this.stateListeners.delete(cb)
  }

  private tick(): void {
    if (!this.beat) return
    const pos = this.position()
    if (pos.bar >= 0) {
      const beatIndex = pos.bar * this.beat.beatsPerBar + pos.beat
      if (beatIndex !== this.lastBeatIndex) {
        this.lastBeatIndex = beatIndex
        if (pos.beat === 0) this.barListeners.forEach((cb) => cb(pos))
        this.beatListeners.forEach((cb) => cb(pos))
      }
    }
    if (pos.time >= this.duration) {
      this.anchorTrackTime = this.duration
      this.isPlaying = false
      this.clearTimer()
      this.emitState()
    }
  }

  private clearTimer(): void {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
  }

  private emitState(): void {
    this.stateListeners.forEach((cb) => cb())
  }
}
