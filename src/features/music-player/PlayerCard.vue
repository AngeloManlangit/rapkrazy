<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useBeatClock } from '@/shared/audio'
import type { Beat } from '@/shared/types'
import { useSongCatalog } from '@/features/song-catalog/useSongCatalog'
import chooseSong from '@/assets/write/choose-song.webp'

// Ink-kit skin for the shared beatClock: song name, CHOOSE SONG picker, transport, progress,
// and a 4-step beat meter. Loads the first beat on mount if nothing is loaded yet.

const emit = defineEmits<{ picked: [beat: Beat] }>()

const { clock, isPlaying, position } = useBeatClock()
const { beats, ready } = useSongCatalog()

const beat = shallowRef<Beat | null>(clock.beat)
const time = ref(0)
const open = ref(false)
const kick = ref(false)

const offState = clock.onStateChange(() => (beat.value = clock.beat))
let kickTimer: ReturnType<typeof setTimeout> | undefined
const offBeat = clock.onBeat(() => {
  kick.value = true
  clearTimeout(kickTimer)
  kickTimer = setTimeout(() => (kick.value = false), 120)
})

let frame = 0
const poll = () => {
  time.value = clock.currentTime()
  frame = requestAnimationFrame(poll)
}
onMounted(async () => {
  frame = requestAnimationFrame(poll)
  await ready()
  const first = beats.value[0]
  if (!clock.beat && first) await clock.load(first)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  clearTimeout(kickTimer)
  offState()
  offBeat()
})

/** Placeholder beats carry a "Placeholder:" prefix in beats.json; the card has no room for it. */
const title = computed(() => beat.value?.title.replace(/^Placeholder:\s*/i, '') ?? 'No song')
const progress = computed(() => (clock.duration ? Math.min(time.value / clock.duration, 1) : 0))
const clockText = computed(() => {
  const s = Math.floor(time.value)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
})
const bar = computed(() => Math.max(position.value.bar, 0) + 1)

function toggle() {
  if (clock.isPlaying) clock.pause()
  else clock.play()
}

/* The picker floats, so close it on a click outside the player or on Escape. */
const panel = ref<HTMLElement | null>(null)
const onOutside = (e: PointerEvent) => {
  if (!panel.value?.contains(e.target as Node)) open.value = false
}
const onEscape = (e: KeyboardEvent) => {
  if (e.key === 'Escape') open.value = false
}
watch(open, (on) => {
  const method = on ? addEventListener : removeEventListener
  method('pointerdown', onOutside as EventListener)
  method('keydown', onEscape as EventListener)
})
onBeforeUnmount(() => {
  removeEventListener('pointerdown', onOutside as EventListener)
  removeEventListener('keydown', onEscape as EventListener)
})

function pick(b: Beat) {
  open.value = false
  if (b.id === beat.value?.id) return
  const wasPlaying = clock.isPlaying
  // play() waits for the decode itself; calling it now keeps it inside the click.
  void clock.load(b)
  if (wasPlaying) clock.play()
  emit('picked', b)
}
</script>

<template>
  <section ref="panel" class="panel ink halftone player" aria-label="Music player">
    <div class="player-top">
      <div>
        <span class="tag">Music player</span>
        <div class="song-name">
          {{ title }}<small v-if="beat">{{ beat.bpm }} BPM</small>
        </div>
      </div>
      <button
        class="choose"
        type="button"
        :aria-expanded="open"
        aria-controls="song-picker"
        aria-label="Choose song"
        @click="open = !open"
      >
        <span class="boil"
          ><img :src="chooseSong" alt="" width="640" height="427" /><img
            :src="chooseSong"
            alt=""
            width="640"
            height="427"
            style="transform: rotate(-2deg) scale(1.02)"
        /></span>
      </button>
    </div>

    <div v-if="open" id="song-picker" class="picker ink">
      <button
        v-for="b in beats"
        :key="b.id"
        class="song ink"
        type="button"
        :aria-pressed="b.id === beat?.id"
        @click="pick(b)"
      >
        <b>{{ b.title.replace(/^Placeholder:\s*/i, '') }}</b>
        <span
          >{{ b.bpm }} BPM<template v-if="b.vibe">&nbsp;&middot; {{ b.vibe }}</template></span
        >
      </button>
    </div>

    <div class="transport">
      <button
        class="btn-round glint ink"
        type="button"
        aria-label="Back 5 seconds"
        @click="clock.skip(-5)"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M11 5.5v13L2.5 12zM21.5 5.5v13L13 12z" />
        </svg>
      </button>
      <button
        class="btn-round glint big ink"
        :class="{ beat: kick && isPlaying }"
        type="button"
        :aria-label="isPlaying ? 'Pause' : 'Play'"
        :disabled="!beat"
        @click="toggle"
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path v-if="isPlaying" d="M5.5 3.5h5v17h-5zM13.5 3.5h5v17h-5z" />
          <path v-else d="M7 3.5v17L21 12z" />
        </svg>
      </button>
      <button
        class="btn-round glint ink"
        type="button"
        aria-label="Forward 5 seconds"
        @click="clock.skip(5)"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M13 5.5v13l8.5-6.5zM2.5 5.5v13L11 12z" />
        </svg>
      </button>
      <div class="time">
        {{ clockText }}<small v-if="beat">bar {{ bar }} of {{ beat.totalBars }}</small>
      </div>
    </div>
    <div class="progress ink" aria-hidden="true">
      <i :style="{ width: `${(progress * 100).toFixed(2)}%` }"></i>
    </div>
    <div class="bars" aria-hidden="true">
      <span
        v-for="i in beat?.beatsPerBar ?? 4"
        :key="i"
        :class="{ on: isPlaying && position.beat === i - 1 }"
      ></span>
    </div>
  </section>
</template>

<style scoped>
.player {
  transform: rotate(-1.5deg);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.player-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.song-name {
  font-family: var(--display);
  font-size: 22px;
  letter-spacing: 0.04em;
  line-height: 1.1;
  margin-top: 10px;
}
.song-name small {
  display: block;
  font-family: var(--ui);
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.08em;
  opacity: 0.75;
  margin-top: 2px;
}
/* Angelo's CHOOSE SONG art pokes out of the panel corner like a sticker */
.choose {
  position: relative;
  flex: none;
  width: 112px;
  margin: -26px -26px -10px 0;
  background: none;
  border: 0;
  padding: 0;
  rotate: 6deg;
  transition: transform 0.25s var(--spring);
}
.choose:hover {
  transform: scale(1.1) rotate(4deg);
}
.choose:hover .boil img + img {
  animation-duration: 0.18s;
}
.transport {
  display: flex;
  align-items: center;
  gap: 12px;
}
.btn-round.big {
  --fill: var(--cel-yellow);
  width: 70px;
  height: 70px;
}
.btn-round.big.beat {
  transform: scale(1.12, 0.9);
  transition-duration: 0.05s;
}
.btn-round:disabled {
  opacity: 0.5;
  cursor: wait;
}
.time {
  font-family: var(--display);
  font-size: 26px;
  letter-spacing: 0.03em;
  white-space: nowrap;
}
.time small {
  font-family: var(--ui);
  font-weight: 500;
  font-size: 13px;
  display: block;
  letter-spacing: 0;
}
.progress {
  --fill: var(--cel-paper);
  height: 16px;
  border-radius: 999px 900px 999px 950px;
}
.progress::before {
  box-shadow: var(--line-sm);
}
.progress i {
  display: block;
  height: 100%;
  background: var(--pink);
  border-radius: inherit;
  box-shadow: inset -3px 0 0 var(--ink);
}
.bars {
  display: flex;
  gap: 7px;
}
/* Beat meter: one inked pill per beat in its own color, dim until its beat lands, then it jumps
   up, fills in and glows. The downbeat jumps highest. */
.bars span {
  --c: var(--yellow);
  flex: 1;
  height: 11px;
  border-radius: 4px 7px 4px 6px;
  background: color-mix(in srgb, var(--c) 28%, transparent);
  box-shadow: 0 0 0 2px var(--ink);
  transition:
    transform 0.15s var(--spring),
    background 0.08s,
    box-shadow 0.15s;
}
.bars span:nth-child(4n + 2) {
  --c: var(--pink);
}
.bars span:nth-child(4n + 3) {
  --c: var(--mint);
}
.bars span:nth-child(4n) {
  --c: var(--paper);
}
.bars span.on {
  background: var(--c);
  transform: translateY(-3px) scaleY(1.7);
  box-shadow:
    0 0 0 2px var(--ink),
    2px 3px 0 2px var(--ink),
    0 0 14px 3px color-mix(in srgb, var(--c) 70%, transparent);
}
.bars span:first-child.on {
  transform: translateY(-4px) scaleY(2);
}

/* Song picker (opens from CHOOSE SONG). Floats over the panel instead of pushing it taller,
   so the grid row (and the soundboard under the helpers) keeps its size. */
.player {
  z-index: 5;
}
.picker {
  --fill: var(--cel-paper);
  position: absolute;
  top: 92px;
  left: 12px;
  right: 12px;
  z-index: 3;
  border-radius: 16px 22px 14px 24px;
  padding: 12px;
  display: grid;
  gap: 10px;
  max-height: 320px;
  overflow-y: auto;
  transform-origin: top right;
  animation: open 0.28s var(--spring);
}
@keyframes open {
  from {
    transform: scale(0.85) rotate(2deg);
    opacity: 0;
  }
  to {
    transform: none;
    opacity: 1;
  }
}
.song {
  --fill: var(--cel-paper);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  color: var(--text-ink);
  border-radius: 12px 16px 10px 18px;
  padding: 10px 12px 8px;
  transition: transform 0.2s var(--spring);
}
.song::before {
  box-shadow: var(--line-sm);
}
.song:hover {
  transform: translateX(-6px) rotate(-1deg);
}
.song[aria-pressed='true'] {
  --fill: var(--cel-yellow);
}
.song b {
  font-family: var(--display);
  font-weight: 400;
  font-size: 17px;
  letter-spacing: 0.04em;
}
.song span {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}
@media (max-width: 640px) {
  .player {
    transform: none;
  }
  .choose {
    margin-right: -10px;
  }
}
</style>
