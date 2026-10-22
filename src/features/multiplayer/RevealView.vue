<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef } from 'vue'
import { barToSeconds, useBeatClock } from '@/shared/audio'
import type { Beat, LyricLine } from '@/shared/types'
import RobotStage from '@/features/robot/RobotStage.vue'
import { EspeakVoice } from '@/features/robot/EspeakVoice'
import { RobotRapper } from '@/features/robot/RobotRapper'

// The reveal: the whole song with who wrote each line, and the robot raps it over the beat.
// Every player runs their own robot; the beat itself is started by each player's click.

const props = defineProps<{
  lines: { text: string; author: string }[]
  isHost: boolean
  busy: boolean
}>()
const emit = defineEmits<{ again: []; leave: [] }>()

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

const activeBar = computed(() => (isPlaying.value ? position.value.bar : -1))
const idleText = computed(() => {
  if (voiceState.value === 'loading') return 'Warming up...'
  if (voiceState.value === 'error') return 'No voice :('
  return played.value ? 'Again?' : 'Click me!'
})

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
    <RobotStage
      ref="robot"
      class="area-robot"
      :word="word"
      :idle-text="idleText"
      @toggle="toggleRap"
    />

    <section class="song panel ink halftone" aria-label="The finished song">
      <span class="tag">The song</span>
      <ol class="lyrics">
        <li v-for="(l, i) in lines" :key="i" :class="{ now: i === activeBar }">
          <span class="text">{{ l.text }}</span>
          <small class="by">{{ l.author }}</small>
        </li>
      </ol>
      <div class="actions">
        <button
          v-if="isHost"
          class="again ink glint"
          type="button"
          :disabled="busy"
          @click="emit('again')"
        >
          Play again
        </button>
        <p v-else class="wait">The host can start another round.</p>
        <button class="leave" type="button" @click="emit('leave')">Leave lobby</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.reveal {
  display: grid;
  gap: 26px;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.9fr);
  align-items: start;
}
.song {
  --fill: var(--cel-paper);
  display: grid;
  gap: 16px;
  padding: 24px;
  transform: rotate(0.6deg);
}
.lyrics {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 6px;
  max-height: 52vh;
  overflow: auto;
}
.lyrics li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 14px;
  padding: 4px 10px;
  border-radius: 8px;
  color: var(--text-ink);
}
.lyrics li.now {
  background: var(--yellow);
}
.text {
  font: 400 22px/1.4 var(--marker);
  overflow-wrap: anywhere;
}
.by {
  flex: none;
  font-weight: 700;
  color: var(--violet);
}
.actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 18px;
}
.again {
  --fill: var(--cel-pink);
  font-family: var(--display);
  font-size: 20px;
  letter-spacing: 0.06em;
  color: var(--paper);
  text-shadow: 2px 2px 0 var(--ink);
  padding: 12px 28px 9px;
  border-radius: 16px 22px 14px 20px;
  transition: transform 0.2s var(--spring);
}
.again:hover:not(:disabled) {
  transform: rotate(-2deg) scale(1.06);
}
.wait {
  margin: 0;
  color: var(--text-ink);
  font-weight: 700;
}
.leave {
  background: none;
  border: 0;
  padding: 4px;
  color: var(--text-ink);
  font-weight: 700;
  text-decoration: underline;
}
@media (max-width: 900px) {
  .reveal {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
