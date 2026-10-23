import { supabase } from '@/shared/SupabaseClient'
import type { DuelLine } from '@/shared/types'
import type { BarTiming } from './rapTiming'

interface JudgedLine {
  heard: string
  rhymes: boolean
}

/** Asks the `judge-rap` edge function what was said and which lines rhymed with the targets. */
async function askJudge(wavBase64: string, targets: string[]): Promise<JudgedLine[]> {
  if (!supabase) throw new Error('Multiplayer needs Supabase keys in .env')
  const { data, error } = await supabase.functions.invoke('judge-rap', {
    body: { audio: wavBase64, mimeType: 'audio/wav', targets },
  })
  if (error) {
    console.warn('judge-rap failed:', error)
    throw new Error('The judge is busy or could not be reached. Wait a few seconds and try again.')
  }
  if (!Array.isArray(data?.lines) || data.lines.length !== targets.length) {
    throw new Error('The judge sent back something unexpected. Try again.')
  }
  return data.lines as JudgedLine[]
}

/** Rhyme and on-beat together: 1 point for both, half a point for a rhyme that missed the beat. */
export function pointsFor(rhymes: boolean, onBeat: boolean): number {
  if (!rhymes) return 0
  return onBeat ? 1 : 0.5
}

export async function judgeRap(
  wavBase64: string,
  targets: string[],
  timing: BarTiming[],
): Promise<{ lines: DuelLine[]; score: number }> {
  const judged = await askJudge(wavBase64, targets)
  const lines = targets.map((target, i) => {
    const heard = String(judged[i]?.heard ?? '').trim()
    const rhymes = !!judged[i]?.rhymes && heard !== ''
    const onBeat = !!timing[i]?.onBeat
    return { target, heard, rhymes, onBeat, points: pointsFor(rhymes, onBeat) }
  })
  return { lines, score: lines.reduce((sum, l) => sum + l.points, 0) }
}
