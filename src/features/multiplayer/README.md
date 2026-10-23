# Multiplayer (hosting + Gartic-style game)

**Owner:** unassigned

v1 is writing-based: players add lines, each seeing only the previous line, and the robot sings the full song at the reveal. Singing mode comes later. Backend: Supabase Realtime + Postgres (see docs/ARCHITECTURE.md).

Tracker tasks:

- [x] Temporary (anonymous) accounts
- [x] Lobby and room creation backend
- [x] Lobby UI
- [x] Host chooses a beat
- [x] Individual lyric writing
- [x] Gameplay loop of adding on to the previous lyric
- [x] Final results

## How it works

- `/collab` shows the phase from the `rooms` row in Supabase: lobby, writing, reveal.
- Players sign in anonymously (turn on **Anonymous sign-ins** in Supabase). Max 5 per lobby.
- The host's browser is the referee: it moves turns on, fills in a line when time runs out, and starts the reveal. If the host leaves, the lowest seat takes over.
- Run `supabase/migrations/20261023000000_collab_all.sql` (SQL editor or `supabase db push`). It builds every Collab table and wipes the old ones first.
- Limit: members can read every line in the database, so a player who digs in dev tools could peek ahead.

## Rhyme Duel (mic mode)

Pick **Rhyme Duel** in the lobby (exactly 2 players). The host chooses how many words (2 to 8). Each player writes that many ending words for the other in 45 seconds, then both get a 10 second countdown and rap one bar per word over the beat, ending each line with a rhyme of the word they were given.

- Phases: `words` (45 s) -> `rap` (10 s countdown, then the mic) -> `results` (air horn). The host's browser moves them on and fills in default words for anyone who runs out of time. Timer lengths are in `duel/constants.ts`.
- The mic clip is recorded after a 1-bar count-in, turned into a 16 kHz WAV, and sent to the `judge-rap` edge function. Gemini says what the last word of each line was and whether it rhymed.
- "On the beat" is checked in the browser (`duel/rapTiming.ts`): the last syllable of the bar must land from half a beat before beat 4 up to the bar line.
- Points per line: 1 for a rhyme on the beat, 0.5 for a rhyme off the beat, 0 otherwise. Same total is a tie.
- Needs the same migration (it already includes the duel tables) and `supabase functions deploy judge-rap`.
- Use headphones. Without them the mic hears the beat and the timing check gets unreliable.
