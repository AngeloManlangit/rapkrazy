<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useBeatClock } from '@/shared/audio'
import type { Beat } from '@/shared/types'
import { loadBeats } from '@/features/song-catalog/loadBeats'
import MusicPlayer from '../MusicPlayer.vue'

const { clock, position } = useBeatClock()
const beats = ref<Beat[]>([])
const selected = ref('')
const error = ref('')

onMounted(async () => {
  try {
    beats.value = await loadBeats()
    if (beats.value[0]) await pick(beats.value[0].id)
  } catch (e) {
    error.value = (e as Error).message
  }
})

async function pick(id: string) {
  const beat = beats.value.find((b) => b.id === id)
  if (!beat) return
  selected.value = id
  error.value = ''
  try {
    await clock.load(beat)
  } catch (e) {
    error.value = (e as Error).message
  }
}
</script>

<template>
  <main class="demo">
    <h1>Music player demo</h1>
    <p>Web Audio BeatClock. The dots should flash in time with the kick and snare.</p>

    <label>
      Beat
      <select :value="selected" @change="pick(($event.target as HTMLSelectElement).value)">
        <option v-for="b in beats" :key="b.id" :value="b.id">{{ b.title }}</option>
      </select>
    </label>
    <p v-if="error" class="error">{{ error }}</p>

    <div class="dots">
      <span
        v-for="n in clock.beat?.beatsPerBar ?? 4"
        :key="n"
        :class="{ on: position.beat === n - 1 }"
      />
    </div>

    <MusicPlayer />
  </main>
</template>

<style scoped>
.demo {
  font-family: system-ui, sans-serif;
  padding: 2rem;
  max-width: 40rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
h1 {
  font-size: 1.5rem;
  font-weight: bold;
}
select {
  border: 1px solid #999;
  margin-left: 0.5rem;
}
.error {
  color: #c00;
}
.dots {
  display: flex;
  gap: 0.5rem;
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
</style>
