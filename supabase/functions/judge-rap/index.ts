// Supabase edge function: judges a Rhyme Duel rap.
// Takes a short mic clip (16 kHz mono WAV, base64) and the words the rapper had to rhyme with.
// Returns, for each line, the last word that was heard and whether it rhymes with the target.
// Timing (was it on beat 4?) is checked in the browser, because only the browser knows the beat.

const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash-lite'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

/**
 * Models to try in order. The free tier gives each model its own small daily quota (429) and some
 * models are busy (503) or gone (404), so: retry a busy model, and move on to the next one for
 * quota or unknown-model errors. GEMINI_MODEL, if set, is tried first.
 */
const MODELS = [MODEL, 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'].filter(
  (m, i, all) => all.indexOf(m) === i,
)
const BUSY_STATUS = [500, 502, 503, 504]

/** One generateContent call with retries. Returns the final response (ok or not). */
async function callGemini(apiKey: string, body: unknown): Promise<Response> {
  let res: Response | null = null
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(body),
        },
      )
      if (res.ok) return res
      // 404 (unknown model) and 429 (quota used up) will not get better on this model.
      if (res.status === 404 || res.status === 429) break
      if (!BUSY_STATUS.includes(res.status)) return res
      await new Promise((resolve) => setTimeout(resolve, 600))
    }
  }
  return res!
}

/** A short reason from a failed Gemini reply, for the error message. */
async function reason(res: Response): Promise<string> {
  try {
    const data = await res.json()
    return String(data?.error?.message ?? '').slice(0, 120)
  } catch {
    return ''
  }
}

/** About 20 seconds of 16 kHz 16-bit mono WAV is 640 KB; allow a little more than that in base64. */
const MAX_AUDIO_CHARS = 1_500_000

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

  const audio = String(body.audio ?? '')
  const mimeType = String(body.mimeType ?? 'audio/wav')
  const targets = Array.isArray(body.targets)
    ? body.targets.map((t) => String(t).trim().slice(0, 30)).filter(Boolean)
    : []
  if (!audio || audio.length > MAX_AUDIO_CHARS) return json({ error: 'Bad audio' }, 400)
  if (targets.length < 2 || targets.length > 8)
    return json({ error: 'Need 2 to 8 target words' }, 400)

  const prompt =
    `You are the judge of a rap rhyme battle. The audio is one rapper performing exactly ${targets.length} lines ` +
    `(bars) over a beat, in order, after about one bar of silence or counting. Each line was supposed to ` +
    `end with a word that rhymes with a target word.\n\nTargets, in order:\n` +
    targets.map((t, i) => `${i + 1}. ${t}`).join('\n') +
    `\n\nFor each of the ${targets.length} lines, in order, give "heard": the LAST word the rapper actually said in that line, ` +
    `and "rhymes": true if that word rhymes with the target. A perfect rhyme, a close slant rhyme, and the exact ` +
    `same word all count as true. If a line is missing, unclear, or silent, use "" for heard and false for rhymes. ` +
    `Judge only by how the words sound. Ignore the beat music. Return JSON only.`

  const res = await callGemini(apiKey, {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }, { inlineData: { mimeType, data: audio } }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0,
      responseSchema: {
        type: 'OBJECT',
        properties: {
          lines: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: { heard: { type: 'STRING' }, rhymes: { type: 'BOOLEAN' } },
              required: ['heard', 'rhymes'],
            },
          },
        },
        required: ['lines'],
      },
    },
  })
  if (!res.ok) return json({ error: `Gemini ${res.status}: ${await reason(res)}` }, 502)

  try {
    const data = await res.json()
    const out = JSON.parse(data.candidates[0].content.parts[0].text)
    const lines = Array.from({ length: targets.length }, (_, i) => ({
      heard: String(out.lines?.[i]?.heard ?? '')
        .trim()
        .slice(0, 40),
      rhymes: out.lines?.[i]?.rhymes === true,
    }))
    return json({ lines })
  } catch {
    return json({ error: 'Bad Gemini reply' }, 502)
  }
})
