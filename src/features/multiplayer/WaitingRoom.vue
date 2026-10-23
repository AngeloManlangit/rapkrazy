<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Beat, Room, RoomMode, RoomPlayer } from '@/shared/types'
import { LINE_COUNTS } from './duel/constants'
import PlayerSeat from './PlayerSeat.vue'
import { MAX_PLAYERS } from './roomApi'

// The lobby after creating or joining: who is seated, and (for the host) beat, timer and Start.

const props = defineProps<{
  room: Room
  players: RoomPlayer[]
  me: string
  isHost: boolean
  beats: Beat[]
  busy: boolean
}>()
const emit = defineEmits<{
  pickBeat: [id: string]
  setMode: [mode: RoomMode]
  settings: [patch: { turnSeconds?: number; rounds?: number; lineCount?: number }]
  start: []
  leave: []
}>()

const TIMERS = [30, 45, 60, 90]
const ROUNDS = [1, 2, 3]
const MODES: { id: RoomMode; title: string; text: string }[] = [
  // Write together is hidden for now. Uncomment it to show it next to Rhyme Duel.
  // {
  //   id: 'write',
  //   title: 'Write together',
  //   text: '2 to 5 players add a line each, then the robot raps it.',
  // },
  {
    id: 'duel',
    title: 'Rhyme Duel',
    text: 'A 2-player rap battle. Each of you writes 4 ending words for the other, then raps 4 bars over the beat on the mic, rhyming those words on beat 4. The most rhymes on the beat wins, and a tie is possible.',
  },
]

const duel = computed(() => props.room.mode === 'duel')
const maxPlayers = computed(() => (duel.value ? 2 : MAX_PLAYERS))

const picked = computed(() => props.beats.find((b) => b.id === props.room.beatId) ?? null)
/** A duel needs a count-in bar plus one bar per line. */
const beatTooShort = computed(
  () => duel.value && !!picked.value && picked.value.totalBars < props.room.lineCount + 1,
)
const canStart = computed(() => {
  if (!props.isHost || !picked.value || beatTooShort.value) return false
  return duel.value ? props.players.length === 2 : props.players.length >= 2
})
const hint = computed(() => {
  if (duel.value && props.players.length > 2) return 'Rhyme Duel is for exactly 2 players.'
  if (props.players.length < 2) return 'Need at least 2 players to start.'
  if (!picked.value) return 'Pick a beat first.'
  if (beatTooShort.value) return 'That beat is too short for that many lines.'
  return ''
})
const lineCount = computed(() =>
  Math.min(props.players.length * props.room.rounds, picked.value?.totalBars ?? 16, 16),
)

const copied = ref(false)
async function copyCode() {
  try {
    await navigator.clipboard.writeText(props.room.code)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    /* clipboard blocked: the code is on screen anyway */
  }
}

const cleanTitle = (b: Beat) => b.title.replace(/^Placeholder:\s*/i, '')
</script>

<template>
  <div class="waiting">
    <section class="code-card panel ink halftone" aria-label="Lobby code">
      <span class="tag">Lobby code</span>
      <button class="code toon grad" type="button" aria-label="Copy lobby code" @click="copyCode">
        {{ room.code }}
      </button>
      <small>{{ copied ? 'Copied!' : 'Tap the code to copy it' }}</small>
    </section>

    <section class="seats-card panel ink halftone" aria-label="Players">
      <span class="tag">Players {{ players.length }}/{{ maxPlayers }}</span>
      <ul class="seats">
        <PlayerSeat
          v-for="i in maxPlayers"
          :key="i"
          :seat="i - 1"
          :name="players[i - 1]?.name"
          :host="players[i - 1]?.id === room.hostId"
          :you="players[i - 1]?.id === me"
        />
      </ul>
    </section>

    <section class="setup panel ink halftone" aria-label="Game setup">
      <span class="tag">Mode</span>
      <div class="modes" :class="{ single: MODES.length === 1 }">
        <button
          v-for="m in MODES"
          :key="m.id"
          class="mode ink"
          type="button"
          :aria-pressed="room.mode === m.id"
          :disabled="!isHost || busy"
          @click="emit('setMode', m.id)"
        >
          <b>{{ m.title }}</b>
          <span>{{ m.text }}</span>
        </button>
      </div>

      <span class="tag">Beat</span>
      <ul class="beats">
        <li v-for="b in beats" :key="b.id">
          <button
            class="beat ink"
            type="button"
            :aria-pressed="b.id === room.beatId"
            :disabled="!isHost || busy"
            @click="emit('pickBeat', b.id)"
          >
            <b>{{ cleanTitle(b) }}</b>
            <span
              >{{ b.bpm }} BPM<template v-if="b.vibe"> &middot; {{ b.vibe }}</template></span
            >
          </button>
        </li>
      </ul>

      <div v-if="duel" class="opts">
        <div class="opt">
          <span class="tag">Words per player</span>
          <div class="chips">
            <button
              v-for="n in LINE_COUNTS"
              :key="n"
              class="chip ink"
              type="button"
              :aria-pressed="room.lineCount === n"
              :disabled="!isHost || busy"
              @click="emit('settings', { lineCount: n })"
            >
              {{ n }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="!duel" class="opts">
        <div class="opt">
          <span class="tag">Seconds per line</span>
          <div class="chips">
            <button
              v-for="s in TIMERS"
              :key="s"
              class="chip ink"
              type="button"
              :aria-pressed="room.turnSeconds === s"
              :disabled="!isHost || busy"
              @click="emit('settings', { turnSeconds: s })"
            >
              {{ s }}
            </button>
          </div>
        </div>
        <div class="opt">
          <span class="tag">Rounds</span>
          <div class="chips">
            <button
              v-for="r in ROUNDS"
              :key="r"
              class="chip ink"
              type="button"
              :aria-pressed="room.rounds === r"
              :disabled="!isHost || busy"
              @click="emit('settings', { rounds: r })"
            >
              {{ r }}
            </button>
          </div>
        </div>
      </div>

      <p v-if="duel" class="summary">
        Each player writes {{ room.lineCount }} words and raps {{ room.lineCount }} bars<template
          v-if="picked"
        >
          over {{ cleanTitle(picked) }}</template
        >.
      </p>
      <p v-else class="summary">
        {{ lineCount }} lines in the song<template v-if="picked">
          over {{ cleanTitle(picked) }}</template
        >.
      </p>

      <div class="actions">
        <button
          v-if="isHost"
          class="start ink glint"
          type="button"
          :disabled="!canStart || busy"
          @click="emit('start')"
        >
          Start game
        </button>
        <p v-else class="wait">Waiting for the host to start...</p>
        <button class="leave" type="button" @click="emit('leave')">Leave lobby</button>
      </div>
      <p v-if="isHost && hint" class="hint">{{ hint }}</p>
    </section>
  </div>
</template>

<style scoped>
.waiting {
  display: grid;
  gap: 26px;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr);
  grid-template-areas:
    'code setup'
    'seats setup';
  align-items: start;
}
.code-card {
  grid-area: code;
  --fill: var(--cel-yellow);
  display: grid;
  justify-items: start;
  gap: 8px;
  padding: 22px;
  transform: rotate(-1deg);
}
.code {
  background-color: transparent;
  border: 0;
  padding: 0;
  font-size: clamp(44px, 7vw, 68px);
  letter-spacing: 0.18em;
  line-height: 1;
}
.code-card small {
  font-weight: 700;
  opacity: 0.75;
}
.seats-card {
  grid-area: seats;
  --fill: var(--cel-cyan);
  display: grid;
  gap: 14px;
  padding: 22px;
}
.seats {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.setup {
  grid-area: setup;
  --fill: var(--cel-paper);
  display: grid;
  gap: 16px;
  padding: 22px;
}
.modes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 0 8px 4px 4px;
}
.modes.single {
  grid-template-columns: minmax(0, 1fr);
}
.mode {
  --fill: var(--cel-paper);
  display: grid;
  gap: 4px;
  text-align: left;
  padding: 10px 14px;
  border-radius: 12px 16px 10px 14px;
  color: var(--text-ink);
}
.mode::before {
  box-shadow: var(--line-sm);
}
.mode b {
  font-family: var(--display);
  font-weight: 400;
  letter-spacing: 0.04em;
}
.mode span {
  font-size: 13px;
  font-weight: 500;
  opacity: 0.8;
}
.mode[aria-pressed='true'] {
  --fill: var(--cel-yellow);
}
.mode:disabled {
  cursor: default;
}
@media (max-width: 560px) {
  .modes {
    grid-template-columns: minmax(0, 1fr);
  }
}
.beats {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 4px 8px 8px 4px;
  list-style: none;
  max-height: 260px;
  overflow: auto;
}
.beat {
  --fill: var(--cel-paper);
  display: grid;
  width: 100%;
  text-align: left;
  padding: 10px 14px;
  border-radius: 12px 16px 10px 14px;
  color: var(--text-ink);
}
.beat::before {
  box-shadow: var(--line-sm);
}
.beat b {
  font-family: var(--display);
  font-weight: 400;
  letter-spacing: 0.04em;
}
.beat span {
  font-size: 13px;
  font-weight: 700;
  opacity: 0.7;
}
.beat[aria-pressed='true'] {
  --fill: var(--cel-yellow);
}
.opts {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}
.opt {
  display: grid;
  gap: 10px;
  justify-items: start;
}
.chips {
  display: flex;
  gap: 10px;
}
.chip {
  --fill: var(--cel-paper);
  min-width: 48px;
  padding: 8px 12px 6px;
  border-radius: 12px 16px 10px 14px;
  font-family: var(--display);
  color: var(--text-ink);
}
.chip::before {
  box-shadow: var(--line-sm);
}
.chip[aria-pressed='true'] {
  --fill: var(--cel-pink);
  color: var(--paper);
}
.beat:disabled,
.chip:disabled {
  cursor: default;
}
.summary {
  margin: 0;
  color: var(--text-ink);
  font-weight: 700;
}
.actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 18px;
}
.start {
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
.start:hover:not(:disabled) {
  transform: rotate(-2deg) scale(1.06);
}
.start:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.wait,
.hint {
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
  .waiting {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'code' 'seats' 'setup';
  }
}
</style>
