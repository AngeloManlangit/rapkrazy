import { barToSeconds, beatDuration, type BeatClock } from '@/shared/audio'
import type { RobotRapper } from '@/features/robot/RobotRapper'
import { IDLE_WAVE, RobotCanvas, type RobotFrame, type RobotNote } from './robotCanvas'

export interface RecordOptions {
  clock: BeatClock
  rapper: RobotRapper
  /** URL of the eyeless robot head image (the one RobotStage uses). */
  headSrc: string
  /** How many bars to record from the top of the beat (usually: last written line + 1). */
  bars: number
  /** Square video size in px. */
  size?: number
  fps?: number
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

export interface RapVideo {
  blob: Blob
  url: string
  ext: 'mp4' | 'webm'
  seconds: number
}

const MIMES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
]

function pickMime(): string {
  const mime = MIMES.find((m) => MediaRecorder.isTypeSupported(m))
  if (!mime) throw new Error('This browser cannot record video')
  return mime
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load the robot image'))
    img.src = src
  })
}

/** Turns clock + rapper state into RobotFrames, mirroring what RobotStage does with refs and CSS. */
class Director {
  private bobUntil = 0
  private notes: RobotNote[] = []
  private word = ''
  private words = 0
  private lean: 'l' | 'r' | null = null
  private lastEighth = -1
  private wave = IDLE_WAVE
  private blinkUntil = 0
  private nextBlink = 0

  constructor(
    private clock: BeatClock,
    private rapper: RobotRapper,
  ) {}

  beatHit(beatInBar: number): void {
    const now = performance.now() / 1000
    this.bobUntil = now + 0.12
    if (beatInBar % 2 === 0) this.notes.push({ born: now, alt: beatInBar === 2 })
  }

  frame(): RobotFrame {
    const { clock } = this
    const now = performance.now() / 1000
    const t = clock.currentTime()
    const beat = clock.beat
    const word = this.rapper.chunkAt(t)?.text ?? ''

    if (word !== this.word) {
      this.word = word
      this.lean = word ? (this.words++ % 2 ? 'r' : 'l') : null
    }

    let sing = false
    if (beat) {
      const eighths = (t - beat.offsetMs / 1000) / (beatDuration(beat) / 2)
      sing = !!word && eighths % 1 < 0.55
      const idx = Math.floor(eighths)
      if (idx !== this.lastEighth) {
        this.lastEighth = idx
        this.wave = this.newWave(word ? 1 : 0.45)
      }
    }

    if (now > this.nextBlink) {
      this.blinkUntil = now + 0.12
      this.nextBlink = now + 2.2 + Math.random() * 3.2
    }
    this.notes = this.notes.filter((n) => now - n.born < 1.2)

    return {
      word,
      now,
      bob: now < this.bobUntil,
      sing,
      blink: now < this.blinkUntil,
      lean: this.lean,
      mood: null,
      // a slow drift so the eyes aren't dead still
      gaze: [Math.sin(now * 0.6) * 6, Math.sin(now * 0.9) * 3],
      wave: this.wave,
      notes: this.notes,
    }
  }

  private newWave(energy: number): [number, number][] {
    const pts: [number, number][] = []
    for (let i = 0; i < 8; i++) {
      const y = i === 0 || i === 7 ? 201 : 200 + (i % 2 ? -1 : 1) * (3 + Math.random() * 15 * energy)
      pts.push([128 + i * 7.4, y])
    }
    return pts
  }
}

/**
 * Plays the beat from the top with the robot rapping, and records canvas + audio to a video.
 *
 * Audio: RobotRapper plugs its voice into `clock.output`, so the beat and the robot's TTS are
 * already mixed there. We tap that node with a MediaStreamAudioDestinationNode.
 * Video: the robot is redrawn on a canvas every animation frame from clock.currentTime(), so it
 * stays in sync with what you hear. The tab must stay visible while recording.
 *
 * Call from a click handler (the clock's play() needs a user gesture), and after
 * `rapper.setLines()` has resolved so every chunk is synthesized.
 */
export async function recordRapVideo(o: RecordOptions): Promise<RapVideo> {
  const { clock, rapper } = o
  const beat = clock.beat
  if (!beat) throw new Error('Pick a beat first')
  const size = o.size ?? 720
  const fps = o.fps ?? 30

  const mime = pickMime()
  const [head] = await Promise.all([
    loadImage(o.headSrc),
    document.fonts.load('40px "Luckiest Guy"').catch(() => []),
  ])

  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const robot = new RobotCanvas(canvas, head)
  const director = new Director(clock, rapper)

  const endAt = Math.min(clock.duration, barToSeconds(beat, Math.max(1, o.bars)))

  clock.pause()
  clock.seek(barToSeconds(beat, 0))
  await clock.play()

  const ctx = clock.audioContext
  const out = clock.output
  if (!ctx || !out) {
    clock.pause()
    throw new Error('The beat player has no Web Audio output to record yet')
  }

  const dest = ctx.createMediaStreamDestination()
  out.connect(dest)
  const offBeat = clock.onBeat((pos) => director.beatHit(pos.beat))

  robot.draw(director.frame())
  const videoStream = canvas.captureStream(fps)
  const stream = new MediaStream([...videoStream.getVideoTracks(), ...dest.stream.getAudioTracks()])
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 5_000_000,
    audioBitsPerSecond: 192_000,
  })
  const parts: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size) parts.push(e.data)
  }
  const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()))
  recorder.start(250)

  let seconds = 0
  await new Promise<void>((resolve) => {
    const step = () => {
      const t = clock.currentTime()
      seconds = t
      robot.draw(director.frame())
      o.onProgress?.(Math.min(1, t / endAt))
      if (!clock.isPlaying || t >= endAt - 0.01 || o.signal?.aborted) return resolve()
      requestAnimationFrame(step)
    }
    step()
  })

  clock.pause()
  // one last frame so the final state is in the file, then let the encoder flush
  robot.draw(director.frame())
  await new Promise((r) => setTimeout(r, 150))
  recorder.stop()
  await stopped

  offBeat()
  try {
    out.disconnect(dest)
  } catch {
    // already disconnected
  }
  stream.getTracks().forEach((tr) => tr.stop())

  if (o.signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
  if (seconds < 0.5 || !parts.length) throw new Error('Nothing was recorded, try again')

  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm'
  const blob = new Blob(parts, { type: mime.split(';')[0] })
  return { blob, url: URL.createObjectURL(blob), ext, seconds }
}
