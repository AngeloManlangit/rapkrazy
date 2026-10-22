<script setup lang="ts">
import { ref } from 'vue'
import { playSfx, type SfxKind } from './sfx'

// Soundboard pads. Each hit lights the pad and bursts a yellow star behind it.
const emit = defineEmits<{ hit: [kind: SfxKind]; add: [] }>()

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
const lit = ref<SfxKind | null>(null)
const bursts = ref<{ id: number; kind: SfxKind }[]>([])
let burstId = 0
let litTimer: ReturnType<typeof setTimeout> | undefined

function hit(kind: SfxKind) {
  playSfx(kind)
  lit.value = kind
  clearTimeout(litTimer)
  litTimer = setTimeout(() => (lit.value = null), 180)
  if (!reduceMotion) bursts.value.push({ id: burstId++, kind })
  emit('hit', kind)
}

const removeBurst = (id: number) => (bursts.value = bursts.value.filter((b) => b.id !== id))
</script>

<template>
  <section class="panel ink halftone sound" aria-label="Soundboard">
    <div class="sound-head">
      <h2 class="toon grad">Soundboard</h2>
      <svg
        width="44"
        height="44"
        viewBox="0 0 24 24"
        fill="#fff200"
        stroke="#0b0614"
        stroke-width="2"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M3 10v4h4l7 5V5L7 10z" />
        <path d="M17 9c1.5 1.5 1.5 4.5 0 6M19.5 6.5c3 3 3 8 0 11" fill="none" />
      </svg>
    </div>
    <div class="pads">
      <button
        class="btn-pad ink glint"
        :class="{ lit: lit === 'horn' }"
        type="button"
        @click="hit('horn')"
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="#ff3da5"
          stroke="#0b0614"
          stroke-width="2"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M3 9v6h3l9 5V4L6 9z" />
          <path d="M18 8l3-2M18 12h3M18 16l3 2" fill="none" />
        </svg>
        Air horn
        <span
          v-for="b in bursts.filter((x) => x.kind === 'horn')"
          :key="b.id"
          class="burst"
          @animationend="removeBurst(b.id)"
        ></span>
      </button>
      <button
        class="btn-pad ink glint yeah"
        :class="{ lit: lit === 'yeah' }"
        type="button"
        @click="hit('yeah')"
      >
        YEAH!
        <span
          v-for="b in bursts.filter((x) => x.kind === 'yeah')"
          :key="b.id"
          class="burst"
          @animationend="removeBurst(b.id)"
        ></span>
      </button>
      <button
        class="btn-pad ink glint"
        :class="{ lit: lit === 'scratch' }"
        type="button"
        @click="hit('scratch')"
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#0b0614"
          stroke-width="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" fill="#24093a" />
          <circle cx="12" cy="12" r="3" fill="#fff200" />
          <path d="M5 5l3 3" stroke="#fff7e3" />
        </svg>
        Scratch
        <span
          v-for="b in bursts.filter((x) => x.kind === 'scratch')"
          :key="b.id"
          class="burst"
          @animationend="removeBurst(b.id)"
        ></span>
      </button>
      <button
        class="btn-pad add ink"
        type="button"
        aria-label="Add your own sound"
        @click="emit('add')"
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#0b0614"
          stroke-width="3.2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  </section>
</template>

<style scoped>
.sound {
  transform: rotate(1.6deg);
}
.sound-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 16px;
}
.sound-head h2 {
  margin: 0;
  font-size: 30px;
}
.sound-head svg {
  transform: rotate(-12deg);
}
.pads {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.btn-pad {
  --fill: var(--cel-paper);
  aspect-ratio: 1.25;
  max-width: 100%;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 2px;
  border-radius: 14px 20px 12px 22px / 20px 12px 22px 14px;
  color: var(--text-ink);
  font-family: var(--display);
  font-size: 18px;
  letter-spacing: 0.04em;
  transition: transform 0.2s var(--spring);
}
.btn-pad.yeah {
  font-size: 26px;
}
.btn-pad:hover {
  transform: translate(-2px, -4px) rotate(-2deg);
}
.btn-pad.lit {
  --fill: var(--cel-yellow);
}
.btn-pad.add {
  --fill: transparent;
}
.btn-pad.add::before {
  box-shadow: none;
  outline: 3px dashed var(--ink);
  outline-offset: -3px;
  filter: none;
}
.btn-pad.add:hover svg {
  animation: spin 0.5s var(--spring);
}
@keyframes spin {
  to {
    transform: rotate(90deg);
  }
}
.burst {
  position: absolute;
  inset: -18%;
  z-index: -2;
  pointer-events: none;
  background: var(--yellow);
  clip-path: polygon(
    50% 0,
    60% 30%,
    92% 12%,
    72% 42%,
    100% 55%,
    68% 64%,
    82% 98%,
    52% 74%,
    28% 100%,
    32% 66%,
    0 60%,
    28% 44%,
    6% 12%,
    40% 30%
  );
  animation: burst 0.35s ease-out forwards;
}
@keyframes burst {
  from {
    transform: scale(0.3) rotate(-20deg);
    opacity: 1;
  }
  to {
    transform: scale(1.15) rotate(10deg);
    opacity: 0;
  }
}
@media (max-width: 640px) {
  .sound {
    transform: none;
  }
}
</style>
