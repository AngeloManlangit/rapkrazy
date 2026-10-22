<script setup lang="ts">
import { ref } from 'vue'
import { useBeatClock } from '@/shared/audio'
import type { Beat } from '@/shared/types'
import SongCatalog from '@/features/song-catalog/SongCatalog.vue'
import MusicPlayer from '../MusicPlayer.vue'

const { clock, position } = useBeatClock()
const confirmed = ref<Beat | null>(null)
</script>

<template>
  <main class="demo">
    <h1>Song select + music player demo</h1>
    <p>
      Click a song (or use ↑/↓ in the list) to preview it. The dots should flash in time with the
      kick and snare. Enter or double click picks it.
    </p>

    <SongCatalog @confirm="confirmed = $event" />

    <p v-if="confirmed" class="picked">
      Picked <strong>{{ confirmed.title }}</strong> (the real page would open the writing board).
    </p>

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
  padding: 2rem 1rem;
  max-width: 64rem;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
h1 {
  font-size: 1.5rem;
  font-weight: bold;
}
.picked {
  color: #070;
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
