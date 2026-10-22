<script setup lang="ts">
// One of the five seats: a colored sticker with the player's name, or an empty dashed slot.
defineProps<{
  /** 0-4, picks the sticker color. */
  seat: number
  name?: string
  host?: boolean
  you?: boolean
  /** Whose turn it is while writing. */
  active?: boolean
}>()
</script>

<template>
  <li class="seat" :class="[`c${seat % 5}`, { empty: !name, active }]">
    <template v-if="name">
      <span class="name">{{ name }}</span>
      <span v-if="host" class="badge">Host</span>
      <span v-else-if="you" class="badge">You</span>
    </template>
    <span v-else class="name">Waiting...</span>
  </li>
</template>

<style scoped>
.seat {
  --c: var(--yellow);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  padding: 10px 14px;
  border-radius: 14px 18px 12px 16px;
  background: var(--c);
  color: var(--text-ink);
  font-weight: 700;
  box-shadow:
    0 0 0 3px var(--ink),
    4px 5px 0 3px var(--ink);
  transition: transform 0.2s var(--spring);
}
.c0 {
  --c: var(--yellow);
}
.c1 {
  --c: var(--cyan);
}
.c2 {
  --c: var(--pink);
}
.c3 {
  --c: var(--mint);
}
.c4 {
  --c: #c9a7ff;
}
.empty {
  background: transparent;
  color: var(--text);
  opacity: 0.6;
  box-shadow: none;
  border: 3px dashed currentColor;
}
.active {
  transform: translateY(-4px) rotate(-1.5deg);
}
.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.badge {
  flex: none;
  font-family: var(--display);
  font-size: 12px;
  letter-spacing: 0.08em;
  background: var(--ink);
  color: var(--yellow);
  padding: 3px 8px 1px;
  border-radius: 6px 9px 5px 10px;
}
</style>
