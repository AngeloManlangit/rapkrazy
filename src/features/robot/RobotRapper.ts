import { beatClock, type BeatClock, type RobotVoice, type Unsubscribe } from '@/shared/audio'
import type { LyricLine } from '@/shared/types'
import { planLine, planWholeLine, type RapChunk } from './rapPlan'

export interface RapperOptions {
  voice?: string
  speed?: number
  pitch?: number
  /** 1: at most one chunk per beat; 2: eighth notes. */
  slotsPerBeat?: number
  /** Speed up chunks that would spill into the next slot (capped at 2x). */
  squeeze?: boolean
  /** Speak each line as one chunk instead of splitting it on the beat. */
  wholeLines?: boolean
}

/** How far ahead chunks are booked. Covers background tabs, where timers fire about once a second. */
const LOOKAHEAD = 1.5
const TICK_MS = 100
/** A chunk whose start is less than this far in the past still plays (starts immediately). */
const LATE_TOLERANCE = 0.05

/**
 * Makes the robot rap `lines` in sync with the shared beat clock. Whenever the clock plays, the
 * robot plays along from wherever the track is; pause, seek and speed changes are followed.
 *
 *   const rapper = new RobotRapper(new EspeakVoice())
 *   await rapper.setLines(lines)   // synthesizes every chunk up front
 *   rapper.start()                 // then use the music player as usual
 *
 * Chunks are booked on the AudioContext with `beatClock.contextTimeAt()`, so they are
 * sample-accurate against the beat, not tied to timers or animation frames.
 */
export class RobotRapper {
  options: RapperOptions = { slotsPerBeat: 2, squeeze: true }

  private chunks: RapChunk[] = []
  private buffers: (AudioBuffer | undefined)[] = []
  private planId = 0
  private gain: GainNode | null = null
  private volume = 1

  /** Sources booked for the current timeline, by chunk index. */
  private booked = new Map<number, AudioBufferSourceNode>()
  /** Identifies the clock's current timeline; changes on play, pause, seek and rate. */
  private timeline: string | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private offState: Unsubscribe | null = null

  constructor(
    private voice: RobotVoice,
    private clock: BeatClock = beatClock,
  ) {}

  /**
   * Plan and synthesize `lines` against the clock's current beat. Resolves when every chunk is
   * ready; chunks that finish earlier can already play. Call again after edits or a beat change.
   */
  async setLines(lines: LyricLine[]): Promise<void> {
    const beat = this.clock.beat
    const id = ++this.planId
    this.cancelBooked()
    if (!beat) {
      this.chunks = []
      this.buffers = []
      return
    }
    const { wholeLines, slotsPerBeat = 2, voice, speed, pitch } = this.options
    this.chunks = lines
      .filter((l) => l.text.trim() && l.bar < beat.totalBars)
      .flatMap((l) => (wholeLines ? planWholeLine(l, beat) : planLine(l, beat, slotsPerBeat)))
    this.buffers = new Array(this.chunks.length)

    await Promise.all(
      this.chunks.map(async (chunk, i) => {
        const buffer = await this.voice.synth(chunk.text, { voice, speed, pitch })
        if (id === this.planId) this.buffers[i] = buffer
      }),
    )
    this.tick()
  }

  /** Follow the clock from now on. */
  start(): void {
    if (this.timer) return
    this.offState = this.clock.onStateChange(() => this.tick())
    this.timer = setInterval(() => this.tick(), TICK_MS)
    this.tick()
  }

  /** Stop following the clock and silence anything booked. */
  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.offState?.()
    this.offState = null
    this.cancelBooked()
  }

  /** 0..1.5, robot only. */
  setVolume(volume: number): void {
    this.volume = volume
    if (this.gain) this.gain.gain.value = volume
  }

  /** The chunk sounding at track time `t` (null between chunks), for karaoke highlighting. */
  chunkAt(t: number): RapChunk | null {
    for (let i = this.chunks.length - 1; i >= 0; i--) {
      const c = this.chunks[i]!
      if (c.start <= t) return t < c.start + c.slot ? c : null
    }
    return null
  }

  private tick(): void {
    const { clock } = this
    const ctx = clock.audioContext
    const out = clock.output

    // contextTimeAt(0) is constant while the track plays continuously, and moves on seek, rate
    // change or restart. Any change invalidates everything booked against the old timeline.
    const origin = clock.isPlaying ? clock.contextTimeAt(0) : null
    const timeline = origin === null ? null : `${origin.toFixed(4)}|${clock.rate}`
    if (timeline !== this.timeline) {
      this.cancelBooked()
      this.timeline = timeline
    }
    if (timeline === null || !ctx || !out) return

    if (!this.gain || this.gain.context !== ctx) {
      this.gain = ctx.createGain()
      this.gain.gain.value = this.volume
      this.gain.connect(out)
    }

    const now = ctx.currentTime
    this.chunks.forEach((chunk, i) => {
      const buffer = this.buffers[i]
      if (!buffer || this.booked.has(i)) return
      const when = clock.contextTimeAt(chunk.start)
      if (when === null || when < now - LATE_TOLERANCE || when > now + LOOKAHEAD) return

      const src = ctx.createBufferSource()
      src.buffer = buffer
      // Follow the music's speed (and pitch), then squeeze chunks too long for their slot.
      const fit = this.options.squeeze ? Math.min(Math.max(buffer.duration / chunk.slot, 1), 2) : 1
      src.playbackRate.value = fit * clock.rate
      src.connect(this.gain!)
      src.start(Math.max(when, now))
      src.onended = () => {
        if (this.booked.get(i) === src) {
          this.booked.delete(i)
          src.disconnect()
        }
      }
      this.booked.set(i, src)
    })
  }

  private cancelBooked(): void {
    for (const src of this.booked.values()) {
      src.onended = null
      try {
        src.stop()
      } catch {
        // Already stopped.
      }
      src.disconnect()
    }
    this.booked.clear()
  }
}
