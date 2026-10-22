/**
 * Rough English syllable count: vowel groups per word, silent final "e" dropped, at least one
 * per word. Good enough to tell whether a line fits one bar; not a dictionary.
 */
export function countSyllables(text: string): number {
  let n = 0
  for (const raw of text.toLowerCase().split(/[^a-z']+/)) {
    if (!raw) continue
    const word = raw.replace(/'/g, '').replace(/e$/, '')
    n += Math.max(1, word.match(/[aeiouy]+/g)?.length ?? 0)
  }
  return n
}

export type FlowKind = 'thin' | 'ok' | 'busy' | 'crowd'

/** How a line's syllable count feels in one 4/4 bar. */
export function flowOf(text: string): { kind: FlowKind; label: string } {
  const n = countSyllables(text)
  if (n === 0) return { kind: 'thin', label: 'empty' }
  const label = `${n} syl`
  if (n < 6) return { kind: 'thin', label }
  if (n <= 12) return { kind: 'ok', label }
  if (n <= 15) return { kind: 'busy', label }
  return { kind: 'crowd', label }
}
