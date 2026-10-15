# Rapkrazy architecture

Originally written Oct 10, 2026 (@dextr5). Updated Oct 14 with team decisions.

## Overview

Rapkrazy is a browser game where you write lyrics to a beat, and a robot (or you) performs them.
It has one product with two modes:

- **Single-player (writing tool):** pick a beat, write with Mad Libs help and a flow meter, hear
  the robot rap your draft, then optionally record yourself.
- **Multiplayer (party game):** Gartic Phone meets skribbl.io. Players take turns adding lyrics
  under a theme that clashes with the beat, each seeing only the previous part, then everyone
  hears the robot perform the finished song.

Pitch line: "Mad Verse City meets Gartic Phone." The robot is the default performer, and
human singing is the planned upgrade.

**Architecture in one line:** a static web app runs in each player's browser and does all audio
work. Supabase relays turns and stores data, and one edge function talks to the AI. There is no
game server to run.

## Decisions log

| Date | Decision |
| --- | --- |
| Oct 14 | Multiplayer v1 is **writing-based** (tracker version). Singing/recording turns (telephone twist on audio) come after v1 works. |
| Oct 14 | Frontend is Vue 3 + Vite + TypeScript (repo template). |
| Oct 14 | SAM rejected for robot TTS: no license, so we have no rights to use it. |
| open | Robot TTS engine: eSpeak-NG (leading) or Kokoro. See [Robot voice](#robot-voice). |

## Tech stack

All on free tiers at hackathon scale.

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | Vue 3 + Vite (TypeScript) | Fast to build, static deploy |
| Hosting | Vercel | Free, HTTPS by default (browsers require HTTPS for mic access) |
| Rooms and turns | Supabase Realtime (broadcast + presence) | No WebSocket server to run or keep awake |
| Data | Supabase Postgres | Rooms, verses, lyric bank, themes |
| Voice clips (later) | Supabase Storage | Small compressed clips, one bucket |
| AI calls | Supabase Edge Function → Gemini API | Keeps the API key out of the browser |
| Playback and mixing | Web Audio API | Sample-accurate scheduling at bar positions |
| Recording (later) | MediaRecorder + getUserMedia | Built into every modern browser |
| Robot voice | TTS that returns audio data | Needed so robot audio can be mixed and exported |
| Video export (stretch) | `<canvas>` + `captureStream()` + MediaRecorder | All in the browser, no server cost |

Alternative backend: Node + Socket.IO (how skribbl.io works). More control, but you must host
it, it sleeps on free tiers, and audio needs separate storage. Only worth it if a teammate
already knows Socket.IO well.

The only server-side code is the edge function, which holds the Gemini key (and a TTS key, if
we pick a cloud TTS). Everything else talks to Supabase directly with the public anon key,
protected by row-level security.

## Game modes and user flows

Single-player is built first. Multiplayer reuses all of its pieces and adds Realtime.

### Single-player (writing tool)

1. Player clicks **Write**.
2. Picks a beat from the catalog (or spins theme roulette for a random theme on a random beat).
3. The writing board opens: lines mapped to bars, a flow meter showing syllables per bar,
   rhymes highlighted.
4. Player writes lyrics, using optional helpers:
   - Mad Libs template (template generator / lyric bank)
   - AI writer (subject, action, adjective, topic → lyrics)
   - Rhyme assist (limited uses per verse)
   - Forced-word challenge
5. Player taps the robot to hear the draft rapped on beat, then edits until it flows.
6. Soundboard for sound effects at any time.
7. Optional: record yourself over the beat, with the robot as a mutable guide track.
8. Export a video (stretch) or keep writing.

Solo extras if time allows: AI telephone (the robot "mishears" your verse and you continue from
the misheard version) and robot battle (the AI writes a reply verse roasting yours).

### Multiplayer v1 (writing-based)

1. Host creates a room and shares the 6-letter code; up to 5 players join. The lobby shows who
   is in.
2. Host picks the lyric mode: free write + forced word (default), Mad Libs, or Chaos (AI writes,
   players tweak).
3. Host picks the beat (or players vote).
4. A player picks a theme from 3 cards **without seeing the beat**, so mismatches happen
   naturally.
5. Turns: each player writes their lines (e.g. 2–4 bars), seeing **only the previous player's
   last line**. A timer keeps it moving.
6. Reveal: the full lyrics scroll karaoke-style while the robot raps the whole song over the beat.
7. Awards: quick votes such as Best bar, Most unhinged, Most committed to the bit.

### Multiplayer v2 (singing, after v1)

Same loop, but each player **records** their verse and the next player hears only the previous
recording, not its written lyrics (the telephone twist). Anyone who won't sing gets the robot.
Reveal plays the stitched recordings. Built on the recording pipeline from single-player step 7.

### Asynchronous chains (later)

A solo player shares a link to their verse, and a friend adds the next verse whenever they like.
Same storage and verse records.

## Multiplayer turn flow

The host's browser runs the loop (the "referee"): it starts turns, enforces timeouts, and starts
the reveal. Each turn hands the next player only what they're allowed to see.

Realtime events: `turn_started` when the host starts a turn, `verse_submitted` when a player
finishes (v2: `clip_ready` after upload), `player_skipped` on a timeout (the robot or the AI
fills in), and `reveal_started` after the last turn. A player who refreshes reloads the room and
verses from the database and rejoins the current turn.

## Audio engine

The hardest part and the core of the game. Build and test it first, on one device. **Everything
is scheduled in bars, not seconds.** Contracts: `src/shared/audio/`.

### Beat timing

- Each beat has metadata: `bpm`, `beatsPerBar` (usually 4), `offsetMs` (silence before beat 1),
  `totalBars`.
- Bar length in seconds = `60 / bpm * beatsPerBar`. Bar N starts at `offset + N * barLength`.
- Load beats into an `AudioBuffer` and play with `AudioBufferSourceNode.start(when)`, never an
  `<audio>` tag, so every sound shares the `AudioContext` clock.
- Speed control: `playbackRate` on a buffer source also shifts pitch. Accepted (chipmunk beats
  fit the game). Pitch-preserving speed only exists on `<audio>` elements, which break sync.

### Recording a verse (single-player step 7, multiplayer v2)

1. Ask for the mic with `getUserMedia({ audio: { echoCancellation: false, noiseSuppression:
   false, autoGainControl: false } })`. Processing mangles singing.
2. Play a one-bar count-in, then the beat from the verse's start bar.
3. Start MediaRecorder at the count-in and store the AudioContext time the first bar begins.
4. Show lyrics karaoke-style, highlighting the current line from the same clock.
5. Stop at the verse's last bar, then save the clip with `startBar` and measured `latencyMs`.
6. Let the player preview and re-record once before submitting.

### Latency

Recordings arrive slightly late because of input and output delay. Calibrate on first use (player
claps on 4 clicks; average the delay) and subtract it when placing the clip. Small leftover drift
is acceptable and arguably funny.

### The reveal mix

1. Decode every clip (or robot chunk) into an `AudioBuffer`.
2. Start the beat at time T.
3. Schedule each clip at `T + startBar * barLength - latency`.
4. Drive visuals (current writer, lyrics, robot animation) from `AudioContext.currentTime`.

All mixing happens in the browser.

### Practical rules

- Ask players to wear headphones when recording, otherwise the beat bleeds in.
- Record compressed audio (Opus/WebM, or AAC/MP4 on Safari). Check
  `MediaRecorder.isTypeSupported`.
- Create or resume the `AudioContext` inside a click handler. Browsers block audio that starts
  without a user gesture.
- Test on a real iPhone early. Safari is strictest about mic permissions and audio formats.

## Robot voice

The TTS must return real audio data, not the browser's built-in `speechSynthesis`.
`speechSynthesis` plays straight to the speakers: it can't be routed through Web Audio
(no volume/effects/mixing), its start delay and duration are unpredictable so it can't land on
the beat, the voice differs per device/OS, and it is invisible to `MediaRecorder`, so the robot
would be silent in video export.

### Candidates

| Option | Sound | Size / cost | Notes |
| --- | --- | --- | --- |
| eSpeak-NG ([engine](https://github.com/espeak-ng/espeak-ng), [browser build](https://github.com/espeak-ng/espeak-ng/tree/master/emscripten), [npm wrapper](https://github.com/ianmarmour/espeak-ng.js)) | Robotic | ~3.2 MB with all voices (per upstream README) | **Leading.** GPL-3.0, same as this repo. Runs in a Web Worker, `synthesize(text, cb(samples))`, rate and pitch settable. Browser builds are old (2017–2023); the engine is active. |
| Kokoro ([hexgrad/kokoro](https://github.com/hexgrad/kokoro), `kokoro-js`) | Natural neural voice | Large model download (size to check) | Apache-2.0. Needs a Web Audio robot effect (bitcrusher/ring mod) to sound robotic. |
| Piper ([piper-tts-web](https://github.com/Mintplex-Labs/piper-tts-web)) | Natural neural voice | Voice model downloaded at runtime (tens of MB) | Skipped for now: wrapper repos have no license file. |
| SAM ([discordier/sam](https://github.com/discordier/sam)) | Classic 1982 C64 robot | ~20 KB | **Rejected:** no license (reverse-engineered commercial software). |
| Cloud TTS via edge function | Natural, many voices | Free tiers, then paid | Needs edge function, key and caching. |

Using a GPL-3.0 or Apache-2.0 engine: keep its license notice in the repo and credit it on the credits page.

### How the robot raps on beat

1. Split each line into chunks (one per beat or half-bar).
2. Synthesize each chunk to an `AudioBuffer`, cached by text, so a line is never generated twice.
3. Schedule each chunk at its beat position via `beatClock.contextTimeAt()`, exactly like
   human vocals.
4. Speed up a chunk with `playbackRate` if it runs past its slot. Choppy and robotic is the
   point.

### The robot character

- Original robot design (no existing characters). Sprites by @AngeloManlangit.
- Animate on beat: head bob on every `onBeat`, mouth open by volume (an `AnalyserNode` on the
  robot's output) or by scheduled chunk times.

## AI features

The AI is a helper and troublemaker, not the main writer. Most rounds use a pre-generated lyric
bank; live AI calls are reserved for small extras, so a rate limit never breaks the demo.

| Feature | When | Source |
| --- | --- | --- |
| Mad Libs skeletons | Start of a verse in Mad Libs mode | Template generator / lyric bank |
| AI writer | Player fills the prompt dialog | Live AI, lyric bank fallback |
| Chaos mode verses | Start of a verse in Chaos mode | Lyric bank, live AI if bank runs out |
| Forced word | Start of each verse | Word list per theme (no AI) |
| Rhyme assist | Player taps the hint button | Live AI, limited uses per verse |
| AI telephone / robot battle (solo) | After a solo verse | Live AI |

### The edge function

One Supabase Edge Function, `lyrics`, is the only code that holds the Gemini API key.

- Actions: `write`, `rhymes`, `skeleton`, `verse`, `mishear`, `battle`.
- Inputs: theme, bpm, bars, syllables per bar, previous line where relevant.
- Ask the model for structured JSON (lines, blanks, syllable counts) so the UI renders it directly.
- System prompt rules: original lyrics only (never quote real songs), family-friendly, match the
  requested syllables per bar.
- Rate-limit per room and per player; cache results.
- On any error or rate limit, fall back to the lyric bank and a canned rhyme list, never an
  error screen.

**Lyric bank:** before the demo, a script calls the same function to generate skeletons and verses
per theme and saves them to `lyric_bank`. Review by hand; this doubles as content moderation.

**Gemini limits:** free-tier per-minute/per-day caps change, so check Google AI Studio. Free-tier
inputs may be used by Google. The free tier is not for commercial use; move to a paid key if the
game is monetized.

## Data model

The database is the source of truth; Realtime only announces changes.

| Table | Key columns | Notes |
| --- | --- | --- |
| `beats` | id, title, file_path, bpm, beats_per_bar, offset_ms, total_bars, vibe | Original or royalty-free only. Single-player reads `public/beats/beats.json` until Supabase exists. |
| `themes` | id, name, forced_words (text[]) | Theme cards and forced-word lists |
| `lyric_bank` | id, theme_id, mode (skeleton / verse), bars, lines (jsonb) | Pre-generated, reviewed by hand |
| `rooms` | id, code (6 letters), host_id, status, mode, beat_id, theme_id, turn_order (uuid[]), current_turn, created_at | status: lobby, picking, playing, reveal, done |
| `players` | id, room_id, name, avatar, joined_at, latency_ms | Anonymous, no accounts |
| `verses` | id, room_id, player_id, turn_index, start_bar, bars, lyrics (jsonb), clip_path (nullable), robot (bool), latency_ms | One row per turn |
| `votes` | id, room_id, voter_id, award, verse_id | End-of-game awards |

Use Supabase anonymous sign-in so each player gets an id without an account, and row-level
security so players only read rooms they joined.

**Storage buckets:** `beats` (public read); `robot` (cached TTS chunks, keyed by text hash, if
synthesized server-side); `clips` (v2, `rooms/{room_id}/{turn_index}.webm`, deleted after 24 h).

### Realtime channel per room: `room:{code}`

| Event | Sent by | Payload |
| --- | --- | --- |
| presence sync | everyone | player id, name, ready |
| `settings_changed` | host | mode, beat_id |
| `theme_picked` | picker | theme_id |
| `turn_started` | host | turn_index, player_id, deadline |
| `verse_submitted` | current player | verse_id |
| `clip_ready` (v2) | current player | verse_id, clip_path |
| `player_skipped` | host | turn_index |
| `reveal_started` | host | start time |
| `vote_cast` | everyone | award, verse_id |

If the host leaves, the earliest-joined remaining player becomes host.

## Video export (stretch)

Records the reveal as it plays: lyrics on one side, the robot rapping on the other, the song as
soundtrack. Entirely in-browser.

1. Render the reveal on a `<canvas>` (1080×1920 vertical or 1280×720).
2. `canvas.captureStream(30)` for video.
3. Route beat + robot (+ vocals) through a `MediaStreamAudioDestinationNode` for audio.
4. Combine both tracks into one `MediaStream` and record with MediaRecorder.
5. Play the song once, stop at the end, offer the file as a download.

Export takes as long as the song (show progress). Keep the tab visible; background tabs throttle.
Prefer MP4 when `MediaRecorder.isTypeSupported('video/mp4')`, else WebM. The robot must use real
TTS audio or it will be silent.

## Deployment and costs

Multiplayer is cheap because turns are sequential and messages are tiny.

| Service | Free tier limits that matter | Our use |
| --- | --- | --- |
| Supabase Realtime | 200 concurrent connections, 2M messages/month | A few dozen players at judging |
| Supabase Storage | 1 GB storage, 5 GB egress, 50 MB max file | Beats + small clips |
| Supabase DB | 500 MB; project **pauses after 1 week inactive** | Small tables |
| Vercel | Generous static hosting | One static app |
| Gemini API | Per-minute and per-day caps | Low, thanks to the lyric bank |

Free plan catches: max 2 active projects (one dev, one demo), no automatic backups (export the
lyric bank), logs kept 1 day.

### Deploy steps

1. Create the Supabase project; run migrations; create buckets; enable anonymous sign-in and RLS.
2. Deploy the `lyrics` edge function with the Gemini key as a Supabase secret.
3. Run the lyric bank script; upload beats.
4. Connect the GitHub repo to Vercel; set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the
   anon key is safe in the browser; the Gemini key never is). `vercel.json` already rewrites all
   routes to `index.html` for client-side routing.
5. Every push to `main` deploys; branches get preview deploys.

**Before judging:** open the Supabase dashboard the day before so the project isn't paused.

Limits as of October 2026; re-check before relying on exact numbers.

## Build order

Build the riskiest part first.

1. **Foundation (done in this PR):** shared types, BeatClock contract + stub, folders, lint.
2. **Music player + catalog:** Web Audio BeatClock, beats manifest, 2–3 placeholder beats.
3. **Single-player core:** writing board with beat-per-line, robot voice on beat, template
   generator, soundboard.
4. **Pass-the-phone multiplayer:** full v1 loop on one device (theme cards, turns, see-only-
   previous-line, robot reveal, awards). Also the backup demo if online rooms break.
5. **Online rooms:** Supabase tables, anonymous auth, Realtime events, host referee.
6. **AI extras:** edge function, AI writer, rhyme assist, forced words, lyric bank.
7. **Polish:** robot animation, sounds, main menu + loading screen, mobile layout, content filter.
8. **Stretch:** recording yourself, multiplayer v2 singing, video export, async chains.

Freeze features before the deadline and spend the last stretch testing the demo path end to end.

## Risks and fallbacks

| Risk | Fallback |
| --- | --- |
| Robot drifts off the beat | Schedule chunks with Web Audio, never timers or `speechSynthesis` |
| Recordings drift (v2) | Latency calibration; small drift is part of the comedy |
| Beat bleeds into recordings | Ask for headphones on the record screen |
| Mic blocked or refused | Robot performs for that player |
| iOS Safari audio quirks | Test on a real iPhone early; start audio only from taps |
| AI rate limit or outage at demo | Lyric bank and canned rhyme lists; never an error screen |
| Player disconnects mid-game | Turn timeout, then robot/AI fills in; state rebuilds from tables |
| Host leaves | Earliest-joined remaining player becomes host |
| Offensive lyrics | Profanity filter on input, clean system prompt, private room codes |
| Copyrighted beats or lyrics | Original or royalty-free beats only; prompt for original lyrics only |
| Supabase project paused | Open the dashboard the day before judging |
| Online rooms break on demo day | Pass-the-phone mode on one device |
| Overlap with Mad Verse City | Lead the pitch with the telephone twist, theme-vs-beat chaos and the reveal |

## After the hackathon

Ship on our own domain plus an itch.io page; consider CrazyGames only once people enjoy the game.

- CrazyGames: Basic Launch (no SDK, no ads) to test, then Full Launch with their SDK.
- Size limit without their SDK is 50 MB (20 MB mobile), so stream beats from storage instead of
  bundling them.
- Games run in an iframe there, so confirm mic recording works in their preview tool.
- A young audience means private rooms, filters and clean AI output matter more.
- Monetizing means a paid AI key and paid TTS if traffic grows.
