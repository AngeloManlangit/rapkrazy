<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useBeatClock } from '@/shared/audio'
import type { DuelResult } from '@/shared/types'
import CountdownBar from '../CountdownBar.vue'
import BeatCounter from './BeatCounter.vue'
import { PRE_RAP_SECONDS } from './constants'
import { decodeMono, recordRap, toWavBase64 } from './rapAudio'
import { judgeRap } from './judgeRap'
import { analyzeBars, type BarTiming } from './rapTiming'

// Rhyme Duel, step 2. After both players lock in their words there is a 10 second countdown, then
// the rap starts by itself (or right away if you press Start rapping). The mic records a count-in
// bar plus one bar per word, with a beat counter leading to the last beat of each bar, where the
// rhyme has to land. Then the clip is judged.

const props = defineProps<{
  me: string
  opponentName: string
  /** The words the opponent wrote, in line order. One bar each. */
  targets: string[]
  /** Seconds left in the countdown before the rap starts by itself. */
  secondsLeft: number
  /** True once this player's result is saved. */
  done: boolean
  /** Saves the result for everyone. */
  save: (result: DuelResult) => Promise<void>
}>()

const { clock, position } = useBeatClock()

type Step = 'ready' | 'recording' | 'judging'
const step = ref<Step>('ready')
const bar = ref(-1)
const error = ref('')
let cancelled = false
const started = ref(false)
/** The recording, kept when judging fails so the player does not have to rap again. */
const pending = ref<{ wav: string; timing: BarTiming[] } | null>(null)

/** Which line is being rapped right now (-1 during the count-in). */
const line = computed(() => bar.value - 1)
const beatsPerBar = computed(() => clock.beat?.beatsPerBar ?? 4)
const currentBeat = computed(() => (step.value === 'recording' ? position.value.beat : -1))
const status = computed(() => {
  if (step.value === 'judging') return 'Judging your rap...'
  if (step.value !== 'recording') return ''
  if (line.value < 0) return 'Count-in... get ready'
  return `Line ${line.value + 1} of ${props.targets.length}`
})

function friendly(e: unknown): string {
  const name = (e as { name?: string })?.name
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'The mic is blocked. Allow microphone access for this site, then try again.'
  }
  if (name === 'NotFoundError') return 'No microphone found. Plug one in and try again.'
  return (e as Error)?.message || 'Something went wrong. Try again.'
}

async function start() {
  const beat = clock.beat
  if (!beat || step.value !== 'ready' || props.done) return
  started.value = true
  error.value = ''
  cancelled = false
  try {
    if (!pending.value) {
      step.value = 'recording'
      const rec = await recordRap(clock, beat, props.targets.length, (b) => (bar.value = b))
      if (cancelled) return
      step.value = 'judging'
      const { samples, rate } = await decodeMono(rec.blob)
      pending.value = {
        wav: toWavBase64(samples, rate),
        timing: analyzeBars(samples, rate, rec.t0, beat, 1, props.targets.length),
      }
    }
    step.value = 'judging'
    const { lines, score } = await judgeRap(pending.value.wav, props.targets, pending.value.timing)
    if (cancelled) return
    await props.save({ playerId: props.me, lines, score })
    pending.value = null
  } catch (e) {
    if (!cancelled) error.value = friendly(e)
  } finally {
    step.value = 'ready'
    bar.value = -1
  }
}

/* The countdown ran out: start rapping without a click. Only once, so a failed try waits for you. */
watch(
  () => props.secondsLeft,
  (left) => {
    if (left <= 0 && !started.value) void start()
  },
  { immediate: true },
)

/** Throw the recording away and rap again. */
function rerecord() {
  pending.value = null
  error.value = ''
}

onBeforeUnmount(() => {
  cancelled = true
  clock.pause()
})
</script>

<template>
  <section class="rap panel ink halftone" aria-live="polite">
    <header class="top">
      <span class="tag">Rhyme Duel</span>
    </header>

    <template v-if="!done">
      <h2 class="title toon">Rap {{ opponentName }}'s words</h2>

      <template v-if="!started">
        <p class="help">
          You get a count-in bar, then {{ targets.length }} bars. Finish each line on a word that
          rhymes with the matching word, and land it on the last beat. Headphones help, because the
          mic should hear you and not the beat.
        </p>
        <CountdownBar :seconds="secondsLeft" :total="PRE_RAP_SECONDS" label="Rap starts in" />
      </template>

      <template v-if="step === 'recording'">
        <p class="status">{{ status }}</p>
        <BeatCounter :beat="currentBeat" :beats-per-bar="beatsPerBar" />
        <p v-if="line >= 0" class="land">
          Land a rhyme of <b>{{ targets[line] }}</b> on the last beat
        </p>
      </template>
      <p v-else-if="status" class="status">{{ status }}</p>

      <ol class="targets">
        <li v-for="(t, i) in targets" :key="i" :class="{ now: i === line, past: i < line }">
          <span class="num">Bar {{ i + 1 }}</span>
          <span class="word">{{ t }}</span>
        </li>
      </ol>

      <p v-if="error" class="error ink" role="alert">{{ error }}</p>

      <div v-if="step === 'ready'" class="actions">
        <button class="go ink glint" type="button" :disabled="!clock.beat" @click="start">
          {{ pending ? 'Send my rap again' : error ? 'Try again' : 'Start rapping' }}
        </button>
        <button v-if="pending" class="redo" type="button" @click="rerecord">
          Record it again instead
        </button>
      </div>
    </template>

    <p v-else class="wait">Your rap is judged. Waiting for {{ opponentName }} to finish...</p>
  </section>
</template>

<style scoped>
.rap {
  --fill: var(--cel-paper);
  display: grid;
  gap: 18px;
  max-width: 640px;
  margin: 0 auto;
  width: 100%;
  padding: 24px;
}
.title {
  margin: 0;
  font-size: 32px;
  font-weight: 400;
}
.help {
  margin: 0;
  color: var(--text-ink);
  font-weight: 500;
  line-height: 1.4;
}
.targets {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.targets li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 14px;
  padding: 8px 14px;
  border-radius: 10px;
  color: var(--text-ink);
  background: rgba(11, 6, 20, 0.06);
  transition:
    transform 0.2s var(--spring),
    background 0.2s;
}
.targets li.now {
  background: var(--yellow);
  transform: scale(1.03);
}
.targets li.past {
  opacity: 0.45;
}
.num {
  font-family: var(--display);
  font-size: 14px;
  letter-spacing: 0.08em;
  color: var(--violet);
}
.word {
  font: 400 26px/1.3 var(--marker);
}
.status {
  margin: 0;
  font: 400 22px/1.3 var(--marker);
  color: var(--text-ink);
  text-align: center;
}
.land {
  margin: 12px 0 0;
  text-align: center;
  font-weight: 700;
  color: var(--text-ink);
}
.land b {
  font: 400 26px var(--marker);
  color: var(--pink);
}
.error {
  --fill: var(--cel-yellow);
  margin: 0;
  padding: 10px 16px;
  color: var(--text-ink);
  font-weight: 700;
  border-radius: 12px 16px 10px 14px;
}
.actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 18px;
}
.go {
  --fill: var(--cel-pink);
  font-family: var(--display);
  font-size: 22px;
  letter-spacing: 0.06em;
  color: var(--paper);
  text-shadow: 2px 2px 0 var(--ink);
  padding: 14px 32px 11px;
  border-radius: 16px 22px 14px 20px;
  transition: transform 0.2s var(--spring);
}
.go:hover:not(:disabled) {
  transform: rotate(-2deg) scale(1.06);
}
.go:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.redo {
  background: none;
  border: 0;
  padding: 4px;
  color: var(--text-ink);
  font-weight: 700;
  text-decoration: underline;
}
.wait {
  margin: 0;
  font: 400 22px/1.3 var(--marker);
  color: var(--text-ink);
}
</style>
