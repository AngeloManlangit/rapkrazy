<script setup lang="ts">
// Counts the beats of the bar being rapped: 1, 2, 3, then the last beat, where the rhyme word
// has to land. Same beat meter idea as the music player on the Write page, but big and numbered.

defineProps<{
  /** Beat playing now (0-based), -1 when stopped. */
  beat: number
  beatsPerBar: number
}>()
</script>

<template>
  <div class="counter" aria-hidden="true">
    <div
      v-for="i in beatsPerBar"
      :key="i"
      class="dot ink"
      :class="{ on: beat === i - 1, last: i === beatsPerBar, past: beat > i - 1 }"
    >
      <span class="num toon">{{ i }}</span>
      <small v-if="i === beatsPerBar" class="land">rhyme!</small>
    </div>
  </div>
</template>

<style scoped>
.counter {
  display: flex;
  justify-content: center;
  gap: 14px;
}
.dot {
  --fill: var(--cel-paper);
  position: relative;
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 52% 48% 55% 45% / 48% 55% 45% 52%;
  color: var(--text-ink);
  transition: transform 0.15s var(--spring);
}
.dot::before {
  box-shadow: var(--line-sm);
}
.num {
  font-size: 28px;
  color: var(--ink);
  -webkit-text-stroke: 0;
  text-shadow: none;
}
.dot.past {
  --fill: var(--cel-cyan);
}
.dot.on {
  --fill: var(--cel-yellow);
  transform: scale(1.3) rotate(-4deg);
}
.dot.last {
  --fill: var(--cel-pink);
}
.dot.last .num {
  color: var(--paper);
  text-shadow: 2px 2px 0 var(--ink);
}
.dot.last.on {
  --fill: var(--cel-yellow);
}
.dot.last.on .num {
  color: var(--ink);
  text-shadow: none;
}
.land {
  position: absolute;
  bottom: -18px;
  font-family: var(--display);
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--yellow);
  text-shadow: 1px 2px 0 var(--ink);
}
@media (max-width: 480px) {
  .dot {
    width: 52px;
    height: 52px;
  }
  .counter {
    gap: 10px;
  }
}
</style>
