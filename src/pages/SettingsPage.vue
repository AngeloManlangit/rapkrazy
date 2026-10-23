<script setup lang="ts">
import '@fontsource/luckiest-guy'
import '@fontsource/permanent-marker'
import '@fontsource/rubik/400.css'
import '@fontsource/rubik/500.css'
import '@fontsource/rubik/700.css'
import '@/shared/ui/ink.css'
import { useContentMode, type ContentMode } from '@/shared/contentMode'
import InkFilters from '@/shared/ui/InkFilters.vue'
import TopBar from '@/shared/ui/TopBar.vue'
import MadeBy from '@/shared/ui/MadeBy.vue'
import settings1 from '@/assets/write/settings-1.webp'
import settings2 from '@/assets/write/settings-2.webp'

const { mode, setMode } = useContentMode()

const modes: { id: ContentMode; title: string; text: string }[] = [
  {
    id: 'family',
    title: 'Family-friendly',
    text: 'Clean lyrics from the AI ghostwriter. No cussing. This is the default.',
  },
  {
    id: 'explicit',
    title: 'Ghetto mode',
    text: 'The AI ghostwriter cusses and trash-talks. It still never writes slurs or hate.',
  },
]
</script>

<template>
  <div class="rk">
    <InkFilters />
    <div class="wrap">
      <TopBar title="Settings" :frames="[settings1, settings2]" />

      <main class="stage">
        <section class="group" aria-labelledby="mode-title">
          <h2 id="mode-title" class="tag">Lyric mode</h2>
          <div class="cards" role="radiogroup" aria-labelledby="mode-title">
            <button
              v-for="m in modes"
              :key="m.id"
              class="card panel ink halftone"
              :class="m.id"
              type="button"
              role="radio"
              :aria-checked="mode === m.id"
              @click="setMode(m.id)"
            >
              <span class="name toon">{{ m.title }}</span>
              <span class="text">{{ m.text }}</span>
              <span v-if="mode === m.id" class="on">Selected</span>
            </button>
          </div>
          <p class="note">
            This only changes the AI ghostwriter on the Write page. Multiplayer has no AI writer, so
            players on either mode can play in the same lobby.
          </p>
        </section>
      </main>
      <footer class="credit"><MadeBy /></footer>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  max-width: 1280px;
  margin: 0 auto;
  padding-block: 14px 40px;
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px));
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.credit {
  display: flex;
  justify-content: center;
  padding-top: 8px;
}
.stage {
  max-width: 880px;
  margin: 0 auto;
  width: 100%;
}
.group {
  display: grid;
  gap: 18px;
  justify-items: start;
}
.group .tag {
  margin: 0;
}
.cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 26px;
  width: 100%;
}
.card {
  display: grid;
  align-content: start;
  justify-items: start;
  gap: 12px;
  padding: 24px;
  text-align: left;
  color: var(--text-ink);
  transition: transform 0.2s var(--spring);
}
.card.family {
  --fill: var(--cel-cyan);
}
.card.explicit {
  --fill: var(--cel-pink);
}
.card:hover {
  transform: rotate(-1deg) scale(1.02);
}
.card[aria-checked='false'] {
  opacity: 0.7;
}
.name {
  font-size: 30px;
}
.text {
  font-weight: 500;
  line-height: 1.4;
}
.on {
  font-family: var(--display);
  font-size: 14px;
  letter-spacing: 0.08em;
  background: var(--ink);
  color: var(--yellow);
  padding: 4px 10px 2px;
  border-radius: 6px 10px 5px 12px;
}
.note {
  margin: 0;
  font-weight: 500;
  opacity: 0.85;
}
@media (max-width: 700px) {
  .cards {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
