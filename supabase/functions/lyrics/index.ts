// Supabase edge function: turns the player's words into rap bars with Gemini.
// The Gemini key lives in a Supabase secret (GEMINI_API_KEY), never in the browser.

const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

const SYSTEM_FAMILY =
  'You are a rap lyricist for a family-friendly party game. Original lyrics only, never quote real songs. No profanity, slurs, or hate. Return JSON only.'
const SYSTEM_EXPLICIT =
  'You are a battle-rap lyricist for an adult party game. Original lyrics only, never quote real songs. Profanity, cussing and savage trash-talk are welcome. Never use slurs, never attack people for race, religion, gender, sexuality or disability, and never threaten real violence. Keep the insults aimed at the rival in the song. Return JSON only.'

const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

/** Rough English syllable count, same idea as the one in the app. */
function countSyllables(text: string): number {
  let n = 0
  for (const raw of text.toLowerCase().split(/[^a-z']+/)) {
    if (!raw) continue
    const word = raw.replace(/'/g, '').replace(/e$/, '')
    n += Math.max(1, word.match(/[aeiouy]+/g)?.length ?? 0)
  }
  return n
}

/** One Gemini call. Returns null when the reply has no lyrics. */
async function ask(apiKey: string, system: string, text: string, bars: number) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.9,
          responseSchema: {
            type: 'OBJECT',
            properties: { title: { type: 'STRING' }, lines: { type: 'ARRAY', items: { type: 'STRING' } } },
            required: ['title', 'lines'],
          },
        },
      }),
    },
  )
  if (!res.ok) throw new Error(`Gemini ${res.status}`)
  const data = await res.json()
  const out = JSON.parse(data.candidates[0].content.parts[0].text)
  const lines = (out.lines ?? []).map((l: unknown) => String(l).trim()).filter(Boolean).slice(0, bars)
  if (!lines.length) return null
  return { title: String(out.title ?? 'Untitled'), lines }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) return json({ error: 'GEMINI_API_KEY is not set' }, 500)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Bad JSON' }, 400)
  }

  const subject = clean(body.subject, 40)
  const verb = clean(body.verb, 40)
  const adjective = clean(body.adjective, 40)
  const topic = clean(body.topic, 140)
  if (!subject || !verb || !adjective || !topic) return json({ error: 'Missing fields' }, 400)

  const bars = Math.min(Math.max(Number(body.bars) || 8, 1), 16)
  const syllables = Math.min(Math.max(Number(body.syllablesPerBar) || 9, 5), 14)
  const bpm = Math.min(Math.max(Number(body.bpm) || 90, 50), 220)
  const system = body.mode === 'explicit' ? SYSTEM_EXPLICIT : SYSTEM_FAMILY

  const prompt = (note = '') =>
    `Subject (noun): ${subject}
Action (verb): ${verb}
Adjective: ${adjective}
Topic: ${topic}

` +
    `Write exactly ${bars} bars to rap over a beat at ${bpm} BPM, 4 beats per bar. ` +
    `Each bar must have ${syllables} syllables (between ${syllables - 2} and ${syllables + 2} at most). ` +
    `Keep the rhythm steady and even, with stressed syllables landing on the beats, and end every bar on a ` +
    `strong stressed word on beat 4 so the rhyme lands on the beat. Use one clear rhyme scheme (AABB or ABAB). ` +
    `Use the subject, action and adjective at least once each. No run-on lines and no tongue-twisting long words. ` +
    `One bar per item in "lines".${note}`

  try {
    let best: { title: string; lines: string[] } | null = null
    let bestMiss = Infinity
    let note = ''
    for (let attempt = 0; attempt < 2; attempt++) {
      const out = await ask(apiKey, system, prompt(note), bars)
      if (!out) continue
      const miss = out.lines.filter((l) => Math.abs(countSyllables(l) - syllables) > 3).length
      if (miss < bestMiss) {
        best = out
        bestMiss = miss
      }
      if (miss <= Math.floor(out.lines.length / 4)) break
      note = ` Last try some bars were too long or short. Count the syllables and keep each bar at ${syllables}.`
    }
    if (!best) return json({ error: 'Empty lyrics' }, 502)
    return json(best)
  } catch (e) {
    return json({ error: (e as Error).message }, 502)
  }
})

