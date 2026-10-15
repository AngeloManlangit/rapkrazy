import type { Beat } from '@/shared/types'

/** Where we are in a beat. `bar` and `beat` are 0-based; both are -1 during the offset. */
export interface BeatPosition {
  bar: number
  beat: number
  /** Seconds from the start of the track file. */
  time: number
}

export function beatDuration(beat: Beat): number {
  return 60 / beat.bpm
}

export function barDuration(beat: Beat): number {
  return beatDuration(beat) * beat.beatsPerBar
}

/** Track time (seconds) at which `bar` starts. */
export function barToSeconds(beat: Beat, bar: number): number {
  return beat.offsetMs / 1000 + bar * barDuration(beat)
}

/** Full track length implied by the metadata. */
export function trackDuration(beat: Beat): number {
  return barToSeconds(beat, beat.totalBars)
}

export function positionAt(beat: Beat, time: number): BeatPosition {
  const sinceOffset = time - beat.offsetMs / 1000
  if (sinceOffset < 0) return { bar: -1, beat: -1, time }
  const totalBeats = Math.floor(sinceOffset / beatDuration(beat))
  return {
    bar: Math.floor(totalBeats / beat.beatsPerBar),
    beat: totalBeats % beat.beatsPerBar,
    time,
  }
}
