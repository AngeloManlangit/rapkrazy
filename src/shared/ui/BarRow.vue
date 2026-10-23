<script setup lang="ts">
// One row of a NotebookSheet: a line number, the row's content (default slot), and beat balls with
// a sticker beside them. The playing row gets the yellow highlighter and the current ball pops.
withDefaults(
  defineProps<{
    num?: string | number
    /** Highlighted (this bar is playing). */
    active?: boolean
    /** Index of the ball that is sounding, -1 for none. */
    hit?: number
    /** Number of beat balls; a gap separates every 4. */
    beats?: number
  }>(),
  { active: false, hit: -1, beats: 4 },
)
</script>

<template>
  <li class="line" :class="{ active }">
    <span v-if="num !== undefined" class="num toon">{{ num }}</span>
    <slot />
    <div class="beats-row">
      <div class="dots" aria-hidden="true">
        <i v-for="b in beats" :key="b" :class="{ hit: b - 1 === hit }"></i>
      </div>
      <slot name="sticker" />
    </div>
  </li>
</template>

<style scoped>
.line {
  position: relative;
  isolation: isolate;
  padding: 8px 0 14px;
}
/* highlighter swipe on the bar being played */
.line::before {
  content: '';
  position: absolute;
  inset: 2px -8px 6px;
  z-index: -1;
  filter: url(#rough);
  background: var(--yellow);
  border-radius: 6px 14px 8px 12px;
  box-shadow:
    0 0 0 2.5px var(--ink),
    4px 5px 0 2.5px var(--ink);
  transform: scaleX(0) rotate(-0.8deg);
  transform-origin: left center;
  transition: transform 0.28s cubic-bezier(0.2, 0.9, 0.3, 1);
}
.line.active::before {
  transform: scaleX(1) rotate(-0.8deg);
}
.num {
  position: absolute;
  left: -48px;
  top: 13px;
  width: 30px;
  text-align: right;
  font-size: 20px;
  color: var(--pink);
}
.beats-row {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 9px 16px 0 8px;
}
.dots {
  flex: 1;
  display: flex;
  justify-content: space-between;
  max-width: 400px;
}
.dots i {
  width: 13px;
  height: 13px;
  border-radius: 50% 45% 55% 50%;
  box-shadow:
    0 0 0 3px var(--ink),
    2px 3px 0 3px var(--ink);
  transition:
    transform 0.18s var(--spring),
    background 0.05s;
}
/* a wider gap between bars when a row spans more than one */
.dots i:nth-child(4n):not(:last-child) {
  margin-right: 14px;
}
.dots i.hit {
  background: var(--pink);
  transform: scale(1.6) rotate(12deg);
}
@media (max-width: 640px) {
  .num {
    left: -42px;
  }
}
</style>
