import tracery from 'tracery-grammar';
import {buildGrammar} from './buildGrammar';

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

export const assignRhymeScheme = (text: string, count: number, scheme = 'ABAB'): string => {
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
  | { kind: "blank"; type: string; id: string; group?: string};

const BLANK = /\{\{(\w+):(\w+):(\w+)\}\}/g;

export function parseLine(line: string): Segment[] {
  console.log(`Parsing line: "${line}"`);
  const segments: Segment[] = [];
  let last = 0;

  for (const m of line.matchAll(BLANK)) {
    const [full, type, id, group] = m;
    const start = m.index!;
    console.log(`Last: ${last}, Start: ${start}`);

    /**
     *  if the index of matched blank item is greater than last index, then
     * extract the text from last to start index and push it as kind: "text" to segments
     * then push the matched blank item as kind: "blank" to segments
     * if last is still less than total length of line after loop, then extract everything
     * until < line.length as kind: "text" and push it to segments
     */

    if (start > last) { 
      segments.push({ kind: "text", text: line.slice(last, start) });
    }
    segments.push({ kind: "blank", type: type || 'default', id: id || 'default', group});
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
