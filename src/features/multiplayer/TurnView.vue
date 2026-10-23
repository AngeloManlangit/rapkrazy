<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { barToSeconds, useBeatClock } from '@/shared/audio'
import type { RoomPlayer } from '@/shared/types'
import NotebookSheet from '@/shared/ui/NotebookSheet.vue'
import BarRow from '@/shared/ui/BarRow.vue'
import RobotStage from '@/features/robot/RobotStage.vue'
import { EspeakVoice } from '@/features/robot/EspeakVoice'
import { RobotRapper } from '@/features/robot/RobotRapper'
import SoundBoard from '@/features/soundboard/SoundBoard.vue'
import { playSfx } from '@/features/soundboard/sfx'
import { flowOf } from '@/features/writing-board/flow'
import PlayerSeat from './PlayerSeat.vue'

// The writing phase, laid out like /write: robot | notebook | soundboard. You only see the line
// right before yours; click the robot to hear it rapped over its bar. Your line gets the live
// syllable sticker, and "Hear bar N" loops the bar it will land on.

const props = defineProps<{
  players: RoomPlayer[]
  me: string
  hostId: string
  writerId: string
  writerName: string
  nextId: string
  isMyTurn: boolean
  submitted: boolean
  previousText: string | null
  previousAuthor: string
  turnIndex: number
  totalTurns: number
  turnSeconds: number
  secondsLeft: number
  busy: boolean
}>()
const emit = defineEmits<{ submit: [text: string] }>()

const text = ref('')
const input = useTemplateRef<HTMLTextAreaElement>('input')
const robot = useTemplateRef<InstanceType<typeof RobotStage>>('robot')

const { clock, isPlaying, position } = useBeatClock()
const rapper = new RobotRapper(new EspeakVoice())
rapper.options = { voice: 'en-us', speed: 250, pitch: 40, slotsPerBeat: 2, squeeze: true }

/** Bar this turn's line lands on, and the one before it (the previous line). */
const lineBar = computed(() => {
  const total = clock.beat?.totalBars ?? 1
  return Math.min(props.turnIndex, Math.max(total - 1, 0))
})
const prevBar = computed(() => Math.max(lineBar.value - 1, 0))

/* The robot raps the previous line on its bar; it's synthesized as soon as the line arrives. */
watch(
  () => [props.previousText, clock.beat?.id] as const,
  ([prev]) => {
    const lines = prev ? [{ id: 'prev', text: prev, bar: prevBar.value, bars: 1 }] : []
    void rapper.setLines(lines).catch((e) => console.error('Robot voice failed', e))
  },
  { immediate: true },
)

/* What's sounding: the previous line (robot, plays once) or your bar (beat only, loops). */
const playing = ref<'prev' | 'mine' | null>(null)
function stop() {
  playing.value = null
  clock.pause()
}
function play(which: 'prev' | 'mine') {
  const beat = clock.beat
  if (!beat) return
  if (playing.value === which && isPlaying.value) return stop()
  playing.value = which
  clock.seek(barToSeconds(beat, which === 'prev' ? prevBar.value : lineBar.value))
  void clock.play()
}
watch(
  () => position.value.bar,
  (bar) => {
    const beat = clock.beat
    if (!beat || !playing.value) return
    if (playing.value === 'prev' && bar > prevBar.value) stop()
    // Past the end of your bar? Jump back to its start.
    if (playing.value === 'mine' && bar > lineBar.value) {
      clock.seek(barToSeconds(beat, lineBar.value))
    }
  },
)
watch(isPlaying, (on) => {
  if (!on) playing.value = null
})

const rowBeat = (which: 'prev' | 'mine') => {
  if (playing.value !== which || !isPlaying.value) return -1
  const bar = which === 'prev' ? prevBar.value : lineBar.value
  return position.value.bar === bar ? position.value.beat : -1
}

/* Robot bubble: the word it's rapping right now. */
const word = ref('')
let frame = 0
const poll = () => {
  word.value =
    playing.value === 'prev' && clock.isPlaying
      ? (rapper.chunkAt(clock.currentTime())?.text ?? '')
      : ''
  frame = requestAnimationFrame(poll)
}
const idleText = computed(() => {
  if (!props.previousText) return props.isMyTurn ? 'You open the song!' : 'Fresh song!'
  return 'Tap me to hear it'
})
function robotClick() {
  if (props.previousText) play('prev')
  else play('mine')
}

/* A new turn: clear the draft and stop whatever plays. Your turn: chime, robot cheers, focus. */
watch(
  () => props.turnIndex,
  () => {
    text.value = ''
    if (playing.value) stop()
  },
)
const writing = computed(() => props.isMyTurn && !props.submitted)
watch(
  writing,
  (now, before) => {
    if (!now) {
      if (playing.value === 'mine') stop()
      return
    }
    if (before) return
    playSfx('ding')
    robot.value?.react('happy', 1500)
    setTimeout(() => input.value?.focus(), 50)
  },
  { immediate: true },
)

const myFlow = computed(() => flowOf(text.value))
const canSend = computed(() => writing.value && !props.busy && !!text.value.trim())
const timePct = computed(() => Math.min(100, (props.secondsLeft / props.turnSeconds) * 100))
const hurry = computed(() => props.secondsLeft <= 10)

function send() {
  if (!canSend.value) return
  if (playing.value) stop()
  emit('submit', text.value)
}

onMounted(() => {
  rapper.start()
  frame = requestAnimationFrame(poll)
})
onBeforeUnmount(() => {
  rapper.stop()
  cancelAnimationFrame(frame)
  if (playing.value) clock.pause()
})
</script>

<template>
  <div class="turn">
    <header class="status panel ink halftone">
      <span class="tag">Line {{ turnIndex + 1 }} of {{ totalTurns }}</span>
      <ul class="seats" aria-label="Players">
        <PlayerSeat
          v-for="(p, i) in players"
          :key="p.id"
          :seat="i"
          :name="p.name"
          :host="p.id === hostId"
          :you="p.id === me"
          :active="p.id === writerId"
          :next="p.id === nextId && p.id !== writerId"
        />
      </ul>
      <span class="clock toon" :class="{ hurry }">{{ secondsLeft }}s</span>
      <div class="timer ink" aria-hidden="true">
        <i :class="{ hurry }" :style="{ width: `${timePct}%` }"></i>
      </div>
    </header>

    <main class="stage">
      <RobotStage
        ref="robot"
        class="area-robot"
        :word="word"
        :idle-text="idleText"
        @toggle="robotClick"
      />

      <section class="area-board" aria-live="polite">
        <NotebookSheet :title="writing ? 'Your line!' : `${writerName} is up`">
          <template #head>
            <span class="note">You only see the line before yours</span>
          </template>

          <BarRow
            v-if="previousText"
            :num="turnIndex"
            :active="playing === 'prev'"
            :hit="rowBeat('prev')"
          >
            <p class="line-text">{{ previousText }}</p>
            <p class="by">by {{ previousAuthor }}</p>
            <template #sticker>
              <span class="ink-sticker" :class="flowOf(previousText).kind">{{
                flowOf(previousText).label
              }}</span>
            </template>
          </BarRow>

          <BarRow
            :num="turnIndex + 1"
            :active="playing === 'mine' || writing"
            :hit="rowBeat('mine')"
            :class="{ mine: writing }"
          >
            <textarea
              v-if="writing"
              ref="input"
              v-model="text"
              class="line-input"
              rows="1"
              maxlength="140"
              :placeholder="previousText ? 'Keep it going...' : 'Open the song...'"
              aria-label="Your line"
              @keydown.enter.exact.prevent="send"
            ></textarea>
            <p v-else-if="isMyTurn" class="line-text dim">Locked in. Waiting for the next turn</p>
            <p v-else class="line-text dim typing">{{ writerName }} is writing</p>
            <template #sticker>
              <span v-if="writing" class="ink-sticker" :class="myFlow.kind">{{
                myFlow.label
              }}</span>
              <span v-else class="ink-sticker thin">...</span>
            </template>
          </BarRow>

          <template #footer>
            <div v-if="writing" class="buttons">
              <button class="send ink glint" type="button" :disabled="!canSend" @click="send">
                Send line
              </button>
              <button
                class="hear ink glint"
                type="button"
                :aria-pressed="playing === 'mine'"
                :disabled="!clock.beat"
                @click="play('mine')"
              >
                {{ playing === 'mine' ? 'Stop beat' : `Hear bar ${lineBar + 1}` }}
              </button>
              <span class="tip">Aim for the green sticker: it fits the bar.</span>
            </div>
            <p v-else class="tip">
              {{
                previousText
                  ? 'Tap the robot to hear the last line rapped.'
                  : 'The song starts with this line.'
              }}
            </p>
          </template>
        </NotebookSheet>
      </section>

      <SoundBoard class="area-sound" @hit="!isPlaying && robot?.react('wow', 650)" />
    </main>
  </div>
</template>

<style scoped>
.turn {
  display: grid;
  gap: 22px;
  /* only two rows: let the sheet size to its content */
  --sheet-h: auto;
}
.status {
  --fill: var(--cel-paper);
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px 18px;
  padding: 14px 20px;
  color: var(--text-ink);
}
.seats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.seats > * {
  flex: 1 1 130px;
}
.clock {
  font-size: 30px;
  color: var(--paper);
}
.clock.hurry {
  color: var(--pink);
  animation: throb 0.5s ease-in-out infinite alternate;
}
@keyframes throb {
  to {
    scale: 1.12;
  }
}
.timer {
  --fill: var(--cel-paper);
  grid-column: 1 / -1;
  height: 12px;
  border-radius: 999px;
  overflow: hidden;
}
.timer i {
  display: block;
  height: 100%;
  background: var(--cyan);
  transition: width 0.5s linear;
}
.timer i.hurry {
  background: var(--pink);
}

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
}
.area-board {
  grid-area: board;
}
.area-sound {
  grid-area: sound;
}

.note {
  font-weight: 500;
  font-size: 13px;
}
.line-text {
  margin: 0;
  padding: 0 6px;
  font: 400 clamp(18px, 1.5vw, 22px) / 1.35 var(--marker);
  overflow-wrap: anywhere;
}
.line-text.dim {
  opacity: 0.55;
}
.typing::after {
  content: '';
  animation: dots 1.2s steps(4, end) infinite;
}
@keyframes dots {
  0% {
    content: '';
  }
  25% {
    content: '.';
  }
  50% {
    content: '..';
  }
  75% {
    content: '...';
  }
}
.by {
  margin: 2px 0 0;
  padding: 0 6px;
  font-size: 12px;
  font-weight: 700;
  opacity: 0.6;
}
/* your row pops in when your turn starts */
.mine {
  animation: your-turn 0.5s var(--spring);
}
@keyframes your-turn {
  40% {
    scale: 1.04 0.94;
  }
}
/* same wavy pen stroke as the lyric sheet */
.line-input {
  display: block;
  width: 100%;
  resize: none;
  field-sizing: content;
  min-height: 1.4em;
  font: 400 clamp(18px, 1.5vw, 22px) / 1.35 var(--marker);
  color: var(--text-ink);
  border: 0;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 220 7'%3E%3Cpath d='M0 2.6C40 .6 80 1.8 110 2.8S180 4.2 220 2.6L220 5.4C180 7 140 5 110 5.8S40 6.8 0 5.4Z' fill='%235a1fd1'/%3E%3C/svg%3E")
    left bottom / 220px 7px repeat-x;
  padding: 0 6px 7px;
}
.line-input:focus {
  outline: none;
}
.line-input::placeholder {
  color: rgba(11, 6, 20, 0.35);
}
.buttons {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  margin-top: 8px;
}
.send,
.hear {
  font-family: var(--display);
  font-size: 20px;
  letter-spacing: 0.06em;
  padding: 12px 24px 9px;
  border-radius: 16px 22px 14px 20px;
  transition: transform 0.2s var(--spring);
}
.send {
  --fill: var(--cel-pink);
  color: var(--paper);
  text-shadow: 2px 2px 0 var(--ink);
}
.hear {
  --fill: var(--cel-cyan);
  color: var(--text-ink);
}
.send:hover:not(:disabled),
.hear:hover:not(:disabled) {
  transform: rotate(-3deg) scale(1.08);
}
.send:hover:not(:disabled)::before,
.hear:hover:not(:disabled)::before {
  box-shadow: var(--line-lift);
}
.send:active:not(:disabled),
.hear:active:not(:disabled) {
  transform: translate(3px, 4px) scale(1.05, 0.9);
  transition-duration: 0.06s;
}
.send:disabled,
.hear:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.tip {
  margin: 8px 0 0;
  font-size: 13px;
  font-weight: 500;
}
@media (max-width: 1000px) {
  .stage {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas:
      'robot sound'
      'board board';
  }
}
@media (max-width: 640px) {
  .status {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .seats {
    grid-column: 1 / -1;
    grid-row: 2;
  }
  .stage {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'board' 'robot' 'sound';
  }
}
</style>
