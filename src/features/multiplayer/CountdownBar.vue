<script setup lang="ts">
import { computed } from 'vue'

// The shared timer: a label, the seconds left, and an ink bar that drains. Turns pink for the
// last 10 seconds. Used by the writing turns, the word-writing step and the pre-rap countdown.

const props = defineProps<{
  seconds: number
  total: number
  label?: string
}>()

const pct = computed(() => Math.min(100, Math.max(0, (props.seconds / props.total) * 100)))
const hurry = computed(() => props.seconds <= 10)
</script>

<template>
  <div class="countdown" role="timer" :aria-label="`${seconds} seconds left`">
    <div class="top">
      <span v-if="label" class="tag">{{ label }}</span>
      <span class="clock toon" :class="{ hurry }">{{ seconds }}s</span>
    </div>
    <div class="timer ink" aria-hidden="true">
      <i :class="{ hurry }" :style="{ width: `${pct}%` }"></i>
    </div>
  </div>
</template>

<style scoped>
.countdown {
  display: grid;
  gap: 10px;
}
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.clock {
  margin-left: auto;
  font-size: 30px;
  color: var(--paper);
}
.clock.hurry {
  color: var(--pink);
  animation: tick 1s steps(2, end) infinite;
}
.timer {
  --fill: var(--cel-paper);
  height: 14px;
  border-radius: 999px;
  overflow: hidden;
}
.timer i {
  display: block;
  height: 100%;
  background: var(--cyan);
  transition: width 0.5s linear;
}
.timer i.hurry {
  background: var(--pink);
}
@keyframes tick {
  50% {
    transform: scale(1.12);
  }
}
</style>
