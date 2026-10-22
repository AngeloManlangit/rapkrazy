<script setup lang="ts">
import { ref, onMounted, computed, reactive } from 'vue'
import { generateTraceryText, assignRhymeScheme, parseSong , type Verdict, compareRhyme, isWord} from './template'

type Status = Verdict | 'pending'
const RANK: Verdict[] = ['perfect', 'slant', 'none'] 
const values = reactive<Record<string, string>>({});
const lines = computed(() => parseSong(outputText.value));
const outputText = ref<string>('')
const stanza1 = ref<string>('')
const stanza2 = ref<string>('')

const settled = reactive<Record<string, string>>({}) 
const timers = new Map<string, number>() // Each blank has their own timer for debouncing input

// Helper function to commit the value of a specific input field after a delay
function commit(id: string) {
  clearTimeout(timers.get(id))
  settled[id] = values[id] ?? ''
}
// Helper function to handle input changes with a debounce to avoid excessive updates
function onType(id: string) {
  clearTimeout(timers.get(id))
  timers.set(id, window.setTimeout(() => commit(id), 350))
}

// Generate new text and reset the state of the application
const handleGenerate = (): void => {
  stanza1.value = generateTraceryText()
  stanza1.value = assignRhymeScheme(stanza1.value, 1)
  stanza2.value = generateTraceryText()
  stanza2.value = assignRhymeScheme(stanza2.value, 2)
  outputText.value = `${stanza1.value}\n${stanza2.value}`
  Object.keys(values).forEach(k => delete values[k]); 
  Object.keys(settled).forEach(k => delete settled[k])
  timers.forEach(t => clearTimeout(t)); timers.clear()
}

// Compute the rhyme status for each blank based on the settled values, these will be used for CSS styling
const rhymeStatus = computed(() => {
  // group -> ids, from lines
  const groups = new Map<string, string[]>()
  for (const line of lines.value)
    for (const s of line)
      if (s.kind === 'blank' && s.group)
        groups.set(s.group, [...(groups.get(s.group) ?? []), s.id])

  const out: Record<string, Status> = {}
  for (const ids of groups.values()) {
    ids.forEach(id => (out[id] = 'pending'))

    const ready = ids.filter(id => isWord(settled[id] ?? ''))
    if (ready.length < 2) continue           // nothing valid to compare against

    for (const id of ready) {
      const verdicts = ready
        .filter(o => o !== id)
        .map(o => compareRhyme(settled[id] ?? '', settled[o] ?? ''))
      out[id] = RANK.find(v => verdicts.includes(v)) ?? 'pending'
    }
  }
  return out
})

onMounted(() => {
  handleGenerate()
})
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
            v-model= "values[segment.id]"
            :placeholder="`[${segment.id}:${segment.group}]`"
            :class="['blank', segment.type]"
            :size="Math.max((values[segment.id] ?? '').length, segment.type.length + 2)"
            @input="onType(segment.id)"
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
}

.display-box pre {
  margin: 0;
  white-space: pre-wrap; 
  font-family: inherit;
  font-size: 1.1rem;
  line-height: 1.6;
}
</style>