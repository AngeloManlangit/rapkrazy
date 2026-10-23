import { beatClock } from '@/shared/audio'

export type SfxKind = 'horn' | 'yeah' | 'scratch' | 'ding'

let ownContext: AudioContext | null = null
const noise = new WeakMap<BaseAudioContext, AudioBuffer>()

/**
 * Synthesized placeholder sounds until real samples land. Played through the beat clock's
 * master bus when it exists, so they mix with the beat (and future recordings). Call from a
 * click handler: the AudioContext may need resuming.
 */
export function playSfx(kind: SfxKind): void {
  const ctx = beatClock.audioContext ?? (ownContext ??= new AudioContext())
  if (ctx.state !== 'running') void ctx.resume()
  const out =
    ctx === beatClock.audioContext && beatClock.output ? beatClock.output : ctx.destination
  const t = ctx.currentTime + 0.01

  if (kind === 'horn') {
    ;[0, 0.18, 0.36].forEach((d, k) =>
      [466, 587, 698].forEach((f) => {
        const long = k === 2
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.type = 'sawtooth'
        o.frequency.setValueAtTime(f, t + d)
        o.frequency.linearRampToValueAtTime(f * 0.97, t + d + (long ? 0.5 : 0.15))
        g.gain.setValueAtTime(0.0001, t + d)
        g.gain.linearRampToValueAtTime(0.09, t + d + 0.01)
        g.gain.setValueAtTime(0.09, t + d + (long ? 0.45 : 0.12))
        g.gain.linearRampToValueAtTime(0.0001, t + d + (long ? 0.55 : 0.16))
        o.connect(g).connect(out)
        o.start(t + d)
        o.stop(t + d + 0.6)
      }),
    )
  } else if (kind === 'ding') {
    // Two-note chime: "your turn".
    ;[
      [784, 0],
      [1175, 0.12],
    ].forEach(([f, d]) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'triangle'
      o.frequency.value = f!
      decay(g, t + d!, 0.25, 0.5)
      o.connect(g).connect(out)
      o.start(t + d!)
      o.stop(t + d! + 0.55)
    })
  } else if (kind === 'scratch') {
    const s = ctx.createBufferSource()
    const fl = ctx.createBiquadFilter()
    const g = ctx.createGain()
    s.buffer = noiseBuffer(ctx)
    fl.type = 'bandpass'
    fl.Q.value = 6
    fl.frequency.setValueAtTime(400, t)
    fl.frequency.exponentialRampToValueAtTime(3000, t + 0.12)
    fl.frequency.exponentialRampToValueAtTime(300, t + 0.3)
    decay(g, t, 0.8, 0.32)
    s.connect(fl).connect(g).connect(out)
    s.start(t)
    s.stop(t + 0.35)
  } else {
    ;[0, 0.03, 0.06].forEach((d) => noiseHit(ctx, out, t + d))
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'square'
    o.frequency.setValueAtTime(220, t)
    o.frequency.linearRampToValueAtTime(330, t + 0.25)
    decay(g, t, 0.12, 0.35)
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + 0.4)
  }
}

function decay(g: GainNode, t: number, peak: number, dur: number) {
  g.gain.setValueAtTime(peak, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
}

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buffer = noise.get(ctx)
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate)
    const d = buffer.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    noise.set(ctx, buffer)
  }
  return buffer
}

function noiseHit(ctx: AudioContext, out: AudioNode, t: number) {
  const s = ctx.createBufferSource()
  const fl = ctx.createBiquadFilter()
  const g = ctx.createGain()
  s.buffer = noiseBuffer(ctx)
  fl.type = 'bandpass'
  fl.frequency.value = 1200
  decay(g, t, 0.5, 0.12)
  s.connect(fl).connect(g).connect(out)
  s.start(t)
  s.stop(t + 0.14)
}
