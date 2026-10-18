<script setup lang="ts">
import { onScopeDispose, ref } from 'vue'
import { useBeatClock } from '@/shared/audio'

// Controls for the shared beatClock: details, play/pause, seek, volume, speed.
// Load a beat first (beatClock.load); this component only drives playback.

const SKIPS = [2, 5, 10]

const { clock, isPlaying, position } = useBeatClock()

// Mirror clock fields that change on state events; poll time every frame for the progress bar.
const volume = ref(clock.volume)
const rate = ref(clock.rate)
const duration = ref(clock.duration)
const time = ref(clock.currentTime())

const offState = clock.onStateChange(() => {
  volume.value = clock.volume
  rate.value = clock.rate
  duration.value = clock.duration
  time.value = clock.currentTime()
})

let frame = 0
const poll = () => {
  time.value = clock.currentTime()
  frame = requestAnimationFrame(poll)
}
frame = requestAnimationFrame(poll)

onScopeDispose(() => {
  offState()
  cancelAnimationFrame(frame)
})

function toggle() {
  if (isPlaying.value) clock.pause()
  else clock.play()
}

function fmt(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
</script>

<template>
  <section class="flex flex-col gap-3 rounded-lg border border-neutral-300 p-4">
    <header v-if="clock.beat">
      <h2 class="text-lg font-bold">{{ clock.beat.title }}</h2>
      <p class="text-sm text-neutral-600">
        {{ clock.beat.creator }} · {{ clock.beat.bpm }} bpm
        <span v-if="clock.beat.vibe"> · {{ clock.beat.vibe }}</span>
      </p>
    </header>
    <p v-else class="text-neutral-600">No beat loaded.</p>

    <div class="flex items-center gap-2 text-sm tabular-nums">
      <span>{{ fmt(time) }}</span>
      <input
        class="flex-1"
        type="range"
        min="0"
        :max="duration"
        step="0.01"
        :value="time"
        aria-label="Position"
        @input="clock.seek(+($event.target as HTMLInputElement).value)"
      />
      <span>{{ fmt(duration) }}</span>
    </div>

    <p class="text-sm tabular-nums">bar {{ position.bar + 1 }} · beat {{ position.beat + 1 }}</p>

    <div class="flex flex-wrap gap-1">
      <button
        v-for="s in [...SKIPS].reverse()"
        :key="`-${s}`"
        class="rounded border px-2 py-1"
        @click="clock.skip(-s)"
      >
        -{{ s }}s
      </button>
      <button class="rounded border px-4 py-1 font-bold" :disabled="!clock.beat" @click="toggle">
        {{ isPlaying ? 'Pause' : 'Play' }}
      </button>
      <button
        v-for="s in SKIPS"
        :key="`+${s}`"
        class="rounded border px-2 py-1"
        @click="clock.skip(s)"
      >
        +{{ s }}s
      </button>
      <button class="rounded border px-2 py-1" @click="clock.stop()">Stop</button>
    </div>

    <label class="flex items-center gap-2 text-sm">
      Volume
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        :value="volume"
        @input="clock.setVolume(+($event.target as HTMLInputElement).value)"
      />
      {{ Math.round(volume * 100) }}%
    </label>

    <label class="flex items-center gap-2 text-sm">
      Speed
      <input
        type="range"
        min="0.5"
        max="2"
        step="0.05"
        :value="rate"
        @input="clock.setRate(+($event.target as HTMLInputElement).value)"
      />
      {{ rate.toFixed(2) }}x
      <button class="rounded border px-2" @click="clock.setRate(1)">Reset</button>
    </label>
  </section>
</template>
