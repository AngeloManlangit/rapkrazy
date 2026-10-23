<script setup lang="ts">
import { ref, onMounted, computed, reactive } from 'vue'
import {
  generateTraceryText,
  assignRhymeScheme,
  parseSong,
  compareRhyme,
  isWord,
  type Verdict,
} from './template'

type Status = Verdict | 'pending'
const RANK: Verdict[] = ['perfect', 'slant', 'none']

const values = reactive<Record<string, string>>({})
const settled = reactive<Record<string, string>>({})
const timers = new Map<string, number>() // each blank has its own debounce timer

const outputText = ref<string>('')
const stanza1 = ref<string>('')
const stanza2 = ref<string>('')
const lines = computed(() => parseSong(outputText.value))

// Copy the current text of a blank into `settled`, which the rhyme check reads
function commit(id: string) {
  clearTimeout(timers.get(id))
  settled[id] = values[id] ?? ''
}

// Debounce: commit only after 350 ms with no typing in this blank
function onType(id: string) {
  clearTimeout(timers.get(id))
  timers.set(id, window.setTimeout(() => commit(id), 350))
}

// Generate a new song and reset all user state
const handleGenerate = (): void => {
  stanza1.value = assignRhymeScheme(generateTraceryText(), 1)
  stanza2.value = assignRhymeScheme(generateTraceryText(), 2)
  outputText.value = `${stanza1.value}\n${stanza2.value}`

  Object.keys(values).forEach(k => delete values[k])
  Object.keys(settled).forEach(k => delete settled[k])
  timers.forEach(t => clearTimeout(t))
  timers.clear()
}

// One status per blank id, used for CSS classes
const rhymeStatus = computed(() => {
  // group -> blank ids, built from the parsed lines
  const groups = new Map<string, string[]>()
  for (const line of lines.value) {
    for (const s of line) {
      // skip "X" groups: those are non-rhyming blanks (name, rival, ...)
      if (s.kind !== 'blank' || s.group.startsWith('X')) continue
      const existing = groups.get(s.group)
      if (existing) existing.push(s.id)
      else groups.set(s.group, [s.id])
    }
  }

  const out: Record<string, Status> = {}
  for (const ids of groups.values()) {
    ids.forEach(id => (out[id] = 'pending'))

    const ready = ids.filter(id => isWord(settled[id] ?? ''))
    if (ready.length < 2) continue // nothing valid to compare against yet

    for (const id of ready) {
      const verdicts = ready
        .filter(o => o !== id)
        .map(o => compareRhyme(settled[id] ?? '', settled[o] ?? ''))
      out[id] = RANK.find(v => verdicts.includes(v)) ?? 'pending'
    }
  }
  return out
})

onMounted(handleGenerate)
</script>

<template>
  <div class="tracery-container">
    <h2>Tracery Generator</h2>

    <button type="button" @click="handleGenerate" class="generate-btn">
      Generate New Text
    </button>

    <div class="display-box">
      <p v-for="(line, i) in lines" :key="i">
        <template v-for="(segment, j) in line" :key="j">
          <span v-if="segment.kind === 'text'">{{ segment.text }}</span>
          <input
            v-else
            v-model="values[segment.id]"
            :placeholder="`[${segment.id}:${segment.group}]`"
            :class="['blank', segment.type, rhymeStatus[segment.id]]"
            :size="Math.max((values[segment.id] ?? '').length, segment.id.length + segment.group.length + 3)"
            @input="onType(segment.id)"
            @blur="commit(segment.id)"
            @keydown.enter="commit(segment.id)"
          />
        </template>
      </p>
    </div>
  </div>
</template>

<style scoped>
.tracery-container {
  max-width: 600px;
  margin: 2rem auto;
  padding: 1.5rem;
  font-family: sans-serif;
}

.generate-btn {
  padding: 0.6rem 1.2rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  background-color: #4f46e5;
  color: white;
  border: none;
  border-radius: 6px;
  transition: background-color 0.2s ease;
}

.generate-btn:hover {
  background-color: #4338ca;
}

.display-box {
  margin-top: 1.5rem;
  padding: 1rem;
  background-color: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  line-height: 1.8;
}

.blank {
  border: 2px solid #9ca3af;
  border-radius: 4px;
}
.blank.perfect { border-color: #22c55e; } /* green  */
.blank.slant   { border-color: #eab308; } /* yellow */
.blank.none    { border-color: #ef4444; } /* red    */
</style>