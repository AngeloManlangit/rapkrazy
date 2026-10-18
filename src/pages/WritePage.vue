<script setup lang="ts">
import { ref } from 'vue'
import AiWriterPanel from '@/features/ai-writer/AiWriterPanel.vue'

// Stand-in board so this page works on its own.
// Replace with your real writing-board feature and call its "add lines" function in onAiLyrics.
const title = ref('Untitled')
const boardLines = ref<string[]>([])

function onAiLyrics(payload: { title: string; lines: string[] }) {
  title.value = payload.title
  boardLines.value.push(...payload.lines)
}
</script>

<template>
  <main class="wall brick-wall">
    <header class="top">
      <h1 class="tag-title">Write</h1>
      <AiWriterPanel @add-to-board="onAiLyrics" />
    </header>

    <section class="board slab-panel" aria-label="Writing board">
      <h2>{{ title }}</h2>

      <p v-if="!boardLines.length" class="empty">
        Blank wall. Hit Ghostwrite, or start a bar below.
      </p>

      <ol v-else class="bars">
        <li v-for="(_, i) in boardLines" :key="i">
          <input v-model="boardLines[i]" :aria-label="`Bar ${i + 1}`" />
        </li>
      </ol>

      <button class="add" type="button" @click="boardLines.push('')">Add a bar</button>
    </section>
  </main>
</template>

<style scoped>
/* Colours, fonts and the brick wall now come from src/style.css */
.wall {
  min-height: 100vh;
  padding: 2rem clamp(1rem, 5vw, 4rem) 4rem;
}

.top { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 2.5rem; }
.tag-title { font-size: clamp(3rem, 9vw, 6rem); }

.board { max-width: 44rem; padding: 1.5rem 1.6rem 1.8rem; }
.board h2 { margin: 0 0 1rem; font: 400 1.8rem/1.2 var(--font-marker); color: var(--spray-yellow); }
.empty { margin: 0 0 1rem; color: rgba(245, 245, 240, 0.65); }

.bars { margin: 0 0 1rem; padding: 0; list-style: none; display: grid; gap: 0.3rem; }
.bars input {
  width: 100%;
  box-sizing: border-box;
  font: 400 1.15rem/1.8rem var(--font-marker);
  color: var(--paint-white);
  background: transparent;
  border: 0;
  border-bottom: 2px dashed rgba(245, 245, 240, 0.25);
  padding: 0.1rem 0.2rem;
}
.bars input:focus-visible { outline: 3px solid var(--spray-cyan); outline-offset: 2px; border-bottom-color: transparent; }

.add {
  font: 400 1rem var(--font-marker);
  padding: 0.5rem 1.1rem;
  color: var(--outline);
  background: var(--spray-cyan);
  border: 3px solid var(--outline);
  border-radius: 4px;
  box-shadow: 3px 3px 0 var(--spray-pink);
  cursor: pointer;
}
.add:focus-visible { outline: 3px solid var(--spray-yellow); outline-offset: 3px; }
</style>