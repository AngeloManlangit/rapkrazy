<script setup lang="ts">
import { ref, onMounted, computed, reactive } from 'vue'
import { generateTraceryText, assignRhymeScheme, parseSong } from './template'

const values = reactive<Record<string, string>>({});
const lines = computed(() => parseSong(outputText.value));
const outputText = ref<string>('')
const stanza1 = ref<string>('')
const stanza2 = ref<string>('')
const handleGenerate = (): void => {
  stanza1.value = generateTraceryText()
  stanza1.value = assignRhymeScheme(stanza1.value, 1)
  stanza2.value = generateTraceryText()
  stanza2.value = assignRhymeScheme(stanza2.value, 2)
  outputText.value = `${stanza1.value}\n${stanza2.value}`
  Object.keys(values).forEach(k => delete values[k]); 
  console.log('Generated new text:', lines.value)
}
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
            :placeholder="`${segment.type}${segment.group ? ':' + segment.group : ''}`"
            :class="['blank', segment.type]"
            :size="Math.max((values[segment.id] ?? '').length, segment.type.length + 2)"
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