import { RiTa } from 'rita'

export type RhymeStatus = 'none' | 'blank' | 'alone' | 'perfect' | 'slant' | 'miss'

const VOWEL = /^(aa|ae|ah|ao|aw|ay|eh|er|ey|ih|iy|ow|oy|uh|uw)\d?$/

// last vowel sound of a word, e.g. "crazy" -> "iy" (used for slant/assonance)
function phonesOf(word: string): string[] | null {
  try {
    const p = RiTa.phones(word).split(/[-\s/]/).filter(Boolean)
    return p.length ? p : null
  } catch {
    return null
  }
}
function lastVowelIndex(p: string[]): number {
  for (let i = p.length - 1; i >= 0; i--) if (VOWEL.test(p[i]!)) return i
  return -1
}
function isPerfect(a: string, b: string): boolean {
  try { return RiTa.isRhyme(a, b) } catch { return false }
}

function isSlant(a: string, b: string): boolean {
  const pa = phonesOf(a), pb = phonesOf(b)
  if (!pa || !pb) return false

  const ia = lastVowelIndex(pa), ib = lastVowelIndex(pb)
  if (ia < 0 || ib < 0) return false

  // assonance: same last vowel sound (time/mine, crazy/see)
  const vowelA = pa[ia]!.replace(/\d/, '')
  const vowelB = pb[ib]!.replace(/\d/, '')
  if (vowelA === vowelB) return true

  // consonance: same consonants after the last vowel (shape/keep, cat/hit)
  const endA = pa.slice(ia + 1).join(' ')
  const endB = pb.slice(ib + 1).join(' ')
  return endA !== '' && endA === endB
}

function lastWord(line: string): string {
  const clean = line.toLowerCase().replace(/\[[^\]]*\]/g, '')
  return clean.match(/[a-z']+(?=[^a-z']*$)/)?.[0] ?? ''
}

// rhymeStatuses re-runs on every keystroke, so remember pair results
const pairCache = new Map<string, 'perfect' | 'slant' | 'miss'>()

function compare(a: string, b: string): 'perfect' | 'slant' | 'miss' {
  const key = a < b ? `${a}|${b}` : `${b}|${a}`
  const hit = pairCache.get(key)
  if (hit) return hit
  const r = isPerfect(a, b) ? 'perfect' : isSlant(a, b) ? 'slant' : 'miss'
  pairCache.set(key, r)
  return r
}

export function rhymeStatuses(lines: string[], groups: (string | null)[]): RhymeStatus[] {
  // end word per line, or null while the line still ends in an unfilled [blank]
  const words = lines.map((l) =>
    /\[[^\]]*\]\s*[^\w]*$/.test(l) ? null : lastWord(l) || null,
  )

  return lines.map((_, i) => {
    const g = groups[i]
    if (!g) return 'none'
    const w = words[i]
    if (!w) return 'blank'

    // if i and j are not the same but items are in the same rhyme group then they are partners 
    const partners = words.filter((o, j): o is string => j !== i && groups[j] === g && !!o)
    if (partners.length === 0) return 'alone'

    //make array of the results when comparing end word to its partner word/s
    const results = partners.map((p) => compare(w, p))
    if (results.includes('perfect')) return 'perfect'
    if (results.includes('slant')) return 'slant'
    return 'miss'
  })
}
export function debugRhyme(a: string, b: string) {
  const pa = phonesOf(a), pb = phonesOf(b)
  return {
    phonesA: pa,
    phonesB: pb,
    lastVowelA: pa ? pa[lastVowelIndex(pa)] : null,
    lastVowelB: pb ? pb[lastVowelIndex(pb)] : null,
    isPerfect: isPerfect(a, b),
    isSlant: isSlant(a, b),
    compare: compare(a, b),
  }
}