/** Tiny synthesized drum kit for dev pages, so testing needs no beat files. */

let noise: AudioBuffer | null = null

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  if (noise && noise.sampleRate === ctx.sampleRate) return noise
  noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return noise
}

export function kick(
  ctx: BaseAudioContext,
  out: AudioNode,
  when: number,
): AudioScheduledSourceNode {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.frequency.setValueAtTime(150, when)
  osc.frequency.exponentialRampToValueAtTime(40, when + 0.15)
  gain.gain.setValueAtTime(1, when)
  gain.gain.exponentialRampToValueAtTime(0.001, when + 0.3)
  osc.connect(gain).connect(out)
  osc.start(when)
  osc.stop(when + 0.3)
  return osc
}

function noiseHit(
  ctx: BaseAudioContext,
  out: AudioNode,
  when: number,
  type: BiquadFilterType,
  freq: number,
  level: number,
  length: number,
): AudioScheduledSourceNode {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx)
  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.frequency.value = freq
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(level, when)
  gain.gain.exponentialRampToValueAtTime(0.001, when + length)
  src.connect(filter).connect(gain).connect(out)
  src.start(when)
  src.stop(when + length)
  return src
}

export const snare = (ctx: BaseAudioContext, out: AudioNode, when: number) =>
  noiseHit(ctx, out, when, 'bandpass', 1800, 0.8, 0.18)

export const hat = (ctx: BaseAudioContext, out: AudioNode, when: number, level = 0.25) =>
  noiseHit(ctx, out, when, 'highpass', 7000, level, 0.05)

/**
 * Schedule one bar of boom-bap at `when`. `countIn` plays only clicks.
 * Returns the nodes so the caller can stop them early.
 */
export function drumBar(
  ctx: BaseAudioContext,
  out: AudioNode,
  when: number,
  beatLength: number,
  countIn = false,
): AudioScheduledSourceNode[] {
  const nodes: AudioScheduledSourceNode[] = []
  for (let b = 0; b < 4; b++) {
    const t = when + b * beatLength
    if (countIn) {
      nodes.push(hat(ctx, out, t, b === 0 ? 0.6 : 0.35))
      continue
    }
    if (b === 0 || b === 2) nodes.push(kick(ctx, out, t))
    if (b === 2) nodes.push(kick(ctx, out, t + beatLength / 2))
    if (b === 1 || b === 3) nodes.push(snare(ctx, out, t))
    nodes.push(hat(ctx, out, t), hat(ctx, out, t + beatLength / 2, 0.15))
  }
  return nodes
}
