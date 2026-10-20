import type { Beat } from '@/shared/types'
import type { BeatClock, Unsubscribe } from './BeatClock'
import { positionAt, trackDuration, type BeatPosition } from './timing'

/**
 * The real music player. Plays the beat through Web Audio and reads time from
 * `AudioContext.currentTime`, so anything scheduled with `contextTimeAt()` (robot, recordings)
 * lands sample-accurately on the same clock.
 *
 * Graph: source -> music gain (volume) -> output (master bus) -> speakers. Other features
 * connect to `output`, so the volume slider only affects the beat.
 *
 * onBeat/onBar fire from requestAnimationFrame. They are for visuals (a frame late at worst,
 * paused in background tabs); schedule audio with `contextTimeAt()` instead.
 */
export class WebAudioBeatClock implements BeatClock {
  beat: Beat | null = null
  isPlaying = false
  duration = 0
  volume = 1
  rate = 1
  /** Both null until the first play(). */
  audioContext: AudioContext | null = null
  output: GainNode | null = null

  private musicGain: GainNode | null = null
  private buffer: AudioBuffer | null = null
  private source: AudioBufferSourceNode | null = null
  private buffers = new Map<string, Promise<AudioBuffer>>()
  private loadToken = 0
  /** The decode in flight for the current beat, so play() can wait for it. */
  private loading: Promise<AudioBuffer> | null = null

  /** Track time at the moment playback last (re)started or was moved. */
  private anchorTrackTime = 0
  /** AudioContext time at that moment. */
  private anchorContextTime = 0
  private frame: number | null = null
  private lastBeatIndex = -1

  private beatListeners = new Set<(pos: BeatPosition) => void>()
  private barListeners = new Set<(pos: BeatPosition) => void>()
  private stateListeners = new Set<() => void>()

  async load(beat: Beat): Promise<void> {
    const token = ++this.loadToken
    this.stop()
    this.beat = beat
    this.buffer = null
    this.duration = trackDuration(beat)
    this.emitState()

    this.loading = this.decode(beat.file)
    const buffer = await this.loading
    if (token !== this.loadToken) return // a newer load() won
    this.buffer = buffer
    this.duration = buffer.duration
    this.emitState()
  }

  async play(): Promise<void> {
    if (!this.beat || this.isPlaying) return
    // Create/resume first, synchronously inside the click handler that called play(); awaiting
    // anything before this would lose the user gesture on Safari.
    const ctx = this.ensureContext()
    const resumed = ctx.state === 'running' ? null : ctx.resume()
    const token = this.loadToken
    // Play pressed while the beat is still decoding: wait for it instead of ignoring the click.
    // A failed load already rejected load(); here it just means there is nothing to play.
    await Promise.all([resumed, this.loading?.catch(() => null)])
    if (token !== this.loadToken || !this.buffer || this.isPlaying) return
    if (this.anchorTrackTime >= this.duration) this.anchorTrackTime = 0
    this.isPlaying = true
    this.startSource(this.anchorTrackTime)
    this.lastBeatIndex = -1
    this.frame = requestAnimationFrame(this.tick)
    this.emitState()
  }

  pause(): void {
    if (!this.isPlaying) return
    this.anchorTrackTime = this.currentTime()
    this.isPlaying = false
    this.stopSource()
    this.cancelFrame()
    this.emitState()
  }

  stop(): void {
    this.isPlaying = false
    this.stopSource()
    this.cancelFrame()
    this.anchorTrackTime = 0
    this.lastBeatIndex = -1
    this.emitState()
  }

  seek(seconds: number): void {
    const target = Math.min(Math.max(seconds, 0), this.duration)
    this.lastBeatIndex = -1
    // A buffer source cannot be repositioned, so restart it at the new offset.
    if (this.isPlaying) this.startSource(target)
    else this.anchorTrackTime = target
    this.emitState()
  }

  skip(deltaSeconds: number): void {
    this.seek(this.currentTime() + deltaSeconds)
  }

  setVolume(volume: number): void {
    this.volume = Math.min(Math.max(volume, 0), 1)
    if (this.musicGain && this.audioContext) {
      this.musicGain.gain.setValueAtTime(this.volume, this.audioContext.currentTime)
    }
    this.emitState()
  }

  setRate(rate: number): void {
    const next = Math.min(Math.max(rate, 0.5), 2)
    if (this.isPlaying && this.source && this.audioContext) {
      // Re-anchor so the change applies from now, not retroactively.
      this.anchorTrackTime = this.currentTime()
      this.anchorContextTime = this.audioContext.currentTime
      this.source.playbackRate.setValueAtTime(next, this.anchorContextTime)
    }
    this.rate = next
    this.emitState()
  }

  currentTime(): number {
    if (!this.isPlaying || !this.audioContext) return this.anchorTrackTime
    const elapsed = (this.audioContext.currentTime - this.anchorContextTime) * this.rate
    return Math.min(this.anchorTrackTime + Math.max(elapsed, 0), this.duration)
  }

  position(): BeatPosition {
    const time = this.currentTime()
    return this.beat ? positionAt(this.beat, time) : { bar: -1, beat: -1, time }
  }

  contextTimeAt(trackSeconds: number): number | null {
    if (!this.isPlaying) return null
    return this.anchorContextTime + (trackSeconds - this.anchorTrackTime) / this.rate
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

  /** Created on the first play(), i.e. inside a click handler, as browsers require. */
  private ensureContext(): AudioContext {
    if (this.audioContext) return this.audioContext
    const ctx = new AudioContext({ latencyHint: 'interactive' })
    this.output = ctx.createGain()
    this.output.connect(ctx.destination)
    this.musicGain = ctx.createGain()
    this.musicGain.gain.value = this.volume
    this.musicGain.connect(this.output)
    this.audioContext = ctx
    return ctx
  }

  private decode(file: string): Promise<AudioBuffer> {
    let pending = this.buffers.get(file)
    if (!pending) {
      // Decode without the real context so load() works before any click. An AudioBuffer is
      // usable in any context; playback resamples it to the device rate.
      const ctx = new OfflineAudioContext(1, 1, 44100)
      pending = fetch(file)
        .then((res) => {
          if (!res.ok) throw new Error(`Could not load beat ${file}: ${res.status}`)
          return res.arrayBuffer()
        })
        .then((data) => ctx.decodeAudioData(data))
      // Let a failed load be retried.
      pending.catch(() => this.buffers.delete(file))
      this.buffers.set(file, pending)
    }
    return pending
  }

  private startSource(offset: number): void {
    const ctx = this.audioContext
    if (!ctx || !this.buffer || !this.musicGain) return
    this.stopSource()
    const source = ctx.createBufferSource()
    source.buffer = this.buffer
    source.playbackRate.value = this.rate
    source.connect(this.musicGain)
    source.onended = () => {
      // onended also fires after our own stop(); only a natural end of this source counts.
      if (this.source !== source) return
      this.source = null
      this.anchorTrackTime = this.duration
      this.isPlaying = false
      this.cancelFrame()
      this.emitState()
    }
    this.anchorTrackTime = offset
    this.anchorContextTime = ctx.currentTime
    source.start(this.anchorContextTime, offset)
    this.source = source
  }

  private stopSource(): void {
    const source = this.source
    this.source = null
    if (!source) return
    source.onended = null
    try {
      source.stop()
    } catch {
      // Already stopped.
    }
    source.disconnect()
  }

  private tick = (): void => {
    this.frame = null
    if (!this.isPlaying || !this.beat) return
    const pos = this.position()
    if (pos.bar >= 0) {
      const beatIndex = pos.bar * this.beat.beatsPerBar + pos.beat
      if (beatIndex !== this.lastBeatIndex) {
        // Compare bars, not `pos.beat === 0`: a slow frame can skip beat 0 of a bar.
        const lastBar = Math.floor(this.lastBeatIndex / this.beat.beatsPerBar)
        this.lastBeatIndex = beatIndex
        if (pos.bar !== lastBar) this.barListeners.forEach((cb) => cb(pos))
        this.beatListeners.forEach((cb) => cb(pos))
      }
    }
    this.frame = requestAnimationFrame(this.tick)
  }

  private cancelFrame(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame)
    this.frame = null
  }

  private emitState(): void {
    this.stateListeners.forEach((cb) => cb())
  }
}
