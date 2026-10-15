<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { barDuration, beatDuration } from '@/shared/audio'
import type { Beat, LyricLine } from '@/shared/types'
import { ESPEAK_DEFAULTS, EspeakVoice } from '../EspeakVoice'
import { planLine, planWholeLine, type RapChunk } from '../rapPlan'
import { drumBar } from './drums'

const voice = new EspeakVoice()

const lyrics = ref(
  [
    'Metal head bobbing to the boom and the bap',
    'Circuits getting heated when I drop this rap',
    'Beep boop flow so smooth never skip a beat',
    'Robot in the booth with the rhythm in my feet',
  ].join('\n'),
)
const bpm = ref(90)
const speed = ref(250)
const pitch = ref(40)
const language = ref<string>(ESPEAK_DEFAULTS.voice)
const languages = ref<{ code: string; name: string }[]>([
  { code: ESPEAK_DEFAULTS.voice, name: 'english-us' },
])
// eSpeak-NG voice variants bundled in the build; appended as `en-us+croak`.
const VARIANTS = [
  '',
  'croak',
  'klatt',
  'klatt2',
  'klatt3',
  'whisper',
  'm1',
  'm2',
  'm3',
  'm4',
  'm5',
  'm6',
  'm7',
  'f1',
  'f2',
  'f3',
  'f4',
  'f5',
]
const variant = ref('')
const mode = ref<'chunked' | 'whole'>('chunked')
const slotsPerBeat = ref(2)
const squeeze = ref(true)
const beatVolume = ref(0.6)
const voiceVolume = ref(1)

const status = ref('Loading eSpeak-NG…')
const playing = ref(false)
const currentLine = ref(-1)

const lines = computed<LyricLine[]>(() =>
  lyrics.value
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)
    // Bar 0 is the count-in.
    .map((text, i) => ({ id: `l${i}`, text, bar: i + 1, bars: 1 })),
)

let ctx: AudioContext | null = null
let beatGain: GainNode | null = null
let voiceGain: GainNode | null = null
let nodes: AudioScheduledSourceNode[] = []
let raf = 0
let endTimer: ReturnType<typeof setTimeout> | null = null

onMounted(async () => {
  try {
    const list = await voice.listVoices()
    // English first, then the rest alphabetically.
    languages.value = list.sort(
      (a, b) =>
        Number(b.code.startsWith('en')) - Number(a.code.startsWith('en')) ||
        a.code.localeCompare(b.code),
    )
    status.value = 'Ready. Wear headphones or keep volume low.'
  } catch (e) {
    status.value = `Failed to load eSpeak-NG: ${e}`
  }
})

onBeforeUnmount(() => {
  stop()
  ctx?.close()
})

async function play() {
  // AudioContext must be created/resumed inside the click handler.
  ctx ??= new AudioContext()
  await ctx.resume()
  stop()

  const beat: Beat = {
    id: 'dev',
    title: 'Dev boom-bap',
    creator: 'rapkrazy',
    file: '',
    bpm: bpm.value,
    beatsPerBar: 4,
    offsetMs: 0,
    totalBars: lines.value.length + 1,
  }
  const chunks: RapChunk[] = lines.value.flatMap((l) =>
    mode.value === 'whole' ? planWholeLine(l, beat) : planLine(l, beat, slotsPerBeat.value),
  )

  status.value = `Synthesizing ${chunks.length} chunks…`
  const started = performance.now()
  const voiceName = variant.value ? `${language.value}+${variant.value}` : language.value
  const options = { voice: voiceName, speed: speed.value, pitch: pitch.value }
  const buffers = await Promise.all(chunks.map((c) => voice.synth(c.text, options)))
  status.value = `Synthesized in ${Math.round(performance.now() - started)} ms (cached chunks are instant).`

  beatGain = ctx.createGain()
  beatGain.gain.value = beatVolume.value
  beatGain.connect(ctx.destination)
  voiceGain = ctx.createGain()
  voiceGain.gain.value = voiceVolume.value
  voiceGain.connect(ctx.destination)

  const t0 = ctx.currentTime + 0.2
  const barLen = barDuration(beat)
  for (let bar = 0; bar < beat.totalBars; bar++) {
    nodes.push(...drumBar(ctx, beatGain, t0 + bar * barLen, beatDuration(beat), bar === 0))
  }

  chunks.forEach((chunk, i) => {
    const src = ctx!.createBufferSource()
    src.buffer = buffers[i]!
    if (squeeze.value && src.buffer.duration > chunk.slot) {
      // Speed up (and pitch up) chunks that would spill into the next slot. Capped at 2x.
      src.playbackRate.value = Math.min(src.buffer.duration / chunk.slot, 2)
    }
    src.connect(voiceGain!)
    src.start(t0 + chunk.start)
    nodes.push(src)
  })

  playing.value = true
  const tick = () => {
    const t = ctx!.currentTime - t0
    currentLine.value = Math.floor(t / barLen) - 1
    raf = requestAnimationFrame(tick)
  }
  tick()
  endTimer = setTimeout(stop, (beat.totalBars * barLen + 0.5) * 1000)
}

function stop() {
  nodes.forEach((n) => {
    try {
      n.stop()
    } catch {
      // Already stopped.
    }
  })
  nodes = []
  beatGain?.disconnect()
  voiceGain?.disconnect()
  cancelAnimationFrame(raf)
  if (endTimer) clearTimeout(endTimer)
  playing.value = false
  currentLine.value = -1
}

function setGain(node: GainNode | null, value: number) {
  if (node) node.gain.value = value
}
</script>

<template>
  <main class="demo">
    <h1>Robot voice test (eSpeak-NG)</h1>
    <p class="status">{{ status }}</p>

    <label class="lyrics">
      Lyrics (one line per bar)
      <textarea v-model="lyrics" rows="6" :disabled="playing" />
    </label>

    <div class="grid">
      <label>BPM {{ bpm }} <input v-model.number="bpm" type="range" min="60" max="160" /></label>
      <label>
        Speed {{ speed }} wpm
        <input v-model.number="speed" type="range" min="80" max="450" />
      </label>
      <label
        >Pitch {{ pitch }} <input v-model.number="pitch" type="range" min="0" max="99"
      /></label>
      <label>
        Language
        <select v-model="language">
          <option v-for="l in languages" :key="l.code" :value="l.code">
            {{ l.code }} ({{ l.name }})
          </option>
        </select>
      </label>
      <label>
        Variant
        <select v-model="variant">
          <option v-for="v in VARIANTS" :key="v" :value="v">{{ v || 'default' }}</option>
        </select>
      </label>
      <label>
        Delivery
        <select v-model="mode">
          <option value="chunked">Chunked on beat</option>
          <option value="whole">Whole line</option>
        </select>
      </label>
      <label v-if="mode === 'chunked'">
        Chunks
        <select v-model.number="slotsPerBeat">
          <option :value="1">Up to 1 per beat</option>
          <option :value="2">Up to 2 per beat (8ths)</option>
        </select>
      </label>
      <label class="check">
        <input v-model="squeeze" type="checkbox" /> Squeeze long chunks to fit
      </label>
      <label>
        Beat vol
        <input
          v-model.number="beatVolume"
          type="range"
          min="0"
          max="1"
          step="0.05"
          @input="setGain(beatGain, beatVolume)"
        />
      </label>
      <label>
        Robot vol
        <input
          v-model.number="voiceVolume"
          type="range"
          min="0"
          max="1.5"
          step="0.05"
          @input="setGain(voiceGain, voiceVolume)"
        />
      </label>
    </div>

    <div class="controls">
      <button :disabled="playing" @click="play">Rap it</button>
      <button :disabled="!playing" @click="stop">Stop</button>
    </div>

    <ol class="karaoke">
      <li v-for="(l, i) in lines" :key="l.id" :class="{ on: i === currentLine }">{{ l.text }}</li>
    </ol>
  </main>
</template>

<style scoped>
.demo {
  font-family: system-ui, sans-serif;
  padding: 2rem;
  max-width: 48rem;
}
.status {
  color: #666;
}
.lyrics {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
textarea {
  font: inherit;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 0.75rem;
  margin: 1rem 0;
}
.grid label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.grid label.check {
  flex-direction: row;
  align-items: center;
}
.controls {
  display: flex;
  gap: 0.5rem;
}
.karaoke li {
  padding: 0.25rem 0;
  transition: color 0.1s;
}
.karaoke li.on {
  color: #e33;
  font-weight: bold;
}
</style>
