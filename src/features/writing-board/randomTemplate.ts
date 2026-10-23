import { assignRhymeScheme, generateTraceryText, parseSong } from '@/features/template-gen/template'


export interface Template {
  lines: string[]
  /** Rhyme group of each line's final blank, or null if the line has none. */
  groups: (string | null)[]
}
/**
 * Two rhymed stanzas from the template generator, flattened to plain lyric lines. Blanks become
 * `[noun]`-style markers the player overwrites, so the robot can still read the line aloud.
 */
export function randomTemplate(): Template {
  const raw = [1, 2].map((n) => assignRhymeScheme(generateTraceryText(), n)).join('\n')
  const lines: string[] = []
  const groups: (string | null)[] = []

  for (const segments of parseSong(raw)) {
    const text = segments
      .map((s) => (s.kind === 'text' ? s.text : `[${s.type}:${s.group}]`))
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
    if (!text) continue
    const last = segments.findLast((s) => s.kind !== 'text' || /\w/.test(s.text))
    const g = last && last.kind !== 'text' ? String(last.group) : null
    lines.push(text)
    groups.push(g && !g.startsWith('X') ? g : null)
  }
  return { lines, groups }
}
