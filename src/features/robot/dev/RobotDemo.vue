<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { barToSeconds, useBeatClock } from '@/shared/audio'
import type { Beat, LyricLine } from '@/shared/types'
import { loadBeats } from '@/features/song-catalog/loadBeats'
import MusicPlayer from '@/features/music-player/MusicPlayer.vue'
import { ESPEAK_DEFAULTS, EspeakVoice } from '../EspeakVoice'
import { RobotRapper } from '../RobotRapper'

const { clock } = useBeatClock()
const voice = new EspeakVoice()
const rapper = new RobotRapper(voice)

const lyrics = ref(
  [
    'Metal head bobbing to the boom and the bap',
    'Circuits getting heated when I drop this rap',
    'Beep boop flow so smooth never skip a beat',
    'Robot in the booth with the rhythm in my feet',
  ].join('\n'),
)
const startBar = ref(1)
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
const robotVolume = ref(1)

const beats = ref<Beat[]>([])
const selected = ref('')
const status = ref('Loading…')
const activeLine = ref<string | null>(null)
const activeText = ref('')

const lines = computed<LyricLine[]>(() =>
  lyrics.value
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text, i) => ({ id: `l${i}`, text, bar: startBar.value + i, bars: 1 })),
)

let frame = 0
const poll = () => {
  const chunk = rapper.chunkAt(clock.currentTime())
  activeLine.value = chunk?.lineId ?? null
  activeText.value = chunk?.text ?? ''
  frame = requestAnimationFrame(poll)
}

onMounted(async () => {
  rapper.start()
  frame = requestAnimationFrame(poll)
  try {
    beats.value = await loadBeats()
    if (beats.value[0]) await pick(beats.value[0].id)
    const list = await voice.listVoices()
    // English first, then the rest alphabetically.
    languages.value = list.sort(
      (a, b) =>
        Number(b.code.startsWith('en')) - Number(a.code.startsWith('en')) ||
        a.code.localeCompare(b.code),
    )
  } catch (e) {
    status.value = `Failed to load: ${e}`
  }
})

onBeforeUnmount(() => {
  rapper.stop()
  clock.stop()
  cancelAnimationFrame(frame)
})

async function pick(id: string) {
  const beat = beats.value.find((b) => b.id === id)
  if (!beat) return
  selected.value = id
  await clock.load(beat)
  await prepare()
}

/** Re-plan and synthesize. Runs on any change, so edits are heard on the next pass. */
async function prepare() {
  rapper.options = {
    voice: variant.value ? `${language.value}+${variant.value}` : language.value,
    speed: speed.value,
    pitch: pitch.value,
    slotsPerBeat: slotsPerBeat.value,
    squeeze: squeeze.value,
    wholeLines: mode.value === 'whole',
  }
  status.value = 'Synthesizing…'
  const started = performance.now()
  await rapper.setLines(lines.value)
  status.value = `Ready (synth ${Math.round(performance.now() - started)} ms, cached chunks are instant). Wear headphones or keep volume low.`
}

let debounce: ReturnType<typeof setTimeout> | null = null
watch([lines, speed, pitch, language, variant, mode, slotsPerBeat, squeeze], () => {
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(prepare, 400)
})
watch(robotVolume, (v) => rapper.setVolume(v))

/** Start one bar before the first line so there is a lead-in. */
function rapIt() {
  if (!clock.beat) return
  clock.seek(barToSeconds(clock.beat, Math.max(startBar.value - 1, 0)))
  // play() must run inside this click; synthesis is already running or done.
  clock.play()
}
</script>

<template>
  <main class="demo">
    <h1>Robot voice test (eSpeak-NG)</h1>
    <p class="status">{{ status }}</p>

    <label>
      Beat
      <select :value="selected" @change="pick(($event.target as HTMLSelectElement).value)">
        <option v-for="b in beats" :key="b.id" :value="b.id">{{ b.title }}</option>
      </select>
    </label>

    <label class="lyrics">
      Lyrics (one line per bar)
      <textarea v-model="lyrics" rows="6" />
    </label>

    <div class="grid">
      <label>
        First line on bar {{ startBar + 1 }}
        <input v-model.number="startBar" type="range" min="0" max="8" />
      </label>
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
        Robot vol
        <input v-model.number="robotVolume" type="range" min="0" max="1.5" step="0.05" />
      </label>
    </div>

    <div class="controls">
      <button :disabled="!clock.beat" @click="rapIt">Rap it</button>
    </div>

    <MusicPlayer />

    <ol class="karaoke">
      <li v-for="l in lines" :key="l.id" :class="{ on: l.id === activeLine }">
        {{ l.text }}
        <span v-if="l.id === activeLine" class="word">{{ activeText }}</span>
      </li>
    </ol>
  </main>
</template>

<style scoped>
.demo {
  font-family: system-ui, sans-serif;
  padding: 2rem;
  max-width: 48rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
h1 {
  font-size: 1.5rem;
  font-weight: bold;
}
.status {
  color: #666;
}
select,
textarea {
  border: 1px solid #999;
  font: inherit;
}
.lyrics {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 0.75rem;
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
.controls button {
  border: 1px solid #999;
  border-radius: 0.25rem;
  padding: 0.25rem 1rem;
  font-weight: bold;
}
.karaoke li {
  padding: 0.25rem 0;
}
.karaoke li.on {
  color: #e33;
  font-weight: bold;
}
.word {
  margin-left: 0.5rem;
  padding: 0 0.25rem;
  background: #e33;
  color: white;
}
</style>
