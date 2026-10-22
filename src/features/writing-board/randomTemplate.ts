import { assignRhymeScheme, generateTraceryText, parseSong } from '@/features/template-gen/template'

/**
 * Two rhymed stanzas from the template generator, flattened to plain lyric lines. Blanks become
 * `[noun]`-style markers the player overwrites, so the robot can still read the line aloud.
 */
export function randomTemplate(): string[] {
  const raw = [1, 2].map((n) => assignRhymeScheme(generateTraceryText(), n)).join('\n')
  return parseSong(raw)
    .map((segments) =>
      segments
        .map((s) => (s.kind === 'text' ? s.text : `[${s.type}]`))
        .join('')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
}
