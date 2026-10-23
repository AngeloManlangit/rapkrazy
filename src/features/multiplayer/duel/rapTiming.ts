/**
 * Works out, from a mic recording, whether each rapped line ended on beat 4 of its bar.
 * It looks for syllable onsets (sudden rises in loudness), not for words: the judge (Gemini) says
 * what was said and whether it rhymed, and this says when the last syllable of each bar landed.
 */

export interface BarTiming {
  /** Time (seconds into the recording) of the last syllable onset in the bar, or null if silent. */
  lastOnset: number | null
  /** The bar's last syllable landed from half a beat before beat 4 up to the bar line. */
  onBeat: boolean
}

interface BeatGrid {
  bpm: number
  beatsPerBar: number
}

const HOP = 0.01
const WINDOW = 0.03
/** Onsets closer than this are one syllable. */
const MIN_GAP = 0.08

/** Loudness (RMS) every 10 ms. */
function loudness(samples: Float32Array, rate: number): Float32Array {
  const hop = Math.max(1, Math.round(rate * HOP))
  const win = Math.max(hop, Math.round(rate * WINDOW))
  const out = new Float32Array(Math.floor(samples.length / hop))
  for (let i = 0; i < out.length; i++) {
    const start = i * hop
    const end = Math.min(samples.length, start + win)
    let sum = 0
    for (let j = start; j < end; j++) sum += samples[j]! * samples[j]!
    out[i] = Math.sqrt(sum / Math.max(1, end - start))
  }
  return out
}

const percentile = (values: Float32Array, p: number) => {
  const sorted = Array.from(values).sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0
}

/** Times (seconds) where a new syllable starts. */
export function findOnsets(samples: Float32Array, rate: number): number[] {
  const rms = loudness(samples, rate)
  if (rms.length < 10) return []
  const floor = percentile(rms, 0.2)
  const peak = percentile(rms, 0.95)
  if (peak < 0.008) return [] // nothing but silence
  const threshold = floor + 0.3 * (peak - floor)

  const onsets: number[] = []
  for (let i = 4; i < rms.length; i++) {
    const loud = rms[i]! > threshold
    const rising = rms[i]! > 1.5 * rms[i - 4]!
    if (!loud || !rising) continue
    const t = i * HOP
    if (onsets.length && t - onsets[onsets.length - 1]! < MIN_GAP) continue
    onsets.push(t)
  }
  return onsets
}

/**
 * @param t0 recording time (seconds) when bar 0 of the beat started
 * @param firstBar the bar the first rapped line sits on (bar 0 is the count-in)
 */
export function analyzeBars(
  samples: Float32Array,
  rate: number,
  t0: number,
  beat: BeatGrid,
  firstBar: number,
  bars: number,
): BarTiming[] {
  const onsets = findOnsets(samples, rate)
  const beatLen = 60 / beat.bpm
  const barLen = beatLen * beat.beatsPerBar

  return Array.from({ length: bars }, (_, j) => {
    const barStart = t0 + (firstBar + j) * barLen
    const beatFour = barStart + (beat.beatsPerBar - 1) * beatLen
    // Stop at the bar line: the next line's first syllable belongs to the next bar.
    const barEnd = barStart + barLen
    const inBar = onsets.filter((t) => t >= barStart && t <= barEnd)
    const lastOnset = inBar.length ? inBar[inBar.length - 1]! : null
    return {
      lastOnset,
      onBeat: lastOnset !== null && lastOnset >= beatFour - 0.5 * beatLen,
    }
  })
}
