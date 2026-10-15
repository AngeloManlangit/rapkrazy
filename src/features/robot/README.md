# Singing robot

**Owners:** @dextr5 (voice + beat sync), @AngeloManlangit (sprites + animation)

Voice: `EspeakVoice.ts` implements `RobotVoice` with the vendored eSpeak-NG worker
(`public/vendor/espeakng/`). `rapPlan.ts` splits a `LyricLine` into chunks placed on beat slots.
Test page: `/dev/robot` (synthesized drums, rate/pitch/voice/variant controls).

```ts
const voice = new EspeakVoice()
const audio = await voice.synth('beep boop', { voice: 'en-us+croak', speed: 250, pitch: 40 })
```

Tracker tasks:

- [ ] Robot animation when he sings / idle / writing
- [ ] Clicking makes him sing the written lyrics
- [ ] Sings with the chosen beat
