<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { beatDuration, useBeatClock } from '@/shared/audio'
import headEyeless from '@/assets/write/robot-head-eyeless.webp'

// The robot on stage: Angelo's head on the boombox body. Purely visual; the voice comes from
// RobotRapper. Animations follow the shared beat clock: bob + speaker thump + notes on each
// beat, a new waveform each eighth note, a head tilt and squint on each sung word.

const props = defineProps<{
  /** Text the robot is singing right now ('' between words). */
  word: string
  /** Line element being typed in, so the eyes look at it instead of the cursor. */
  gazeTarget?: HTMLElement | null
  /** Shown in the bubble when not playing. */
  idleText: string
  /**
   * Keep grooving with no beat playing (main menu): bob, thump, notes and a moving waveform at
   * 90 BPM, singing `word` when it's set. Real playback takes over whenever the clock plays.
   */
  groove?: boolean
  /** Line under the robot when not playing. */
  hint?: string
}>()
const emit = defineEmits<{ toggle: [] }>()

type Mood = 'happy' | 'wow' | null

const { clock, isPlaying } = useBeatClock()
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

const robotEl = ref<HTMLButtonElement | null>(null)
const bob = ref(false)
const sing = ref(false)
const blinking = ref(false)
const lean = ref<'l' | 'r' | null>(null)
const mood = ref<Mood>(null)
const gaze = ref('0px 0px')
const bubblePop = ref(0)
const notes = ref<{ id: number; alt: boolean }[]>([])

const WAVE_IDLE = '128,204 136,192 144,212 152,188 160,210 168,196 180,203'
const wave = ref(WAVE_IDLE)

const grooving = computed(() => !!props.groove && !isPlaying.value && !reduceMotion)
const bubble = computed(() => {
  if (isPlaying.value) return props.word || 'â€¦'
  return grooving.value && props.word ? props.word : props.idleText
})

/* Mood: happy on hover, wide eyes on a soundboard hit. Parents call react(). */
let moodTimer: ReturnType<typeof setTimeout> | undefined
function react(m: Mood, ms?: number) {
  clearTimeout(moodTimer)
  mood.value = m
  if (m && ms) moodTimer = setTimeout(() => (mood.value = null), ms)
}
defineExpose({ react })

/* Beat: bob, speaker thump, a note from the speaker every other beat */
let noteId = 0
let bobTimer: ReturnType<typeof setTimeout> | undefined
function beatHit(beatInBar: number) {
  bob.value = true
  clearTimeout(bobTimer)
  bobTimer = setTimeout(() => (bob.value = false), 120)
  if (beatInBar % 2 === 0) notes.value.push({ id: noteId++, alt: beatInBar === 2 })
}
const offBeat = clock.onBeat((pos) => {
  if (reduceMotion || !clock.isPlaying) return
  beatHit(pos.beat)
})

/* Each sung word: pop the bubble and tilt the head the other way */
let words = 0
watch(
  () => props.word,
  (w) => {
    bubblePop.value++
    if (reduceMotion) return
    if (w) lean.value = words++ % 2 ? 'r' : 'l'
    else lean.value = null
  },
)
watch(isPlaying, (on) => {
  if (on) mood.value = null
  else {
    lean.value = null
    sing.value = false
    wave.value = WAVE_IDLE
  }
})

/* Eighth notes: fresh random waveform, squint on the first half of each eighth while singing */
let lastEighth = -1
let frame = 0
function tick() {
  frame = requestAnimationFrame(tick)
  const beat = clock.beat
  if (!clock.isPlaying || !beat || reduceMotion) return
  const eighths = (clock.currentTime() - beat.offsetMs / 1000) / (beatDuration(beat) / 2)
  sing.value = !!props.word && eighths % 1 < 0.55
  const idx = Math.floor(eighths)
  if (idx === lastEighth) return
  lastEighth = idx
  newWave()
}

/** A fresh random squiggle on the screen; taller while a word is sung. */
function newWave() {
  const energy = props.word ? 1 : 0.45
  const pts: string[] = []
  for (let i = 0; i < 8; i++) {
    const y = i === 0 || i === 7 ? 201 : 200 + (i % 2 ? -1 : 1) * (3 + Math.random() * 15 * energy)
    pts.push(`${(128 + i * 7.4).toFixed(1)},${y.toFixed(1)}`)
  }
  wave.value = pts.join(' ')
}

/* Groove mode: the same moves on a silent 90 BPM pulse, one step per eighth note. */
const GROOVE_EIGHTH_MS = 60000 / 90 / 2
let grooveTimer: ReturnType<typeof setInterval> | undefined
let grooveStep = 0
function grooveTick() {
  const step = grooveStep++
  if (step % 2 === 0) beatHit((step / 2) % 4)
  newWave()
  sing.value = !!props.word
  setTimeout(() => (sing.value = false), GROOVE_EIGHTH_MS * 0.55)
}
watch(
  grooving,
  (on) => {
    clearInterval(grooveTimer)
    if (on) grooveTimer = setInterval(grooveTick, GROOVE_EIGHTH_MS)
    else if (!isPlaying.value) {
      sing.value = false
      wave.value = WAVE_IDLE
    }
  },
  { immediate: true },
)

/* Eyes: random blinks, follow the cursor or the focused lyric line */
let blinkTimer: ReturnType<typeof setTimeout> | undefined
function blink() {
  blinking.value = true
  setTimeout(() => (blinking.value = false), 120)
}
function blinkLoop() {
  blinkTimer = setTimeout(
    () => {
      if (!reduceMotion) {
        blink()
        if (Math.random() < 0.25) setTimeout(blink, 220)
      }
      blinkLoop()
    },
    2200 + Math.random() * 3200,
  )
}
let lookFrame = 0
function lookAt(x: number, y: number) {
  cancelAnimationFrame(lookFrame)
  lookFrame = requestAnimationFrame(() => {
    const r = robotEl.value?.getBoundingClientRect()
    if (!r) return
    const dx = x - (r.left + r.width * 0.45)
    const dy = y - (r.top + r.height * 0.3)
    const k = Math.max(1, Math.hypot(dx, dy) / 260)
    gaze.value = `${((dx / k / 260) * 18).toFixed(1)}px ${((dy / k / 260) * 12).toFixed(1)}px`
  })
}
const onPointer = (e: PointerEvent) => {
  if (!props.gazeTarget) lookAt(e.clientX, e.clientY)
}
watch(
  () => props.gazeTarget,
  (el) => {
    if (!el) return
    const r = el.getBoundingClientRect()
    lookAt(r.left + r.width / 2, r.top + r.height / 2)
  },
)

onMounted(() => {
  addEventListener('pointermove', onPointer)
  frame = requestAnimationFrame(tick)
  blinkLoop()
})
onBeforeUnmount(() => {
  offBeat()
  removeEventListener('pointermove', onPointer)
  cancelAnimationFrame(frame)
  cancelAnimationFrame(lookFrame)
  clearTimeout(blinkTimer)
  clearInterval(grooveTimer)
  clearTimeout(bobTimer)
  clearTimeout(moodTimer)
})
</script>

<template>
  <section class="robot-stage" :class="{ live: isPlaying || grooving }" aria-label="Robot rapper">
    <div :key="bubblePop" class="bubble ink" :class="{ pop: bubblePop > 0 }" aria-live="polite">
      {{ bubble }}
      <!-- Paper tail with an ink outline: the fill reaches up over the bubble's bottom line so
           the two read as one shape; only the two sides get a stroke. -->
      <svg class="tail" viewBox="0 -5 30 30" aria-hidden="true">
        <polygon points="3,-4 25,-4 26,0 21,24 2,0" fill="#fff7e3" />
        <polyline
          points="2,0 21,24 26,0"
          fill="none"
          stroke="#0b0614"
          stroke-width="3"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
      </svg>
    </div>
    <button
      ref="robotEl"
      class="robot"
      :class="[
        {
          live: isPlaying || grooving,
          bob,
          sing,
          blink: blinking,
          'lean-l': lean === 'l',
          'lean-r': lean === 'r',
        },
        mood && `mood-${mood}`,
      ]"
      type="button"
      :aria-label="isPlaying ? 'Robot: click to stop' : 'Robot: click to hear your verse'"
      @click="emit('toggle')"
      @pointerenter="!isPlaying && react('happy')"
      @pointerleave="!isPlaying && react(null)"
    >
      <svg class="rb" viewBox="14 -18 214 262" aria-hidden="true" focusable="false">
        <g class="rb-upper" stroke="#0b0614" stroke-linejoin="round" stroke-linecap="round">
          <!-- body at 76% so the head leads -->
          <g transform="translate(115 150) scale(.76) translate(-115 -150)">
            <!-- accordion neck in the head's steel palette, tucked into a collar on the body -->
            <path d="M100 124 L130 124 L128 164 L102 164 Z" fill="#a9c1d7" stroke="none" />
            <path d="M121 124 L130 124 L128 164 L120 164 Z" fill="#96b0c7" stroke="none" />
            <path
              d="M101 137 Q115 142 129 137M101 150 Q115 155 129 150"
              fill="none"
              stroke-width="4.5"
            />
            <path d="M100 124 L130 124 L128 164 L102 164 Z" fill="none" stroke-width="6" />
            <!-- body: muted teal, flat fill shaded on the right edge only (Angelo's rule) -->
            <path
              d="M28 160 Q115 150 202 158 Q210 210 202 262 Q115 270 30 262 Q20 210 28 160 Z"
              fill="#4aa9c0"
              stroke="none"
            />
            <path
              d="M182 157 Q192 157 202 158 Q210 210 202 262 Q193 263 184 263 Q192 210 182 157 Z"
              fill="#37899f"
              stroke="none"
            />
            <path
              d="M28 160 Q115 150 202 158 Q210 210 202 262 Q115 270 30 262 Q20 210 28 160 Z"
              fill="none"
              stroke-width="6.5"
            />
            <path
              d="M82 162 Q115 152 148 161 L146 171 Q115 163 84 172 Z"
              fill="#24093a"
              stroke-width="5"
            />
            <g class="rb-speaker">
              <circle cx="76" cy="212" r="33" fill="#24093a" stroke-width="5.5" />
              <circle cx="76" cy="212" r="13" fill="#4a2a8a" stroke-width="4.5" />
              <path
                d="M58 196 Q66 188 76 188"
                fill="none"
                stroke="#fff7e3"
                stroke-width="3.5"
                opacity=".5"
              />
            </g>
            <path d="M122 182 L188 180 L186 224 L124 224 Z" fill="#0b3a4a" stroke-width="5.5" />
            <polyline :points="wave" fill="none" stroke="#f2e04a" stroke-width="4" />
            <circle cx="134" cy="244" r="7" fill="#f2e04a" stroke-width="4.5" />
            <circle cx="155" cy="244" r="7" fill="#e6589f" stroke-width="4.5" />
            <circle cx="176" cy="244" r="7" fill="#5fd3a0" stroke-width="4.5" />
          </g>
          <!-- Angelo's head with its eyes erased, so the eyes can be redrawn and animated -->
          <g class="rb-head">
            <g transform="rotate(-9 113 132) translate(40 2) scale(.29333)">
              <image :href="headEyeless" x="0" y="0" width="600" height="511" />
              <g
                class="rb-look"
                :style="{ translate: gaze }"
                stroke="#000000"
                stroke-width="13"
                fill="none"
              >
                <g class="rb-eye">
                  <path class="e-angry" d="M166,187 L210,236" />
                  <path class="e-happy" d="M150,236 Q182,188 218,230" />
                  <g class="e-wow">
                    <circle cx="190" cy="214" r="27" fill="#ddefff" stroke-width="11" />
                    <circle cx="190" cy="214" r="14" fill="#000000" stroke="none" />
                  </g>
                </g>
                <g class="rb-eye">
                  <path class="e-angry" d="M347,259 L426,215" />
                  <path class="e-happy" d="M344,256 Q386,204 432,244" />
                  <g class="e-wow">
                    <circle cx="388" cy="238" r="31" fill="#ddefff" stroke-width="11" />
                    <circle cx="388" cy="238" r="15" fill="#000000" stroke="none" />
                  </g>
                </g>
              </g>
            </g>
          </g>
          <g transform="translate(115 150) scale(.76) translate(-115 -150)">
            <g class="rb-mic">
              <path d="M202 200 C230 184 228 150 212 132" fill="none" stroke-width="11" />
              <path
                d="M200 98 Q212 92 224 98 L222 134 Q212 140 202 134 Z"
                fill="#3a3a4a"
                stroke-width="5.5"
              />
              <path
                d="M203 108 Q212 105 221 108M203 117 Q212 114 221 117"
                fill="none"
                stroke-width="3.5"
              />
            </g>
          </g>
        </g>
        <g
          v-for="n in notes"
          :key="n.id"
          class="rb-note"
          :class="{ alt: n.alt }"
          @animationend="notes = notes.filter((x) => x.id !== n.id)"
        >
          <g
            :transform="`translate(${n.alt ? 56 : 70} ${n.alt ? 206 : 184}) scale(.38)`"
            stroke="#0b0614"
            stroke-width="5"
            stroke-linejoin="round"
          >
            <ellipse
              cx="0"
              cy="0"
              rx="13"
              ry="10"
              transform="rotate(-20)"
              :fill="n.alt ? '#ff3da5' : '#fff200'"
            />
            <path d="M11,-4 L11,-44 Q26,-38 28,-22" fill="none" stroke-linecap="round" />
          </g>
        </g>
      </svg>
    </button>
    <p class="hint toon">{{ isPlaying ? 'Tap to stop' : (hint ?? 'Tap to hear your verse') }}</p>
  </section>
</template>

<style scoped>
.robot-stage {
  position: relative;
  isolation: isolate;
  display: grid;
  justify-items: center;
  gap: 8px;
  padding-top: 70px;
}
/* spotlight */
.robot-stage::before {
  content: '';
  position: absolute;
  z-index: -1;
  left: -4%;
  right: -4%;
  top: 52px;
  bottom: 40px;
  background: rgba(255, 255, 255, 0.08);
  clip-path: polygon(40% 0, 60% 0, 100% 100%, 0 100%);
  transition: background 0.3s;
}
.robot-stage.live::before {
  background: rgba(255, 242, 0, 0.15);
}
.robot {
  width: min(270px, 100%);
  background: none;
  border: 0;
  padding: 0;
  border-radius: 30px;
}
.rb {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
  filter: drop-shadow(6px 7px 0 var(--ink));
}
.rb * {
  transform-box: view-box;
}
.rb-upper {
  transition: translate 0.1s ease-out;
}
.rb-head {
  transform-origin: 113px 132px;
  transition:
    rotate 0.14s ease-out,
    scale 0.08s ease-out;
}
.rb-mic {
  transform-origin: 202px 200px;
  transition: rotate 0.14s ease-out;
}
.rb-speaker {
  transform-origin: 76px 212px;
  transition: scale 0.09s ease-out;
}
.robot:not(.live) .rb-upper {
  animation: breathe 2.6s ease-in-out infinite;
}
@keyframes breathe {
  50% {
    translate: 0 2px;
  }
}
.robot:not(.live):hover .rb-head {
  rotate: 7deg;
  transition: rotate 0.35s var(--spring);
}
.robot:not(.live):hover .rb-mic {
  rotate: -8deg;
  transition: rotate 0.35s var(--spring);
}
.robot.bob .rb-upper {
  translate: 0 4px;
}
.robot.bob .rb-speaker {
  scale: 1.14;
}
.robot.sing .rb-head {
  scale: 1.05 0.95;
}
.robot.sing .rb-mic {
  rotate: -6deg;
}
.robot.lean-l .rb-head {
  rotate: -6deg;
}
.robot.lean-r .rb-head {
  rotate: 5deg;
}
/* Eyes: angry by default, happy on hover, wide on a sound hit */
.rb-look {
  transition: translate 0.14s ease-out;
}
.rb-eye {
  transform-box: fill-box;
  transform-origin: center;
  transition: scale 0.07s ease-out;
}
.rb-eye .e-happy,
.rb-eye .e-wow {
  opacity: 0;
}
.robot.mood-happy .e-angry,
.robot.mood-wow .e-angry {
  opacity: 0;
}
.robot.mood-happy .e-happy,
.robot.mood-wow .e-wow {
  opacity: 1;
}
.robot.sing .rb-eye {
  scale: 1 0.72;
}
.robot.blink .rb-eye {
  scale: 1 0.1;
}
.rb-note {
  transform-box: fill-box;
  transform-origin: center;
  animation: float-note 1.1s ease-out forwards;
}
.rb-note.alt {
  animation-name: float-note-alt;
}
@keyframes float-note {
  from {
    translate: 0 0;
    scale: 0.5;
    opacity: 1;
  }
  70% {
    opacity: 1;
  }
  to {
    translate: -40px -55px;
    scale: 1.15;
    rotate: -18deg;
    opacity: 0;
  }
}
@keyframes float-note-alt {
  from {
    translate: 0 0;
    scale: 0.5;
    opacity: 1;
  }
  70% {
    opacity: 1;
  }
  to {
    translate: -55px -20px;
    scale: 1;
    rotate: 14deg;
    opacity: 0;
  }
}
.bubble {
  --fill: var(--cel-paper);
  position: absolute;
  top: 0;
  left: 4%;
  rotate: -3deg;
  z-index: 2;
  color: var(--text-ink);
  border-radius: 24px 18px 26px 14px / 18px 26px 14px 24px;
  font-family: var(--display);
  font-size: 24px;
  letter-spacing: 0.03em;
  padding: 10px 18px 5px;
  white-space: nowrap;
  max-width: 92%;
}
.tail {
  position: absolute;
  left: 60%;
  /* the fill's top edge covers the bubble's 3px outline below its bottom edge */
  bottom: -28px;
  width: 30px;
  height: 30px;
  overflow: visible;
  /* same offset ink shadow as the bubble, so the tail sits on the same "paper" */
  filter: drop-shadow(4px 5px 0 var(--ink));
}
.bubble.pop {
  animation: pop 0.22s var(--spring);
}
@keyframes pop {
  from {
    scale: 0.7;
  }
  to {
    scale: 1;
  }
}
.hint {
  margin: 0;
  font-size: 17px;
  text-align: center;
}
@media (max-width: 640px) {
  .robot {
    width: min(280px, 86%);
  }
}
</style>
