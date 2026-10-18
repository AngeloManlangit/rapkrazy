import { supabase } from '@/shared/SupabaseClient'
import type { GeneratedLyrics, WriterInputs } from '@/shared/types'

/** Optional beat info so the AI matches the current beat. */
export interface WriterContext {
    bars?: number
    bpm?: number
    syllablesPerBar?: number
}

/*
    Which path runs (first match wins):
    1. VITE_AI_WRITER_MOCK=true          -> canned lyrics, no network
    2. DEV + VITE_GEMINI_API_KEY set     -> calls Gemini straight from your browser (LOCAL TESTING ONLY)
    3. Supabase keys in .env             -> the `lyrics` edge function (the real architecture)
    4. nothing configured                -> canned lyrics
*/
const FORCE_CANNED = import.meta.env.VITE_AI_WRITER_MOCK === 'true'
const DEV_GEMINI_KEY = import.meta.env.DEV ? import.meta.env.VITE_GEMINI_API_KEY : undefined
const DEV_GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL ?? 'gemini-3.5-flash'

export async function requestLyrics(inputs: WriterInputs, ctx: WriterContext = {}): Promise<GeneratedLyrics> {
    const bars = ctx.bars ?? 8
    if (FORCE_CANNED) return cannedVerse(inputs, bars)

    try {
        if (DEV_GEMINI_KEY) return await devGemini(inputs, ctx, DEV_GEMINI_KEY)
        if (supabase) return await viaEdgeFunction(inputs, ctx)
    } catch (e) {
        // Architecture rule: on any error or rate limit, fall back. Never show an error screen.
        console.warn('AI Writer fell back to canned lyrics:', e)
    }
    return cannedVerse(inputs, bars)
}

async function viaEdgeFunction(inputs: WriterInputs, ctx: WriterContext): Promise<GeneratedLyrics> {
    const { data, error } = await supabase!.functions.invoke('lyrics', {
        body: {
        action: 'verse',
        subject: inputs.subject,
        verb: inputs.action,
        adjective: inputs.adjective,
        topic: inputs.topic,
        bars: ctx.bars ?? 8,
        bpm: ctx.bpm,
        syllablesPerBar: ctx.syllablesPerBar,
        },
    })
    if (error) throw error
    if (!data?.lines?.length) throw new Error('Empty response')
    return { title: data.title, lines: data.lines }
}

/*
* LOCAL TESTING ONLY. Puts your Gemini key in the browser, so never commit it and never deploy it.
* Guarded by import.meta.env.DEV, so production builds drop this path.
*/
async function devGemini(inputs: WriterInputs, ctx: WriterContext, apiKey: string): Promise<GeneratedLyrics> {
    const bars = ctx.bars ?? 8
    const syl = ctx.syllablesPerBar ?? 10
    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${DEV_GEMINI_MODEL}:generateContent`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{
                        text: 'You are a rap lyricist for a family-friendly party game. Original lyrics only, never quote real songs. No profanity, slurs, or hate. Return JSON only.',
                    }],
                },
                contents: [{
                    role: 'user',
                    parts: [{
                        text:
                        `Subject (noun): ${inputs.subject}\nAction (verb): ${inputs.action}\nAdjective: ${inputs.adjective}\n` +
                        `Topic: ${inputs.topic}\n\nWrite exactly ${bars} bars, about ${syl} syllables each. Use the subject, ` +
                        `action and adjective at least once each. Consistent rhyme scheme. One bar per item in "lines".`,
                    }],
                }],
                generationConfig: {
                    responseMimeType: 'application/json',
                    temperature: 1.0,
                    responseSchema: {
                        type: 'OBJECT',
                        properties: { title: { type: 'STRING' }, lines: { type: 'ARRAY', items: { type: 'STRING' } } },
                        required: ['title', 'lines'],
                    },
                },
            }),
        },
  )
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const out = JSON.parse(data.candidates[0].content.parts[0].text)
  const lines = (out.lines ?? []).map((l: unknown) => String(l).trim()).filter(Boolean).slice(0, bars)
  if (!lines.length) throw new Error('Empty lyrics')
  return { title: String(out.title ?? 'Untitled'), lines }
}

/** Backup bars built from the player's own words. */
async function cannedVerse({ subject, action, adjective, topic }: WriterInputs, bars: number): Promise<GeneratedLyrics> {
    await new Promise((r) => setTimeout(r, 1500)) // keep the loading animation visible
        const all = [
        `I grab the ${subject}, then I ${action} into the night,`,
        `Got ${adjective} words on my tongue and the mic held tight.`,
        `Ask me what I'm after, it's ${topic}, no lie,`,
        `Hear it in my voice and you'll see the fire in my eye.`,
        `A ${adjective} ${subject} in my hands, I ${action} till it's done,`,
        `Stack the bars up high, and I'm second to none.`,
        `${cap(topic)} on the beat, that's the story I tell,`,
        `Hit it ${adjective}, hit it proud, ring the bell.`,
        ]
  return { title: `${cap(adjective)} ${cap(subject)}`, lines: all.slice(0, Math.min(bars, all.length)), fallback: true }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)