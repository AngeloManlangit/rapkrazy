# Changelog

What changed in Rapkrazy, newest first. Each entry links to its pull request.

## 2026-10-23

### Added

- **Video export** on /write: "Make a video" under the lyric sheet records the robot rapping your
  lyrics over the beat (drawn on a canvas) and saves it as a video. ([#25])
- **Rhyme tracker** on /write: after a random template, the sticker under each line shows whether
  its rhyme group really rhymes (perfect, slant or miss), using RiTa for pronunciations. ([#25])
- Template generator themes: comeup, culture, hood and rivalry, plus a bigger flex theme.
  Templates are now 3 rhymed stanzas and follow the Settings lyric mode. ([#25])
- `CHANGELOG.md`. ([#22])
- **Rhyme Duel** in Collab, a 2-player rap battle on the mic. Each player types 2 to 8 ending words
  for the other, then raps one bar per word over the beat, landing a rhyme on beat 4. A `judge-rap`
  edge function (Gemini) hears the last word of each line; the timing check runs in the browser.
  1 point per rhyme on the beat, 0.5 off the beat, ties allowed. ([#21])
- **Main menu** rebuilt in the write-screen style: floating logo with a shine, Write / Collab /
  Settings as ink cards, drifting music notes, and the robot grooving under the logo nonstop. Click
  the robot for a beat and a welcome + Hacktoberfest rap. ([#19])
- **Collab writing game screens** on the write-page layout (robot, notebook, soundboard). The robot
  raps the previous line over its bar when clicked, your line gets the live syllable sticker, and
  the reveal plays the whole song with 🔥 votes and a crown for the top line. ([#18])
- "Writing" and "Next" badges on player seats, a chime when your turn starts, and a warning before
  leaving a game in progress. ([#18])
- **Collab multiplayer** (lobbies with 6-letter codes, up to 5 players, anonymous sign-in), the
  **Settings** page with lyric modes, and `SETUP.md`. ([#15])
- "Made by Devtones" credit on every page. ([#17])

### Changed

- License is now **MIT** (was GPL-3.0). ([#23])
- New site icon (`public/icon.png`). ([#23])
- New dependencies: `rita` (GPL-3.0) and `cmu-pronouncing-dictionary` (ISC). ([#25])
- The `/dev/template-gen` test page was removed. ([#25])
- Collab is **Rhyme Duel only** for now; the line-by-line writing game is hidden in the waiting
  room (commented out in `WaitingRoom.vue`). ([#21])
- Supabase setup is one migration, `20261023000000_collab_all.sql`, which drops and rebuilds every
  Collab table. ([#21])
- Music player beat meter: colored ink pills that jump and glow on their beat. ([#20])
- Host / Join lobby titles use cel-gradient lettering with a shine. ([#20])
- Lobby cards and the waiting room animate (drop-in, hover lift, pulsing buttons), and the top bar
  links to the pages you're not on. ([#16], [#18])
- The AI ghostwriter is told how many syllables fit one bar at the beat's tempo. ([#17])
- Settings: "Explicit" is now "Ghetto mode". ([#17])
- `/dev/*` test pages only exist in `npm run dev`. ([#17])
- The notebook sheet and bar rows are shared components, used by /write and Collab. ([#18])

### Fixed

- A player leaving mid-game no longer shifts the turn order. A writer who left is skipped after a
  few seconds, and a host who left is replaced. ([#18])
- Opening Collab no longer drops you into your last lobby; only a refresh rejoins. ([#17])
- The robot's speech-bubble tail was invisible on the night sky. ([#20])
- Lobby cards no longer blink out when the mouse leaves them. ([#18])

## 2026-10-22

### Added

- **Write page**: music player with CHOOSE SONG, lyric notebook with beat dots and syllable
  stickers, the robot rapping each line on its bar, random template and AI buttons, and a
  soundboard. ([#13])
- osu!-style song select with custom songs (your own audio file, BPM with tap tempo, saved in the
  browser). ([#13])
- **AI ghostwriter**: a panel that asks for a noun, verb, adjective and topic and writes bars
  through a Supabase edge function calling Gemini. ([#14])

### Fixed

- `npm run check` failing on main (unused import), a stray `"24"` dependency, and the Settings
  hover on the menu. ([#13])

## 2026-10-21

### Added

- Main menu UI: logo, WRITE / COLLAB / SETTINGS titles, city background. ([#12])
- Random lyrics template generator (Tracery, with blanks to fill in). ([#11])

## 2026-10-20

### Added

- Music player on the Web Audio API: the shared beat clock, play / pause / seek / volume / speed,
  and 3 placeholder beats. ([#8])
- The robot raps in sync with the beat clock. ([#9])

### Changed

- The PR template no longer links an issue (tasks live in the team Google Doc). ([#7])

## 2026-10-15

### Added

- Project foundation: Vue 3 + Vite + TypeScript, shared types and audio contracts, feature folders,
  lint / format setup, and the architecture doc. ([#2])
- Robot voice with eSpeak-NG. ([#3])
- Tailwind CSS. ([#6])
- Dev tool links on the home page in dev mode. ([#5])

### Changed

- README states the real Node requirement, plus `.nvmrc`. ([#4])

[#2]: https://github.com/AngeloManlangit/rapkrazy/pull/2
[#3]: https://github.com/AngeloManlangit/rapkrazy/pull/3
[#4]: https://github.com/AngeloManlangit/rapkrazy/pull/4
[#5]: https://github.com/AngeloManlangit/rapkrazy/pull/5
[#6]: https://github.com/AngeloManlangit/rapkrazy/pull/6
[#7]: https://github.com/AngeloManlangit/rapkrazy/pull/7
[#8]: https://github.com/AngeloManlangit/rapkrazy/pull/8
[#9]: https://github.com/AngeloManlangit/rapkrazy/pull/9
[#11]: https://github.com/AngeloManlangit/rapkrazy/pull/11
[#12]: https://github.com/AngeloManlangit/rapkrazy/pull/12
[#13]: https://github.com/AngeloManlangit/rapkrazy/pull/13
[#14]: https://github.com/AngeloManlangit/rapkrazy/pull/14
[#15]: https://github.com/AngeloManlangit/rapkrazy/pull/15
[#16]: https://github.com/AngeloManlangit/rapkrazy/pull/16
[#17]: https://github.com/AngeloManlangit/rapkrazy/pull/17
[#18]: https://github.com/AngeloManlangit/rapkrazy/pull/18
[#19]: https://github.com/AngeloManlangit/rapkrazy/pull/19
[#20]: https://github.com/AngeloManlangit/rapkrazy/pull/20
[#21]: https://github.com/AngeloManlangit/rapkrazy/pull/21
[#22]: https://github.com/AngeloManlangit/rapkrazy/pull/22
[#23]: https://github.com/AngeloManlangit/rapkrazy/pull/23
[#25]: https://github.com/AngeloManlangit/rapkrazy/pull/25
