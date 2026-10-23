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
  /** Writes after the current turn. */
  next?: boolean
}>()
</script>

<template>
  <li class="seat" :class="[`c${seat % 5}`, { empty: !name, active }]">
    <template v-if="name">
      <span class="name">{{ name }}</span>
      <span v-if="active" class="badge now">Writing</span>
      <span v-else-if="next" class="badge up">Next</span>
      <span v-else-if="host" class="badge">Host</span>
      <span v-else-if="you" class="badge">You</span>
    </template>
    <span v-else class="name">Waiting</span>
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
/* A player sitting down: the sticker slaps onto the seat */
.seat:not(.empty) {
  animation: sit 0.45s var(--spring);
}
@keyframes sit {
  from {
    scale: 0.6 1.25;
    rotate: -6deg;
    opacity: 0;
  }
  60% {
    scale: 1.06 0.92;
  }
}
.seat:not(.empty):hover {
  transform: translateX(6px) rotate(-1.5deg);
}
/* Empty seats breathe and their dots tick, so the lobby feels like it is waiting */
.empty {
  animation: breathe 2.4s ease-in-out infinite;
}
@keyframes breathe {
  50% {
    opacity: 0.35;
  }
}
.empty .name::after {
  content: '';
  animation: seat-dots 1.2s steps(4, end) infinite;
}
@keyframes seat-dots {
  0% {
    content: '';
  }
  25% {
    content: '.';
  }
  50% {
    content: '..';
  }
  75% {
    content: '...';
  }
}
.badge {
  transition: transform 0.2s var(--spring);
}
.seat:hover .badge {
  transform: rotate(-8deg) scale(1.15);
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
.badge.now {
  color: var(--pink);
  animation: badge-bob 0.8s ease-in-out infinite alternate;
}
.badge.up {
  color: var(--mint);
}
@keyframes badge-bob {
  to {
    translate: 0 -3px;
    rotate: -6deg;
  }
}
</style>
