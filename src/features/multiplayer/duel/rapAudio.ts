import { barDuration, barToSeconds } from '@/shared/audio'
import type { BeatClock } from '@/shared/audio'
import type { Beat } from '@/shared/types'

export interface RapRecording {
  blob: Blob
  /** Recording time (seconds) at which bar 0 of the beat started, with speaker delay added. */
  t0: number
}

/** The count-in is bar 0, then one bar per rapped line. */
export const COUNT_IN_BARS = 1

/**
 * Plays the beat from bar 0 and records the mic at the same time. Resolves after the count-in
 * plus `bars` bars. Throws if the mic is blocked. Echo cancellation is on so the beat coming out
 * of the speakers is mostly removed from the recording, but headphones are still best.
 */
export async function recordRap(
  clock: BeatClock,
  beat: Beat,
  bars: number,
  onBar: (bar: number) => void,
): Promise<RapRecording> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
  })
  const recorder = new MediaRecorder(stream)
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data)
  }
  const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()))
  const started = new Promise<number>(
    (resolve) => (recorder.onstart = () => resolve(performance.now())),
  )

  try {
    clock.setRate(1)
    clock.pause()
    clock.seek(barToSeconds(beat, 0))
    recorder.start()
    const recStart = await started
    await clock.play()
    const beatStart = performance.now()
    const speakerDelay = clock.audioContext?.outputLatency ?? 0
    const t0 = (beatStart - recStart) / 1000 + speakerDelay

    const barMs = barDuration(beat) * 1000
    const total = COUNT_IN_BARS + bars
    for (let bar = 0; bar < total; bar++) {
      onBar(bar)
      await new Promise((resolve) => setTimeout(resolve, barMs))
    }
    // A short tail so the last word is not cut off.
    await new Promise((resolve) => setTimeout(resolve, 250))

    if (recorder.state !== 'inactive') recorder.stop()
    await stopped
    return { blob: new Blob(chunks, { type: recorder.mimeType }), t0 }
  } finally {
    clock.pause()
    if (recorder.state !== 'inactive') recorder.stop()
    stream.getTracks().forEach((t) => t.stop())
  }
}

/** Decode the recording to mono samples. */
export async function decodeMono(blob: Blob): Promise<{ samples: Float32Array; rate: number }> {
  const ctx = new AudioContext()
  try {
    const buffer = await ctx.decodeAudioData(await blob.arrayBuffer())
    const mono = new Float32Array(buffer.length)
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const data = buffer.getChannelData(c)
      for (let i = 0; i < data.length; i++) mono[i]! += data[i]! / buffer.numberOfChannels
    }
    return { samples: mono, rate: buffer.sampleRate }
  } finally {
    void ctx.close()
  }
}

/** 16 kHz, 16-bit mono WAV as base64: small enough to send, and a format every judge accepts. */
export function toWavBase64(samples: Float32Array, rate: number): string {
  const target = 16000
  const ratio = rate / target
  const length = Math.floor(samples.length / ratio)
  const pcm = new Int16Array(length)
  for (let i = 0; i < length; i++) {
    const s = Math.max(-1, Math.min(1, samples[Math.floor(i * ratio)] ?? 0))
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }

  const header = new ArrayBuffer(44)
  const v = new DataView(header)
  const text = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i))
  }
  text(0, 'RIFF')
  v.setUint32(4, 36 + pcm.byteLength, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // mono
  v.setUint32(24, target, true)
  v.setUint32(28, target * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  text(36, 'data')
  v.setUint32(40, pcm.byteLength, true)

  const bytes = new Uint8Array(44 + pcm.byteLength)
  bytes.set(new Uint8Array(header), 0)
  bytes.set(new Uint8Array(pcm.buffer), 44)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}
