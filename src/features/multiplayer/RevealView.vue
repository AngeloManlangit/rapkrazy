<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { barToSeconds, useBeatClock } from '@/shared/audio'
import type { Beat, LyricLine } from '@/shared/types'
import NotebookSheet from '@/shared/ui/NotebookSheet.vue'
import BarRow from '@/shared/ui/BarRow.vue'
import RobotStage from '@/features/robot/RobotStage.vue'
import { EspeakVoice } from '@/features/robot/EspeakVoice'
import { RobotRapper } from '@/features/robot/RobotRapper'
import SoundBoard from '@/features/soundboard/SoundBoard.vue'
import { playSfx } from '@/features/soundboard/sfx'

// The reveal, laid out like /write: robot | notebook | soundboard. The whole song with who wrote
// each line; the robot raps it over the beat while the notebook follows along. Everyone gets one
// 🔥 vote for the best line, and the top line gets the crown.

const props = defineProps<{
  lines: { text: string; author: string }[]
  /** Voter id -> line index, live from everyone in the room. */
  votes: Record<string, number>
  me: string
  isHost: boolean
  busy: boolean
}>()
const emit = defineEmits<{ again: []; leave: []; vote: [line: number] }>()

const { clock, isPlaying, position } = useBeatClock()
const rapper = new RobotRapper(new EspeakVoice())
rapper.options = { voice: 'en-us', speed: 250, pitch: 40, slotsPerBeat: 2, squeeze: true }

const beat = shallowRef<Beat | null>(clock.beat)
const offState = clock.onStateChange(() => {
  beat.value = clock.beat
  void prepare()
})

const word = ref('')
const voiceState = ref<'loading' | 'ready' | 'error'>('loading')
const played = ref(false)
const robot = useTemplateRef<InstanceType<typeof RobotStage>>('robot')
const sheet = useTemplateRef<InstanceType<typeof NotebookSheet>>('sheet')

const activeBar = computed(() => (isPlaying.value ? position.value.bar : -1))
const idleText = computed(() => {
  if (voiceState.value === 'loading') return 'Warming up...'
  if (voiceState.value === 'error') return 'No voice :('
  return played.value ? 'Again?' : 'Click me!'
})

/* Votes: counts per line, my pick, and the leader (ties: no crown). */
const counts = computed(() => {
  const c = props.lines.map(() => 0)
  for (const line of Object.values(props.votes)) if (c[line] !== undefined) c[line]++
  return c
})
const myVote = computed(() => props.votes[props.me] ?? -1)
const crown = computed(() => {
  const max = Math.max(0, ...counts.value)
  if (!max) return -1
  const top = counts.value.flatMap((n, i) => (n === max ? [i] : []))
  return top.length === 1 ? top[0]! : -1
})
function vote(i: number) {
  if (i === myVote.value) return
  playSfx('ding')
  emit('vote', i)
}

async function prepare() {
  const lyricLines: LyricLine[] = props.lines.map((l, i) => ({
    id: `l${i}`,
    text: l.text,
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
  if (position.value.bar < 0 || clock.currentTime() >= clock.duration - 0.05)
    clock.seek(barToSeconds(clock.beat, 0))
  void clock.play()
}

/* Keep the line being rapped in view. */
watch(activeBar, (bar) => {
  const box = sheet.value?.list
  const li = box?.children[bar] as HTMLElement | undefined
  if (!box || !li) return
  if (
    li.offsetTop >= box.scrollTop &&
    li.offsetTop + li.offsetHeight <= box.scrollTop + box.clientHeight * 0.75
  )
    return
  box.scrollTo({ top: li.offsetTop - box.clientHeight / 3, behavior: 'smooth' })
})

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
})
</script>

<template>
  <div class="reveal">
    <main class="stage">
      <RobotStage
        ref="robot"
        class="area-robot"
        :word="word"
        :idle-text="idleText"
        @toggle="toggleRap"
      />

      <section class="area-board" aria-label="The finished song">
        <NotebookSheet ref="sheet" title="The song">
          <template #head>
            <button
              class="play ink glint"
              type="button"
              :disabled="voiceState !== 'ready'"
              @click="toggleRap"
            >
              {{ isPlaying ? 'Stop' : played ? 'Play again' : 'Play the song' }}
            </button>
          </template>

          <BarRow
            v-for="(l, i) in lines"
            :key="i"
            :num="i + 1"
            :active="i === activeBar"
            :hit="i === activeBar ? position.beat : -1"
            :style="{ '--i': i }"
            class="song-line"
          >
            <p class="line-text">
              <span v-if="i === crown" class="crown" title="Most fire">👑</span>{{ l.text }}
            </p>
            <p class="by">{{ l.author }}</p>
            <template #sticker>
              <button
                class="fire"
                :class="{ mine: i === myVote, hot: (counts[i] ?? 0) > 0 }"
                type="button"
                :aria-pressed="i === myVote"
                :aria-label="`Vote for line ${i + 1}`"
                @click="vote(i)"
              >
                🔥 <b>{{ counts[i] ?? 0 }}</b>
              </button>
            </template>
          </BarRow>

          <template #footer>
            <div class="actions">
              <p class="tip">Tap 🔥 on your favorite line. One vote each.</p>
              <button
                v-if="isHost"
                class="again ink glint"
                type="button"
                :disabled="busy"
                @click="emit('again')"
              >
                New round
              </button>
              <p v-else class="tip">The host can start another round.</p>
              <button class="leave" type="button" @click="emit('leave')">Leave lobby</button>
            </div>
          </template>
        </NotebookSheet>
      </section>

      <SoundBoard class="area-sound" @hit="!isPlaying && robot?.react('wow', 650)" />
    </main>
  </div>
</template>

<style scoped>
/* Same three columns as /write: robot | notebook | soundboard */
.stage {
  display: grid;
  gap: 26px;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.9fr) minmax(0, 1fr);
  grid-template-areas: 'robot board sound';
  align-items: start;
}
.area-robot {
  grid-area: robot;
  /* stays in view while the song plays */
  position: sticky;
  top: 12px;
}
.area-board {
  grid-area: board;
}
.area-sound {
  grid-area: sound;
}
/* lines land one after another when the reveal opens */
.song-line {
  animation: line-in 0.45s var(--spring) backwards;
  animation-delay: calc(var(--i) * 0.08s);
}
@keyframes line-in {
  from {
    translate: -18px 0;
    opacity: 0;
  }
}
.line-text {
  margin: 0;
  padding: 0 6px;
  font: 400 clamp(17px, 1.4vw, 20px) / 1.35 var(--marker);
  overflow-wrap: anywhere;
}
.by {
  margin: 2px 0 0;
  padding: 0 6px;
  font-size: 12px;
  font-weight: 700;
  opacity: 0.6;
}
.crown {
  display: inline-block;
  margin-right: 6px;
  animation: crown 1s var(--spring) infinite alternate;
}
@keyframes crown {
  to {
    translate: 0 -3px;
    rotate: -10deg;
  }
}
.fire {
  flex: none;
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px 2px;
  border: 0;
  border-radius: 999px 900px 999px 950px;
  background: rgba(255, 255, 255, 0.7);
  box-shadow:
    0 0 0 2.5px var(--ink),
    3px 4px 0 2.5px var(--ink);
  font-family: var(--display);
  color: var(--text-ink);
  filter: grayscale(0.8);
  transition:
    transform 0.2s var(--spring),
    filter 0.2s;
}
.fire.hot {
  filter: none;
}
.fire:hover {
  transform: rotate(-8deg) scale(1.15);
  filter: none;
}
.fire.mine {
  background: var(--yellow);
  filter: none;
  animation: fire-pop 0.45s var(--spring);
}
@keyframes fire-pop {
  40% {
    transform: scale(1.35) rotate(10deg);
  }
}
.play,
.again {
  --fill: var(--cel-pink);
  font-family: var(--display);
  font-size: 19px;
  letter-spacing: 0.05em;
  color: var(--paper);
  text-shadow: 2px 2px 0 var(--ink);
  padding: 10px 22px 8px;
  border-radius: 14px 20px 12px 18px;
  transition: transform 0.2s var(--spring);
}
.play:hover:not(:disabled),
.again:hover:not(:disabled) {
  transform: rotate(-3deg) scale(1.08);
}
.play:disabled,
.again:disabled {
  opacity: 0.5;
}
.actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px 18px;
  margin-top: 10px;
}
.tip {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
}
.leave {
  background: none;
  border: 0;
  padding: 4px;
  color: var(--text-ink);
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 4px;
}
.leave:hover {
  color: #d81b84;
}
@media (max-width: 1000px) {
  .stage {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas:
      'robot sound'
      'board board';
  }
  .area-robot {
    position: static;
  }
}
@media (max-width: 640px) {
  .stage {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'robot' 'board' 'sound';
  }
}
</style>
