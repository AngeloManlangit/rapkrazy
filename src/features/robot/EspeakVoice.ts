import type { RobotVoice, RobotVoiceOptions } from '@/shared/audio'

const WORKER_URL = `${import.meta.env.BASE_URL}vendor/espeakng/espeakng.worker.js`
const SAMPLE_RATE = 22050
/** Samples quieter than this at either end are trimmed so chunks start right on the beat. */
const SILENCE = 0.01

export const ESPEAK_DEFAULTS = { voice: 'en-us', speed: 175, pitch: 50 } as const

interface WorkerReply {
  callback?: string
  result: unknown[]
  done?: boolean
}

/**
 * RobotVoice backed by the vendored eSpeak-NG worker (public/vendor/espeakng).
 * Speed is words per minute (80..450), pitch is 0..99.
 */
export class EspeakVoice implements RobotVoice {
  private worker: Worker | null = null
  private ready: Promise<void> | null = null
  private nextId = 0
  private callbacks = new Map<string, (reply: WorkerReply) => void>()
  private cache = new Map<string, Promise<AudioBuffer>>()

  synth(text: string, options: RobotVoiceOptions = {}): Promise<AudioBuffer> {
    const voice = options.voice ?? ESPEAK_DEFAULTS.voice
    const speed = Math.round(options.speed ?? ESPEAK_DEFAULTS.speed)
    const pitch = Math.round(options.pitch ?? ESPEAK_DEFAULTS.pitch)
    const key = `${voice}|${speed}|${pitch}|${text}`

    let buffer = this.cache.get(key)
    if (!buffer) {
      buffer = this.render(text, voice, speed, pitch)
      buffer.catch(() => this.cache.delete(key))
      this.cache.set(key, buffer)
    }
    return buffer
  }

  /**
   * Languages the engine knows. `code` (e.g. `en-us`) is what `synth` takes as `voice`;
   * append a variant like `+croak` or `+m3` for a different timbre.
   */
  async listVoices(): Promise<{ code: string; name: string }[]> {
    await this.start()
    type Raw = { name: string; languages: { name: string }[] }
    const raw = await new Promise<Raw[]>((resolve) => {
      this.call('list_voices', [], (reply) => {
        if (reply.done) resolve(reply.result[0] as Raw[])
      })
    })
    return raw
      .filter((v) => v.languages.length > 0)
      .map((v) => ({ code: v.languages[0]!.name, name: v.name }))
  }

  private async render(
    text: string,
    voice: string,
    speed: number,
    pitch: number,
  ): Promise<AudioBuffer> {
    await this.start()
    // The worker handles messages in order, so these settings apply to this synthesize call.
    this.call('set_voice', [voice])
    this.call('set_rate', [speed])
    this.call('set_pitch', [pitch])

    const chunks: Float32Array[] = []
    await new Promise<void>((resolve) => {
      this.call('synthesize', [text], (reply) => {
        if (reply.done) return resolve()
        // Each chunk is interleaved stereo with both channels identical; keep the left.
        const stereo = new Float32Array(reply.result[0] as ArrayBuffer)
        const mono = new Float32Array(stereo.length / 2)
        for (let i = 0; i < mono.length; i++) mono[i] = stereo[i * 2]!
        chunks.push(mono)
      })
    })
    return toTrimmedBuffer(chunks)
  }

  private start(): Promise<void> {
    if (this.ready) return this.ready
    this.ready = new Promise((resolve, reject) => {
      const worker = new Worker(WORKER_URL)
      worker.onerror = (e) => reject(new Error(`eSpeak-NG worker failed: ${e.message}`))
      worker.onmessage = (e: MessageEvent) => {
        if (e.data === 'ready') {
          worker.onmessage = (msg: MessageEvent<WorkerReply>) => this.onReply(msg.data)
          resolve()
        }
      }
      this.worker = worker
    })
    return this.ready
  }

  private call(method: string, args: unknown[], cb?: (reply: WorkerReply) => void): void {
    const message: { method: string; args: unknown[]; callback?: string } = { method, args }
    if (cb) {
      message.callback = `cb${this.nextId++}`
      this.callbacks.set(message.callback, cb)
    }
    this.worker!.postMessage(message)
  }

  private onReply(reply: WorkerReply): void {
    if (!reply.callback) return
    const cb = this.callbacks.get(reply.callback)
    if (!cb) return
    if (reply.done) this.callbacks.delete(reply.callback)
    cb(reply)
  }
}

function toTrimmedBuffer(chunks: Float32Array[]): AudioBuffer {
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const all = new Float32Array(total)
  let offset = 0
  for (const c of chunks) {
    all.set(c, offset)
    offset += c.length
  }

  let start = 0
  while (start < all.length && Math.abs(all[start]!) < SILENCE) start++
  let end = all.length
  while (end > start && Math.abs(all[end - 1]!) < SILENCE) end--

  const length = Math.max(end - start, 1)
  const buffer = new AudioBuffer({ length, sampleRate: SAMPLE_RATE, numberOfChannels: 1 })
  buffer.copyToChannel(all.subarray(start, start + length), 0)
  return buffer
}
