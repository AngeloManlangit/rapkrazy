import tracery from 'tracery-grammar';
import { buildGrammar } from './buildGrammar';
import { RiTa } from 'rita'
// removed: import { dictionary } from 'cmu-pronouncing-dictionary'

let endCount = 0;
let singleBlanks = 0;
export const generateTraceryText = (): string => {
    const rules: Record<string, string[]> = buildGrammar(false);
    console.log("Generated rules:", rules);
    const grammar = tracery.createGrammar(rules);
    grammar.addModifiers(tracery.baseEngModifiers);

    const themes = rules.themePick;
    const theme = themes![Math.floor(Math.random() * themes!.length)];

    return grammar.flatten(`#origin_${theme}#`);
}
function tokenize(input: string): string[] { //helper function 
  return input.split(/\r?\n/).filter((token) => token.length > 0);
}

export const assignRhymeScheme = (text: string, count: number, scheme = Math.random() < 0.5 ? 'AABB' : 'ABAB'): string => {
  const lines: string[] = tokenize(text);
  let buffer: string = scheme;
  
  // Use .map() to return modified lines
  const updatedLines = lines.map(line => {
    // Add () capturing groups and handle spaces like {{\w+:\s*\w+}} \s*(\w+)\s*:\s*(\w+)\s*
    return line.replace(/{{\s*(\w+)\s*:\s*(\w+)\s*}}/g, (match, type: string, end: string) => {
      if (buffer.length > 0 && end === 'end') {
        const [rhymeChar, ...rest] = buffer;
        buffer = rest.join('');
        
        return `{{${type}:${end}${endCount++}:${count}${rhymeChar}}}`;
      }
      return `{{${type}:${end}:X${singleBlanks++}}}`;
    });
  });


  return updatedLines.join('\n');
};
export type Segment =
  | { kind: "text"; text: string }
  | { kind: "blank"; type: string; id: string; group: string };

const BLANK = /\{\{(\w+):(\w+):(\w+)\}\}/g;

export function parseLine(line: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;

  for (const m of line.matchAll(BLANK)) {
    const [full, type, id, group] = m;
    const start = m.index!;

    if (start > last) { 
      segments.push({ kind: "text", text: line.slice(last, start) });
    }
    segments.push({ kind: "blank", type: type || 'default', id: id || 'default', group: group || 'default' });
    last = start + full.length;    
  }

  if (last < line.length) {
    segments.push({ kind: "text", text: line.slice(last) });
  }
  
  return segments;
}

export function parseSong(raw: string): Segment[][] {
  return raw.split("\n").map(n => parseLine(n));
}

// ---------- Rhyme checking (RiTa phonemes, no stress needed) ----------

export type Verdict = "perfect" | "slant" | "none";

// hand-written slang in ARPABET, no stress digits needed. Add words you see failing.
const custom: Record<string, string> = {
  skrrt: 'S K ER T',
  yeet: 'Y IY T',
  brazy: 'B R EY Z IY',
}

const VOWEL = /^(AA|AE|AH|AO|AW|AY|EH|ER|EY|IH|IY|OW|OY|UH|UW)$/

const lastWord = (s: string) =>
  s.trim().split(/\s+/).pop()!.toLowerCase().replace(/[^a-z']/g, '')

// RiTa gives "k-r-ey-z-iy" -> ["K","R","EY","Z","IY"] (strip any stress digits too)
const toArpa = (p: string): string[] =>
  p.replace(/\//g, '-').split('-').filter(Boolean)
    .map(x => x.toUpperCase().replace(/\d/g, ''))

// Lookup chain: custom slang -> RiTa (lexicon, or letter-to-sound guess)
const phonesOf = (text: string): string[] | null => {
  const w = lastWord(text)
  if (!w) return null
  if (custom[w]) return custom[w]!.split(' ')
  try {
    const phones = toArpa(RiTa.phones(w, { silent: true }))
    return phones.some(p => VOWEL.test(p)) ? phones : null
  } catch {
    return null
  }
}

// sounds shared at the end of both words, counting backwards
const sharedSuffix = (a: string[], b: string[]): string[] => {
  const out: string[] = []
  for (let i = 1; i <= Math.min(a.length, b.length); i++) {
    if (a[a.length - i] !== b[b.length - i]) break
    out.unshift(a[a.length - i]!)
  }
  return out
}

const syllables = (p: string[]) => p.filter(x => VOWEL.test(x)).length

const lastVowelIndex = (p: string[]) => {
  for (let i = p.length - 1; i >= 0; i--) if (VOWEL.test(p[i]!)) return i
  return -1
}

export function compareRhyme(a: string, b: string): Verdict {
  const pa = phonesOf(a), pb = phonesOf(b)
  if (!pa || !pb) return 'none'

  // repeating the same word isn't a rhyme
  if (lastWord(a) === lastWord(b)) return 'none'

  // PERFECT: the ending matches, including at least one vowel.
  // One shared sound is enough only if both words are one syllable (see/me).
  const shared = sharedSuffix(pa, pb)
  const sharedVowel = shared.some(p => VOWEL.test(p))
  const bothMono = syllables(pa) === 1 && syllables(pb) === 1
  if (sharedVowel && (shared.length >= 2 || bothMono)) return 'perfect'

  // SLANT (assonance): the last vowel sound is the same (time/mine, crazy/see)
  const ia = lastVowelIndex(pa), ib = lastVowelIndex(pb)
  if (pa[ia] === pb[ib]) return 'slant'

  // SLANT (consonance): different vowels, same ending consonants (shape/keep)
  const endA = pa.slice(ia + 1).join(' ')
  const endB = pb.slice(ib + 1).join(' ')
  if (endA && endA === endB) return 'slant'

  return 'none'
}

export const isWord = (text: string): boolean => phonesOf(text) !== null