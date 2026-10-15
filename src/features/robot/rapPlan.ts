import { barToSeconds, beatDuration } from '@/shared/audio'
import type { Beat, LyricLine } from '@/shared/types'

/** One piece of a lyric line, placed on the beat grid. */
export interface RapChunk {
  lineId: string
  text: string
  /** Track time (seconds) the chunk starts at. */
  start: number
  /** Time the chunk may take before the next one starts. */
  slot: number
}

/**
 * Split a line into chunks spread over its bars. `slotsPerBeat` 1 puts at most one chunk on
 * each beat, 2 allows eighth notes. With more words than slots, words are grouped so every
 * slot gets one chunk; with fewer, chunks land on evenly spaced slots.
 */
export function planLine(line: LyricLine, beat: Beat, slotsPerBeat = 1): RapChunk[] {
  const words = line.text.trim().split(/\s+/).filter(Boolean)
  const slots = line.bars * beat.beatsPerBar * slotsPerBeat
  const slotLength = beatDuration(beat) / slotsPerBeat
  const lineStart = barToSeconds(beat, line.bar)
  const count = Math.min(words.length, slots)

  const chunks: RapChunk[] = []
  for (let j = 0; j < count; j++) {
    const firstWord = Math.floor((j * words.length) / count)
    const lastWord = Math.floor(((j + 1) * words.length) / count)
    const firstSlot = Math.floor((j * slots) / count)
    const nextSlot = Math.floor(((j + 1) * slots) / count)
    chunks.push({
      lineId: line.id,
      text: words.slice(firstWord, lastWord).join(' '),
      start: lineStart + firstSlot * slotLength,
      slot: (nextSlot - firstSlot) * slotLength,
    })
  }
  return chunks
}

/** The whole line as one chunk, for comparing against chunked delivery. */
export function planWholeLine(line: LyricLine, beat: Beat): RapChunk[] {
  return [
    {
      lineId: line.id,
      text: line.text.trim(),
      start: barToSeconds(beat, line.bar),
      slot: line.bars * beat.beatsPerBar * beatDuration(beat),
    },
  ]
}
