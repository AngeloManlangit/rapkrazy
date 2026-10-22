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

const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

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
  const syllables = Math.min(Math.max(Number(body.syllablesPerBar) || 10, 4), 20)

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: 'You are a rap lyricist for a family-friendly party game. Original lyrics only, never quote real songs. No profanity, slurs, or hate. Return JSON only.',
            },
          ],
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text:
                  `Subject (noun): ${subject}\nAction (verb): ${verb}\nAdjective: ${adjective}\nTopic: ${topic}\n\n` +
                  `Write exactly ${bars} bars, about ${syllables} syllables each. Use the subject, action and ` +
                  `adjective at least once each. Keep one rhyme scheme. One bar per item in "lines".`,
              },
            ],
          },
        ],
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

  if (!res.ok) return json({ error: `Gemini ${res.status}` }, 502)

  try {
    const data = await res.json()
    const out = JSON.parse(data.candidates[0].content.parts[0].text)
    const lines = (out.lines ?? []).map((l: unknown) => String(l).trim()).filter(Boolean).slice(0, bars)
    if (!lines.length) return json({ error: 'Empty lyrics' }, 502)
    return json({ title: String(out.title ?? 'Untitled'), lines })
  } catch {
    return json({ error: 'Bad Gemini reply' }, 502)
  }
})

