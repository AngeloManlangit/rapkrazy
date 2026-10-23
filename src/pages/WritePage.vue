<script setup lang="ts">
import '@fontsource/luckiest-guy'
import '@fontsource/permanent-marker'
import '@fontsource/rubik/400.css'
import '@fontsource/rubik/500.css'
import '@fontsource/rubik/700.css'
import '@/shared/ui/ink.css'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { barToSeconds, useBeatClock } from '@/shared/audio'
import type { Beat, LyricLine } from '@/shared/types'
import InkFilters from '@/shared/ui/InkFilters.vue'
import TopBar from '@/shared/ui/TopBar.vue'
import MadeBy from '@/shared/ui/MadeBy.vue'
import PlayerCard from '@/features/music-player/PlayerCard.vue'
import RobotStage from '@/features/robot/RobotStage.vue'
import { EspeakVoice } from '@/features/robot/EspeakVoice'
import { RobotRapper } from '@/features/robot/RobotRapper'
import { syllablesPerBar } from '@/features/writing-board/flow'
import LyricSheet from '@/features/writing-board/LyricSheet.vue'
import WritingTools from '@/features/writing-board/WritingTools.vue'
import { randomTemplate } from '@/features/writing-board/randomTemplate'
import { rhymeStatuses} from '@/features/writing-board/rhymeTracker'
import AiWriterPanel from '@/features/ai-writer/AiWriterPanel.vue'
import SoundBoard from '@/features/soundboard/SoundBoard.vue'
import write1 from '@/assets/write/write-1.webp'
import write2 from '@/assets/write/write-2.webp'

// Single-player page: player + robot | lyric sheet | helpers + soundboard. Line i is rapped on
// bar i of the loaded beat by the eSpeak robot, in sync with the shared beat clock.

const STARTER = [
  'Lyrics go here, ink it on the page',
  'Make it so clear that the robot takes the stage',
  'And then they sing like the city never sleeps',
  'Crazy',
  'Neon on the block and the bass line deep',
]

const { clock, isPlaying, position } = useBeatClock()
const rapper = new RobotRapper(new EspeakVoice())
rapper.options = { voice: 'en-us', speed: 250, pitch: 40, slotsPerBeat: 2, squeeze: true }

const beat = shallowRef<Beat | null>(clock.beat)
const offState = clock.onStateChange(() => (beat.value = clock.beat))

const lines = ref<string[]>(sized(STARTER, 8))
const word = ref('')
const gazeTarget = ref<HTMLElement | null>(null)
const voiceState = ref<'loading' | 'ready' | 'error'>('loading')
const played = ref(false)
const robot = useTemplateRef<InstanceType<typeof RobotStage>>('robot')

const toastText = ref('')
const toastShown = ref(false)

const groups = ref<(string | null)[]>(Array(lines.value.length).fill(null))
const rhymes = computed(() => rhymeStatuses(lines.value, groups.value,))

let toastTimer: ReturnType<typeof setTimeout> | undefined
function toast(msg: string) {
  toastText.value = msg
  toastShown.value = true
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toastShown.value = false), 2600)
}

/** Pad with empty lines or trim to `n`, keeping what was written. */
function sized(list: string[], n: number): string[] {
  return Array.from({ length: n }, (_, i) => list[i] ?? '')
}

/** One line per bar of the beat (capped so long tracks don't make an endless sheet). */
watch(beat, (b) => {
  if (b) {
    const n = Math.min(b.totalBars, 16)
    lines.value = sized(lines.value, n)
    groups.value = Array.from({ length: n }, (_, i) => groups.value[i] ?? null) //matches with padded lines
  }
})

const activeBar = computed(() => (isPlaying.value ? position.value.bar : -1))
const idleText = computed(() => {
  if (voiceState.value === 'loading') return 'Warming up…'
  if (voiceState.value === 'error') return 'No voice :('
  return played.value ? 'Again?' : 'Click me!'
})

/* Re-plan and synthesize after edits or a beat change; chunks are cached, so this is cheap. */
let debounce: ReturnType<typeof setTimeout> | undefined
async function prepare() {
  const lyricLines: LyricLine[] = lines.value.map((text, i) => ({
    id: `l${i}`,
    text,
    bar: i,
    bars: 1,
  }))
  try {
    await rapper.setLines(lyricLines)
    voiceState.value = 'ready'
  } catch (e) {
    console.error('Robot voice failed', e)
    voiceState.value = 'error'
  }
}
watch([lines, beat], () => {
  clearTimeout(debounce)
  debounce = setTimeout(prepare, 400)
})

/* The word being sung right now, for the bubble and the robot's squint and head tilt. */
let frame = 0
const poll = () => {
  word.value = clock.isPlaying ? (rapper.chunkAt(clock.currentTime())?.text ?? '') : ''
  frame = requestAnimationFrame(poll)
}

function toggleRap() {
  if (clock.isPlaying) {
    clock.pause()
    return
  }
  if (!clock.beat) return
  played.value = true
  // From the top unless the player was mid-song; play() must stay inside this click.
  if (position.value.bar < 0 || clock.currentTime() >= clock.duration - 0.05)
    clock.seek(barToSeconds(clock.beat, 0))
  clock.play()
}

const aiWriter = useTemplateRef<InstanceType<typeof AiWriterPanel>>('aiWriter')

/** Put the AI bars on the lyric sheet, one per bar. */
function onAiLyrics(payload: { title: string; lines: string[] }) {
  lines.value = sized(payload.lines, lines.value.length)
  groups.value = groups.value.map(() => null)
  robot.value?.react('happy', 1200)
  toast(`"${payload.title}" added to the sheet`)
}

function loadTemplate() {
  try {
    const n = lines.value.length
    const t = randomTemplate()
    lines.value = sized(t.lines, n)
    groups.value = Array.from({ length: n }, (_, i) => t.groups[i] ?? null) //the padded lines
    robot.value?.react('happy', 1200)
    toast('Template loaded: replace the [blanks]')
  } catch (e) {
    console.error('Template generator failed', e)
    toast('The template generator hiccuped, try again')
  }
}

onMounted(() => {
  rapper.start()
  frame = requestAnimationFrame(poll)
  void prepare()
})
onBeforeUnmount(() => {
  rapper.stop()
  clock.pause()
  offState()
  cancelAnimationFrame(frame)
  clearTimeout(debounce)
  clearTimeout(toastTimer)
})
</script>

<template>
  <div class="rk">
    <InkFilters />
    <div class="wrap">
      <TopBar title="Write" :frames="[write1, write2]" />

      <main class="stage">
        <PlayerCard class="area-player" @picked="(b) => toast(`${b.title} loaded`)" />
        <RobotStage
          ref="robot"
          class="area-robot"
          :word="word"
          :gaze-target="gazeTarget"
          :idle-text="idleText"
          @toggle="toggleRap"
        />
        <section class="area-board" aria-label="Lyric sheet">
          <LyricSheet
            v-model:lines="lines"
            :rhymes="rhymes"
            :groups="groups"
            :active-bar="activeBar"
            :beat="position.beat"
            :beats-per-bar="beat?.beatsPerBar ?? 4"
            @focus-line="gazeTarget = $event"
          />
        </section>
        <WritingTools class="area-tools" @template="loadTemplate" @ghostwriter="aiWriter?.open()" />
        <AiWriterPanel
          ref="aiWriter"
          :bars="lines.length"
          :bpm="beat?.bpm"
          :syllables-per-bar="beat ? syllablesPerBar(beat.bpm, beat.beatsPerBar) : undefined"
          @add-to-board="onAiLyrics"
        />
        <SoundBoard
          class="area-sound"
          @hit="!isPlaying && robot?.react('wow', 650)"
          @add="toast('Adding your own sounds is coming soon')"
        />
      </main>
      <footer class="credit"><MadeBy /></footer>
    </div>
    <div class="toast" :class="{ show: toastShown }" role="status">{{ toastText }}</div>
  </div>
</template>

<style scoped>
.wrap {
  max-width: 1280px;
  margin: 0 auto;
  padding-block: 14px 40px;
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px));
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.stage {
  display: grid;
  gap: 26px;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.9fr) minmax(0, 1fr);
  grid-template-areas:
    'player board tools'
    'robot  board sound';
  align-items: start;
}
.area-player {
  grid-area: player;
}
.area-robot {
  grid-area: robot;
}
.area-board {
  grid-area: board;
}
.area-tools {
  grid-area: tools;
}
.area-sound {
  grid-area: sound;
}
.credit {
  display: flex;
  justify-content: center;
  padding-top: 8px;
}
.toast {
  position: fixed;
  left: 50%;
  bottom: calc(18px + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%) rotate(-1deg) translateY(20px);
  background: var(--ink);
  color: var(--yellow);
  border-radius: 14px 20px 12px 18px;
  box-shadow:
    0 0 0 3px var(--yellow),
    6px 7px 0 3px var(--pink);
  padding: 10px 16px;
  font-weight: 500;
  max-width: calc(100% - 32px);
  text-align: center;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.2s,
    transform 0.3s var(--spring);
}
.toast.show {
  opacity: 1;
  transform: translateX(-50%) rotate(-1deg) translateY(0);
}
@media (max-width: 1000px) {
  .stage {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas:
      'player robot'
      'board board'
      'tools sound';
  }
}
@media (max-width: 640px) {
  .stage {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'player' 'board' 'robot' 'tools' 'sound';
    gap: 34px;
  }
}
</style>
