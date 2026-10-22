# AI-powered writer

**Owner:** @Lloyalcole (Cole)

Calls the `lyrics` Supabase edge function (Gemini key never in the browser). Falls back to the lyric bank on any error.
The Ghostwrite button in the writing tools opens the panel. Copy `.env.example` to `.env` to turn on real AI.
The edge function lives in `supabase/functions/lyrics`.

Tracker tasks:

- [x] Prompt dialog: subject/noun, action, adjective, what to rap about
- [x] Generate lyrics from the prompt
- [x] Add lyrics onto the writing board
- [x] Loading animation
