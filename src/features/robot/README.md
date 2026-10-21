# Singing robot

**Owners:** @dextr5 (voice + beat sync), @AngeloManlangit (sprites + animation)

- `EspeakVoice.ts` implements `RobotVoice` with the vendored eSpeak-NG worker
  (`public/vendor/espeakng/`).
- `rapPlan.ts` splits a `LyricLine` into chunks placed on beat slots.
- `RobotRapper.ts` raps lines in sync with the shared `beatClock`: whenever the music player
  plays, the robot plays along, following pause, seek and speed.
- Test page: `/dev/robot` (real beats, music player, voice/variant/speed/pitch controls, karaoke).

```ts
const rapper = new RobotRapper(new EspeakVoice())
rapper.options = { voice: 'en-us+croak', speed: 250, pitch: 40 }
rapper.start()
await rapper.setLines(lines) // LyricLine[] from the writing board; call again after edits
beatClock.play() // from a click handler

// Karaoke / mouth animation: which chunk is sounding right now
const chunk = rapper.chunkAt(beatClock.currentTime()) // { lineId, text, start, slot } | null
```

Tracker tasks:

- [ ] Robot animation when he sings / idle / writing
- [ ] Clicking makes him sing the written lyrics (`RobotRapper` is ready; needs the writing board)
- [x] Sings with the chosen beat
