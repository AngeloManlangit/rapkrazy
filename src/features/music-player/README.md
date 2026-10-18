# Music player

**Owner:** @dextr5

- **Engine:** `WebAudioBeatClock` in `src/shared/audio/`, exported as the shared `beatClock`. Everyone
  else uses it through `useBeatClock()`; schedule audio with `beatClock.contextTimeAt(trackSeconds)`.
- **UI:** `MusicPlayer.vue` here: details, play/pause, seek ±2/5/10 s, volume, speed. Drop it into a
  page after loading a beat with `beatClock.load(beat)`.
- **Demo:** `/dev/clock`.
- **Beats:** `public/beats/beats.json` (`Beat[]`). The current ones are generated placeholders
  (`node scripts/gen-placeholder-beats.mjs`); replace them by adding files and editing `beats.json`.

Tracker tasks:

- [x] Play chosen song and display song details
- [x] Go back and forward 2/5/10 secs
- [x] Adjust volume
- [x] Adjust speed (pitch shifts with Web Audio playbackRate)
