<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import CountdownBar from '../CountdownBar.vue'
import { FALLBACK_WORDS, WORDS_SECONDS } from './constants'

// Rhyme Duel, step 1: write the ending words your opponent has to rap. You have 45 seconds. When
// time runs out, what you typed is sent and any empty spots are filled in for you.

const props = defineProps<{
  opponentName: string
  /** How many words to write. */
  lineCount: number
  secondsLeft: number
  done: boolean
  busy: boolean
}>()
const emit = defineEmits<{ submit: [words: string[]] }>()

const words = reactive<string[]>(Array.from({ length: props.lineCount }, () => ''))

/** One word each: letters, apostrophes and hyphens only. */
const clean = (w: string) =>
  w
    .trim()
    .toLowerCase()
    .replace(/[^a-z'-]/g, '')
const ready = computed(() => words.every((w) => clean(w).length > 0))
const canSend = computed(() => ready.value && !props.busy && !props.done)

let sent = false
function send(list: string[]) {
  if (sent || props.done) return
  sent = true
  emit('submit', list)
}

function submit() {
  if (canSend.value) send(words.map(clean))
}

/* Out of time: send what was typed and fill the gaps with default words. */
watch(
  () => props.secondsLeft,
  (left) => {
    if (left > 0 || props.done) return
    send(words.map((w, i) => clean(w) || FALLBACK_WORDS[i % FALLBACK_WORDS.length]!))
  },
  { immediate: true },
)
</script>

<template>
  <section class="words panel ink halftone" aria-live="polite">
    <header class="top">
      <span class="tag">Rhyme Duel</span>
    </header>

    <template v-if="!done">
      <h2 class="title toon">Give {{ opponentName }} {{ lineCount }} words</h2>
      <p class="help">
        {{ opponentName }} will rap {{ lineCount }} lines and has to end each one with a word that
        rhymes with yours. Pick words that are fun but not impossible.
      </p>

      <CountdownBar :seconds="secondsLeft" :total="WORDS_SECONDS" label="Time to write" />

      <form class="form" @submit.prevent="submit">
        <label v-for="(_, i) in words" :key="i" class="row">
          <span class="num">Line {{ i + 1 }} ends with</span>
          <input
            v-model="words[i]"
            class="input"
            maxlength="30"
            placeholder="a rhyme-able word"
            autocomplete="off"
          />
        </label>
        <button class="send ink glint" type="submit" :disabled="!canSend">Lock in my words</button>
      </form>
    </template>

    <p v-else class="wait">Locked in. Waiting for {{ opponentName }} to finish their words...</p>
  </section>
</template>

<style scoped>
.words {
  --fill: var(--cel-paper);
  display: grid;
  gap: 16px;
  max-width: 640px;
  margin: 0 auto;
  width: 100%;
  padding: 24px;
}
.title {
  margin: 0;
  font-size: 32px;
  font-weight: 400;
}
.help {
  margin: 0;
  color: var(--text-ink);
  font-weight: 500;
  line-height: 1.4;
}
.form {
  display: grid;
  gap: 14px;
}
.row {
  display: grid;
  gap: 6px;
}
.num {
  font-family: var(--display);
  font-size: 14px;
  letter-spacing: 0.08em;
  color: var(--violet);
}
.input {
  width: 100%;
  box-sizing: border-box;
  font: 400 22px/1.4 var(--marker);
  color: var(--text-ink);
  background: #fff;
  border: 3px solid var(--ink);
  border-radius: 12px 16px 10px 14px;
  padding: 8px 14px;
  box-shadow: 3px 4px 0 var(--ink);
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
