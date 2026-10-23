<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { barToSeconds, useBeatClock } from '@/shared/audio'
import type { RoomPlayer } from '@/shared/types'
import PlayerSeat from './PlayerSeat.vue'

// The writing phase: you only see the line right before yours. Everyone else waits and watches.

const props = defineProps<{
  players: RoomPlayer[]
  me: string
  hostId: string
  writerId: string
  writerName: string
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

/* "Hear the beat": plays the bar this line will sit on, on a loop, so the writer can feel the flow. */
const { clock, isPlaying, position } = useBeatClock()
const hearing = ref(false)
const lineBar = computed(() => {
  const total = clock.beat?.totalBars ?? 1
  return Math.min(props.turnIndex, Math.max(total - 1, 0))
})

function stopBeat() {
  hearing.value = false
  clock.pause()
}
function toggleBeat() {
  const beat = clock.beat
  if (hearing.value) return stopBeat()
  if (!beat) return
  hearing.value = true
  clock.seek(barToSeconds(beat, lineBar.value))
  void clock.play()
}
/* Past the end of this line's bar? Jump back to its start. */
watch(
  () => position.value.bar,
  (bar) => {
    const beat = clock.beat
    if (hearing.value && beat && bar > lineBar.value) clock.seek(barToSeconds(beat, lineBar.value))
  },
)
watch(
  () => props.turnIndex,
  () => {
    text.value = ''
    if (hearing.value) stopBeat()
  },
)
watch(
  () => props.isMyTurn && !props.submitted,
  (writing) => {
    if (!writing && hearing.value) stopBeat()
  },
)
onBeforeUnmount(() => {
  if (hearing.value) clock.pause()
})

const canSend = computed(
  () => props.isMyTurn && !props.submitted && !props.busy && !!text.value.trim(),
)
const timePct = computed(() => Math.min(100, (props.secondsLeft / props.turnSeconds) * 100))
const hurry = computed(() => props.secondsLeft <= 10)

function send() {
  if (canSend.value) emit('submit', text.value)
}
</script>

<template>
  <div class="turn">
    <ul class="seats" aria-label="Players">
      <PlayerSeat
        v-for="(p, i) in players"
        :key="p.id"
        :seat="i"
        :name="p.name"
        :host="p.id === hostId"
        :you="p.id === me"
        :active="p.id === writerId"
      />
    </ul>

    <section class="pad panel ink halftone" aria-live="polite">
      <header class="top">
        <span class="tag">Line {{ turnIndex + 1 }} of {{ totalTurns }}</span>
        <span class="clock toon" :class="{ hurry }">{{ secondsLeft }}s</span>
      </header>
      <div class="timer ink" aria-hidden="true">
        <i :class="{ hurry }" :style="{ width: `${timePct}%` }"></i>
      </div>

      <div class="prev">
        <span class="label">{{
          previousText ? `${previousAuthor} wrote` : 'You open the song'
        }}</span>
        <p v-if="previousText" class="prev-text">{{ previousText }}</p>
        <p v-else class="prev-text dim">Nobody has written yet. Start it off!</p>
      </div>

      <form v-if="isMyTurn && !submitted" class="write" @submit.prevent="send">
        <label>
          <span class="label">Your line</span>
          <textarea
            v-model="text"
            class="input"
            rows="3"
            maxlength="140"
            placeholder="Continue the song..."
            @keydown.enter.exact.prevent="send"
          ></textarea>
        </label>
        <div class="buttons">
          <button class="send ink glint" type="submit" :disabled="!canSend">Send line</button>
          <button
            class="hear ink glint"
            type="button"
            :aria-pressed="hearing && isPlaying"
            :disabled="!clock.beat"
            @click="toggleBeat"
          >
            {{ hearing && isPlaying ? 'Stop beat' : `Hear bar ${lineBar + 1}` }}
          </button>
        </div>
      </form>
      <p v-else-if="isMyTurn" class="wait">Locked in. Waiting for the next turn...</p>
      <p v-else class="wait">{{ writerName }} is writing...</p>
    </section>
  </div>
</template>

<style scoped>
.turn {
  display: grid;
  gap: 26px;
  max-width: 760px;
  margin: 0 auto;
  width: 100%;
}
.seats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin: 0;
  padding: 0 0 6px;
  list-style: none;
}
.pad {
  --fill: var(--cel-paper);
  display: grid;
  gap: 18px;
  padding: 24px;
}
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.clock {
  font-size: 30px;
  color: var(--paper);
}
.clock.hurry {
  color: var(--pink);
}
.timer {
  --fill: var(--cel-paper);
  height: 14px;
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
.prev {
  display: grid;
  gap: 6px;
}
.label {
  font-family: var(--display);
  font-size: 14px;
  letter-spacing: 0.08em;
  color: var(--violet);
}
.prev-text {
  margin: 0;
  font: 400 26px/1.4 var(--marker);
  color: var(--text-ink);
  overflow-wrap: anywhere;
}
.dim {
  opacity: 0.55;
}
.write {
  display: grid;
  gap: 14px;
}
.write label {
  display: grid;
  gap: 6px;
}
.input {
  width: 100%;
  box-sizing: border-box;
  resize: none;
  font: 400 22px/1.5 var(--marker);
  color: var(--text-ink);
  background: #fff;
  border: 3px solid var(--ink);
  border-radius: 12px 16px 10px 14px;
  padding: 10px 14px;
  box-shadow: 3px 4px 0 var(--ink);
}
.buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}
.hear {
  --fill: var(--cel-cyan);
  font-family: var(--display);
  font-size: 20px;
  letter-spacing: 0.06em;
  color: var(--text-ink);
  padding: 12px 24px 9px;
  border-radius: 16px 22px 14px 20px;
  transition: transform 0.2s var(--spring);
}
.hear:hover:not(:disabled) {
  transform: rotate(2deg) scale(1.06);
}
.hear:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.send {
  --fill: var(--cel-pink);
  justify-self: start;
  font-family: var(--display);
  font-size: 20px;
  letter-spacing: 0.06em;
  color: var(--paper);
  text-shadow: 2px 2px 0 var(--ink);
  padding: 12px 28px 9px;
  border-radius: 16px 22px 14px 20px;
  transition: transform 0.2s var(--spring);
}
.send:hover:not(:disabled) {
  transform: rotate(-2deg) scale(1.06);
}
.send:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.wait {
  margin: 0;
  font: 400 22px/1.3 var(--marker);
  color: var(--text-ink);
}
</style>
