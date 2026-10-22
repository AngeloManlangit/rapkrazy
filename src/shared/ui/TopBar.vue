<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useBeatClock } from '@/shared/audio'
import logo from '@/assets/write/logo.webp'
import collab1 from '@/assets/write/collab-1.webp'
import collab2 from '@/assets/write/collab-2.webp'
import settings1 from '@/assets/write/settings-1.webp'
import settings2 from '@/assets/write/settings-2.webp'

// Back + Angelo's logo | the page's two-frame title | COLLAB and SETTINGS titles.
defineProps<{ title: string; frames: [string, string] }>()

const { clock } = useBeatClock()
const thump = ref(false)
const pop = ref(false)
let thumpTimer: ReturnType<typeof setTimeout> | undefined
const offBeat = clock.onBeat(() => {
  thump.value = true
  clearTimeout(thumpTimer)
  thumpTimer = setTimeout(() => (thump.value = false), 120)
})
onBeforeUnmount(() => {
  offBeat()
  clearTimeout(thumpTimer)
})

/** Restart the squash-pop even when clicked mid-animation. */
function popLogo(e: MouseEvent) {
  pop.value = false
  void (e.currentTarget as HTMLElement).offsetWidth
  pop.value = true
}
</script>

<template>
  <header class="topbar">
    <div class="brand">
      <RouterLink class="back ink" to="/" aria-label="Back to main menu">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="4"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </RouterLink>
      <button
        class="logo-btn"
        :class="{ pop }"
        type="button"
        aria-label="Rapkrazy"
        @click="popLogo"
        @animationend="pop = false"
      >
        <img class="logo" :class="{ thump }" :src="logo" alt="" width="720" height="266" />
        <span class="logo-shine" :style="{ '--logo': `url(${logo})` }" aria-hidden="true"></span>
      </button>
    </div>
    <div class="page-title boil" role="img" :aria-label="title">
      <img :src="frames[0]" alt="" width="720" height="326" /><img
        :src="frames[1]"
        alt=""
        width="720"
        height="326"
      />
    </div>
    <nav class="nav" aria-label="Menu">
      <RouterLink to="/collab" aria-label="Collab">
        <span class="boil"
          ><img :src="collab1" alt="" width="720" height="276" /><img
            :src="collab2"
            alt=""
            width="720"
            height="276"
        /></span>
      </RouterLink>
      <RouterLink to="/settings" aria-label="Settings">
        <span class="boil"
          ><img :src="settings1" alt="" width="720" height="250" /><img
            :src="settings2"
            alt=""
            width="720"
            height="250"
        /></span>
      </RouterLink>
    </nav>
  </header>
</template>

<style scoped>
.topbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 16px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}
.back {
  --fill: var(--cel-yellow);
  flex: none;
  display: inline-grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 52% 48% 55% 45% / 48% 55% 45% 52%;
  color: var(--text-ink);
  transition: transform 0.18s var(--spring);
}
.back:hover {
  transform: rotate(-10deg) scale(1.08);
}
.back:hover svg {
  animation: nudge 0.5s ease-in-out infinite alternate;
}
@keyframes nudge {
  to {
    transform: translateX(-3px);
  }
}
/* Logo: upright, floats gently, thumps on the beat, shine sweep, squash-pop on click */
.logo-btn {
  position: relative;
  display: block;
  width: min(200px, 100%);
  background: none;
  border: 0;
  padding: 0;
  transition: transform 0.25s var(--spring);
}
.logo {
  width: 100%;
  filter: drop-shadow(3px 4px 0 var(--ink));
  animation: logo-idle 3.2s ease-in-out infinite;
  transition: scale 0.09s ease-out;
}
.logo.thump {
  scale: 1.04;
}
.logo-shine {
  position: absolute;
  inset: 0;
  pointer-events: none;
  mask: var(--logo) center / 100% 100% no-repeat;
  background: linear-gradient(
      105deg,
      transparent 42%,
      rgba(255, 255, 255, 0.6) 50%,
      transparent 58%
    )
    100% 0 / 300% 100% no-repeat;
  animation: logo-shine 6s ease-in-out infinite;
}
.logo-btn:hover {
  transform: scale(1.06) rotate(-2deg);
}
.logo-btn:hover .logo-shine {
  animation-duration: 1.4s;
}
.logo-btn.pop {
  animation: logo-pop 0.5s var(--spring);
}
@keyframes logo-idle {
  50% {
    translate: 0 -3px;
  }
}
@keyframes logo-shine {
  0%,
  75% {
    background-position: 100% 0;
  }
  100% {
    background-position: 0 0;
  }
}
@keyframes logo-pop {
  30% {
    transform: scale(1.16, 0.86) rotate(4deg);
  }
  55% {
    transform: scale(0.94, 1.08) rotate(-3deg);
  }
  100% {
    transform: none;
  }
}
.page-title {
  width: clamp(150px, 19vw, 240px);
  transform: rotate(-2deg);
}
.nav {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
}
.nav a {
  display: block;
  width: clamp(96px, 10vw, 132px);
  transition: transform 0.25s var(--spring);
}
.nav a:hover {
  transform: scale(1.15) rotate(-3deg);
}
.nav a:hover .boil img + img {
  animation-duration: 0.18s;
}
@media (max-width: 700px) {
  .topbar {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .page-title {
    grid-column: 1 / -1;
    grid-row: 2;
    justify-self: center;
  }
  .logo-btn {
    width: min(150px, calc(100% - 64px));
  }
}
@media (max-width: 480px) {
  .nav {
    gap: 6px;
  }
  .nav a {
    width: 74px;
  }
}
</style>
