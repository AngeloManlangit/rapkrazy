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
- Run `supabase/migrations/20261022000000_collab.sql` once (SQL editor or `supabase db push`).
- Limit: members can read every line in the database, so a player who digs in dev tools could peek ahead.
