<script setup lang="ts">
import '@fontsource/luckiest-guy'
import '@fontsource/permanent-marker'
import '@fontsource/rubik/400.css'
import '@fontsource/rubik/500.css'
import '@fontsource/rubik/700.css'
import '@/shared/ui/ink.css'
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { barToSeconds, useBeatClock } from '@/shared/audio'
import InkFilters from '@/shared/ui/InkFilters.vue'
import MadeBy from '@/shared/ui/MadeBy.vue'
import RobotStage from '@/features/robot/RobotStage.vue'
import { EspeakVoice } from '@/features/robot/EspeakVoice'
import { RobotRapper } from '@/features/robot/RobotRapper'
import { loadBeats } from '@/features/song-catalog/loadBeats'
import { playSfx } from '@/features/soundboard/sfx'
import logo from '@/assets/write/logo.webp'
import write1 from '@/assets/write/write-1.webp'
import write2 from '@/assets/write/write-2.webp'
import collab1 from '@/assets/write/collab-1.webp'
import collab2 from '@/assets/write/collab-2.webp'
import settings1 from '@/assets/write/settings-1.webp'
import settings2 from '@/assets/write/settings-2.webp'

// Main menu: Angelo's logo with the robot grooving under it, and the three modes as ink cards in
// the /write style. The robot always dances (silently, so no autoplay); click it for a real beat
// and a short welcome rap.

const MENU = [
  {
    to: '/write',
    label: 'Write',
    frames: [write1, write2],
    height: 326,
    text: 'Write bars over a beat. The robot raps them back.',
    fill: 'var(--cel-yellow)',
  },
  {
    to: '/collab',
    label: 'Collab',
    frames: [collab1, collab2],
    height: 276,
    text: 'Pass the pen with up to 4 friends, one line each.',
    fill: 'var(--cel-pink)',
  },
  {
    to: '/settings',
    label: 'Settings',
    frames: [settings1, settings2],
    height: 250,
    text: 'Lyric mode and more.',
    fill: 'var(--cel-cyan)',
  },
]

const { clock, isPlaying, position } = useBeatClock()
const robot = useTemplateRef<InstanceType<typeof RobotStage>>('robot')

/* Silent groove: the robot "sings" a hype line, one word per beat. */
const HYPE = [
  'Yo!',
  'Welcome',
  'to',
  'Rapkrazy!',
  '',
  'Write',
  'your',
  'bars!',
  '',
  'Tap',
  'me',
  '',
  '',
]
const hypeIndex = ref(0)
let hypeTimer: ReturnType<typeof setInterval> | undefined

/* Click the robot: the first beat plays and the robot raps a short welcome on it. */
const INTRO = [
  'Welcome to Rapkrazy, step up to the mic',
  'write a couple bars and I will rap them tonight',
  'pick a beat and hit write or collab with your crew',
  'the robot on the stage is waiting on you',
]
const INTRO_START = 1
const INTRO_END = INTRO_START + INTRO.length
const rapper = new RobotRapper(new EspeakVoice())
rapper.options = { voice: 'en-us', speed: 250, pitch: 40, slotsPerBeat: 2, squeeze: true }
let preparing: Promise<void> | null = null
const ready = ref(false)

function prepareDemo() {
  preparing ??= (async () => {
    if (!clock.beat) {
      const first = (await loadBeats())[0]
      if (first) await clock.load(first)
    }
    await rapper.setLines(
      INTRO.map((text, i) => ({ id: `intro${i}`, text, bar: INTRO_START + i, bars: 1 })),
    )
    ready.value = true
  })().catch((e) => {
    preparing = null
    console.error('Menu demo failed to load', e)
  })
  return preparing
}

function toggleDemo() {
  if (clock.isPlaying) {
    clock.pause()
    return
  }
  if (!ready.value || !clock.beat) {
    void prepareDemo()
    robot.value?.react('happy', 1200)
    return
  }
  clock.seek(barToSeconds(clock.beat, 0))
  void clock.play()
}
// The welcome is 4 bars after a 1-bar intro; stop after it.
watch(
  () => position.value.bar,
  (bar) => {
    if (isPlaying.value && bar >= INTRO_END) clock.pause()
  },
)

const playWord = ref('')
let frame = 0
const poll = () => {
  playWord.value = clock.isPlaying ? (rapper.chunkAt(clock.currentTime())?.text ?? '') : ''
  frame = requestAnimationFrame(poll)
}
const robotWord = computed(() => (isPlaying.value ? playWord.value : HYPE[hypeIndex.value]!))
const robotHint = computed(() => (ready.value ? 'Tap me for a beat' : 'Tap me!'))

/* Logo: squash-pop and a record scratch on click. */
const pop = ref(false)
function popLogo(e: MouseEvent) {
  pop.value = false
  void (e.currentTarget as HTMLElement).offsetWidth
  pop.value = true
  playSfx('scratch')
}

/* Notes drifting up the background. Positions are fixed so the layout doesn't jump. */
const NOTES = [
  { x: 6, d: 0, s: 1, c: 'var(--yellow)' },
  { x: 18, d: 3.2, s: 0.8, c: 'var(--pink)' },
  { x: 31, d: 6.1, s: 1.2, c: 'var(--cyan)' },
  { x: 44, d: 1.6, s: 0.9, c: 'var(--mint)' },
  { x: 57, d: 4.8, s: 1.1, c: 'var(--yellow)' },
  { x: 70, d: 2.4, s: 0.7, c: 'var(--pink)' },
  { x: 83, d: 5.5, s: 1, c: 'var(--cyan)' },
  { x: 94, d: 0.8, s: 0.9, c: 'var(--mint)' },
]

onMounted(() => {
  hypeTimer = setInterval(() => (hypeIndex.value = (hypeIndex.value + 1) % HYPE.length), 667)
  rapper.start()
  frame = requestAnimationFrame(poll)
  // Warm up the voice in the background so the first tap plays right away.
  setTimeout(() => void prepareDemo(), 1500)
})
onBeforeUnmount(() => {
  clearInterval(hypeTimer)
  rapper.stop()
  cancelAnimationFrame(frame)
  clock.pause()
})
</script>

<template>
  <div class="rk home">
    <InkFilters />
    <div class="notes" aria-hidden="true">
      <span
        v-for="(n, i) in NOTES"
        :key="i"
        :style="{ left: `${n.x}%`, animationDelay: `${n.d}s`, scale: n.s, color: n.c }"
        >{{ i % 2 ? '♫' : '♪' }}</span
      >
    </div>

    <main class="menu-grid">
      <section class="left">
        <button
          class="logo-btn"
          :class="{ pop }"
          type="button"
          aria-label="Rapkrazy"
          @click="popLogo"
          @animationend="pop = false"
        >
          <img class="logo" :src="logo" alt="" width="720" height="266" />
          <span class="logo-shine" :style="{ '--logo': `url(${logo})` }" aria-hidden="true"></span>
        </button>

        <RobotStage
          ref="robot"
          class="home-robot"
          :word="robotWord"
          idle-text="Yo!"
          :hint="robotHint"
          groove
          @toggle="toggleDemo"
        />
      </section>

      <nav class="board panel ink halftone" aria-label="Main menu">
        <span class="tag">Pick a mode</span>
        <RouterLink
          v-for="(m, i) in MENU"
          :key="m.to"
          :to="m.to"
          class="mode ink glint"
          :style="{ '--fill': m.fill, '--i': i }"
          :aria-label="m.label"
          @mouseenter="robot?.react('happy')"
          @mouseleave="robot?.react(null)"
          @click="playSfx('yeah')"
        >
          <span class="boil title"
            ><img :src="m.frames[0]" alt="" width="720" :height="m.height" /><img
              :src="m.frames[1]"
              alt=""
              width="720"
              :height="m.height"
          /></span>
          <span class="blurb">{{ m.text }}</span>
          <span class="go" aria-hidden="true">➜</span>
        </RouterLink>
      </nav>
    </main>

    <footer class="credit"><MadeBy /></footer>
  </div>
</template>

<style scoped>
.home {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  padding: 18px max(16px, env(safe-area-inset-right, 0px)) 24px
    max(16px, env(safe-area-inset-left, 0px));
  display: flex;
  flex-direction: column;
}
.menu-grid {
  flex: 1;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 32px;
  align-items: center;
}

/* Left: logo, then the robot on its stage */
.left {
  display: grid;
  justify-items: center;
  gap: 4px;
}
.logo-btn {
  position: relative;
  display: block;
  width: min(560px, 100%);
  background: none;
  border: 0;
  padding: 0;
  transition: transform 0.3s var(--spring);
}
.logo {
  width: 100%;
  filter: drop-shadow(5px 6px 0 var(--ink));
  animation: logo-idle 3.2s ease-in-out infinite;
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
  animation: logo-shine 5s ease-in-out infinite;
}
.logo-btn:hover {
  transform: scale(1.05) rotate(-2deg);
}
.logo-btn:hover .logo-shine {
  animation-duration: 1.3s;
}
.logo-btn.pop {
  animation: logo-pop 0.5s var(--spring);
}
@keyframes logo-idle {
  50% {
    translate: 0 -6px;
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
    transform: scale(1.12, 0.88) rotate(3deg);
  }
  55% {
    transform: scale(0.95, 1.07) rotate(-2deg);
  }
}
.home-robot {
  width: min(380px, 100%);
}
.home-robot :deep(.robot) {
  width: min(320px, 100%);
}

/* Right: the three modes as ink cards on the cyan board */
.board {
  display: grid;
  gap: 22px;
  padding: 26px 28px 30px;
  transform: rotate(0.8deg);
  animation: board-in 0.55s var(--spring) backwards;
}
@keyframes board-in {
  from {
    translate: 40px 0;
    opacity: 0;
  }
}
.board .tag {
  justify-self: start;
}
.mode {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    'title go'
    'blurb go';
  align-items: center;
  gap: 4px 16px;
  padding: 16px 22px 18px;
  border-radius: 20px 26px 18px 24px;
  color: var(--text-ink);
  text-decoration: none;
  rotate: calc((var(--i) - 1) * -1.5deg);
  transition: transform 0.3s var(--spring);
  animation: mode-in 0.5s var(--spring) calc(0.15s + var(--i) * 0.1s) backwards;
}
@keyframes mode-in {
  from {
    translate: 30px 0;
    scale: 0.9;
    opacity: 0;
  }
}
.mode:hover,
.mode:focus-visible {
  transform: translateX(-10px) translateY(-6px) scale(1.04);
  /* Keep the (finished) entrance in the list: replacing it would replay it on unhover, and its
     first frame is invisible, so the card would blink out. */
  animation:
    mode-in 0.5s var(--spring) calc(0.15s + var(--i) * 0.1s) backwards,
    jelly 0.55s var(--spring);
}
@keyframes jelly {
  30% {
    scale: 1.05 0.94;
  }
  60% {
    scale: 0.98 1.04;
  }
}
.mode:hover::before,
.mode:focus-visible::before {
  box-shadow:
    var(--shade),
    0 0 0 3px var(--ink),
    14px 18px 0 3px var(--ink);
}
.mode:active {
  transform: translate(4px, 5px) scale(1.02, 0.94);
  transition-duration: 0.06s;
}
.mode:active::before {
  box-shadow: var(--line-press);
}
.title {
  grid-area: title;
  width: min(230px, 100%);
  filter: drop-shadow(3px 4px 0 var(--ink));
  transform-origin: left center;
  transition: transform 0.3s var(--spring);
}
.mode:hover .title {
  transform: scale(1.06);
}
.mode:hover .title img + img {
  animation-duration: 0.18s;
}
.blurb {
  grid-area: blurb;
  font-weight: 700;
  font-size: 15px;
}
.go {
  grid-area: go;
  font-family: var(--display);
  font-size: 34px;
  color: var(--ink);
  transition: transform 0.3s var(--spring);
}
.mode:hover .go {
  transform: translateX(8px) scale(1.2);
  animation: nudge 0.5s ease-in-out infinite alternate;
}
@keyframes nudge {
  to {
    translate: 6px 0;
  }
}

/* Drifting notes */
.notes {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}
.notes span {
  position: absolute;
  bottom: -40px;
  font-size: 34px;
  text-shadow: 3px 3px 0 var(--ink);
  opacity: 0;
  animation: drift 9s linear infinite;
}
@keyframes drift {
  0% {
    translate: 0 0;
    rotate: -10deg;
    opacity: 0;
  }
  10% {
    opacity: 0.55;
  }
  50% {
    translate: 24px -50vh;
    rotate: 12deg;
  }
  90% {
    opacity: 0.4;
  }
  100% {
    translate: -10px -105vh;
    rotate: -8deg;
    opacity: 0;
  }
}
.menu-grid,
.credit {
  position: relative;
  z-index: 1;
}
.credit {
  display: flex;
  justify-content: flex-start;
  max-width: 1280px;
  width: 100%;
  margin: 12px auto 0;
}

@media (max-width: 860px) {
  .menu-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .board {
    transform: none;
  }
  .credit {
    justify-content: center;
  }
}
</style>
