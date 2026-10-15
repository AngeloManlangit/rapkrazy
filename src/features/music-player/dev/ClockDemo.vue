<script setup lang="ts">
import { onMounted } from 'vue'
import { useBeatClock } from '@/shared/audio'
import type { Beat } from '@/shared/types'

// Fake metadata only; the stub clock needs no audio file.
const demoBeat: Beat = {
  id: 'demo',
  title: 'Demo Beat (silent stub)',
  creator: 'rapkrazy',
  file: '',
  bpm: 90,
  beatsPerBar: 4,
  offsetMs: 500,
  totalBars: 16,
}

const { clock, isPlaying, position } = useBeatClock()

onMounted(() => clock.load(demoBeat))

function toggle() {
  if (isPlaying.value) clock.pause()
  else clock.play()
}
</script>

<template>
  <main class="demo">
    <h1>BeatClock demo</h1>
    <p>{{ clock.beat?.title }} · {{ clock.beat?.bpm }} bpm</p>
    <p class="pos">
      bar <strong>{{ position.bar + 1 }}</strong> · beat <strong>{{ position.beat + 1 }}</strong>
    </p>
    <div class="dots">
      <span
        v-for="n in clock.beat?.beatsPerBar ?? 4"
        :key="n"
        :class="{ on: position.beat === n - 1 }"
      />
    </div>
    <div class="controls">
      <button @click="clock.skip(-5)">-5s</button>
      <button @click="toggle">{{ isPlaying ? 'Pause' : 'Play' }}</button>
      <button @click="clock.skip(5)">+5s</button>
      <button @click="clock.stop()">Stop</button>
      <button @click="clock.setRate(clock.rate === 1 ? 1.5 : 1)">Rate {{ clock.rate }}x</button>
    </div>
  </main>
</template>

<style scoped>
.demo {
  font-family: system-ui, sans-serif;
  padding: 2rem;
}
.pos {
  font-size: 1.5rem;
}
.dots {
  display: flex;
  gap: 0.5rem;
  margin: 1rem 0;
}
.dots span {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: #ccc;
}
.dots span.on {
  background: #e33;
}
.controls {
  display: flex;
  gap: 0.5rem;
}
</style>
