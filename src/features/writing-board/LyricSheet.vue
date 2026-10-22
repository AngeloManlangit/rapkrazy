<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { flowOf } from './flow'

// The taped notebook sheet: one line per bar, beat dots under each line, and a flow sticker
// (syllables per bar). The bar being played gets the yellow highlighter. Stays still: it is
// where you type.

const lines = defineModel<string[]>('lines', { required: true })
defineProps<{
  /** Bar playing now, -1 when stopped. */
  activeBar: number
  /** Beat within the active bar. */
  beat: number
  beatsPerBar: number
}>()
const emit = defineEmits<{ focusLine: [el: HTMLElement | null] }>()

const inputs = ref<HTMLTextAreaElement[]>([])

/** Grow each textarea to its content so long lines wrap instead of scrolling. */
function fit(ta: HTMLTextAreaElement) {
  ta.style.height = 'auto'
  ta.style.height = `${ta.scrollHeight}px`
}
const fitAll = () => inputs.value.forEach(fit)

function onInput(i: number, e: Event) {
  const ta = e.target as HTMLTextAreaElement
  // One line per bar: pasted newlines become spaces.
  const text = ta.value.replace(/\n/g, ' ')
  if (text !== ta.value) ta.value = text
  lines.value = lines.value.map((l, j) => (j === i ? text : l))
  fit(ta)
}

function nextLine(i: number) {
  inputs.value[i + 1]?.focus()
}

watch(lines, () => nextTick(fitAll))
let resizeTimer: ReturnType<typeof setTimeout> | undefined
const onResize = () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(fitAll, 100)
}
onMounted(() => {
  fitAll()
  document.fonts.ready.then(fitAll)
  addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  removeEventListener('resize', onResize)
  clearTimeout(resizeTimer)
})
</script>

<template>
  <div class="sheet ink">
    <span class="tape tape-l" aria-hidden="true"></span>
    <span class="tape tape-r" aria-hidden="true"></span>
    <div class="sheet-head">
      <h1 class="toon grad-pink">Verse 1</h1>
      <span>One line per bar · dots are the {{ beatsPerBar }} beats</span>
    </div>
    <ol class="lines">
      <li v-for="(text, i) in lines" :key="i" class="line" :class="{ active: i === activeBar }">
        <span class="num toon">{{ i + 1 }}</span>
        <textarea
          ref="inputs"
          :value="text"
          rows="1"
          :aria-label="`Bar ${i + 1} lyrics`"
          :placeholder="`Bar ${i + 1}…`"
          @input="onInput(i, $event)"
          @keydown.enter.prevent="nextLine(i)"
          @focus="emit('focusLine', $event.target as HTMLElement)"
          @blur="emit('focusLine', null)"
        ></textarea>
        <div class="beats-row">
          <div class="dots" aria-hidden="true">
            <i
              v-for="b in beatsPerBar"
              :key="b"
              :class="{ hit: i === activeBar && b - 1 === beat }"
            ></i>
          </div>
          <span class="flow" :class="flowOf(text).kind">{{ flowOf(text).label }}</span>
        </div>
      </li>
    </ol>
    <div class="legend" aria-label="Flow meter legend">
      <span class="flow thin">Too empty</span>
      <span class="flow ok">On flow</span>
      <span class="flow busy">Busy</span>
      <span class="flow crowd">Crowded</span>
      <span>syllables per bar, so you know if a line fits before the robot raps it</span>
    </div>
  </div>
</template>

<style scoped>
.sheet {
  --fill: var(--cel-paper);
  border-radius: 12px 16px 10px 18px;
  color: var(--text-ink);
  padding: 24px 24px 28px 58px;
  transform: rotate(0.6deg);
}
.sheet::before {
  background:
    linear-gradient(
      to right,
      transparent 38px,
      rgba(255, 61, 165, 0.7) 38px 41px,
      transparent 41px
    ),
    repeating-linear-gradient(to bottom, transparent 0 63px, var(--paper-line) 63px 65px),
    var(--paper);
  box-shadow:
    0 0 0 3.5px var(--ink),
    12px 14px 0 3.5px var(--ink);
}
/* Washi tape holding the sheet */
.tape {
  position: absolute;
  top: -15px;
  z-index: 2;
  width: 100px;
  height: 30px;
  background: repeating-linear-gradient(
    45deg,
    rgba(255, 61, 165, 0.82) 0 9px,
    rgba(255, 242, 0, 0.82) 9px 18px
  );
  box-shadow:
    0 0 0 2.5px var(--ink),
    3px 4px 0 2.5px var(--ink);
  clip-path: polygon(3% 0, 97% 4%, 100% 50%, 96% 100%, 2% 96%, 0 50%);
}
.tape-l {
  left: 26px;
  transform: rotate(-9deg);
}
.tape-r {
  right: 34px;
  transform: rotate(7deg);
}
.sheet-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.sheet-head h1 {
  margin: 0;
  font-size: clamp(30px, 3.2vw, 40px);
  text-wrap: balance;
  transform: rotate(-2deg);
}
.sheet-head span {
  font-weight: 500;
  font-size: 13px;
}
.lines {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.line {
  position: relative;
  isolation: isolate;
  padding: 10px 0 16px;
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
/* tapered, wavy pen stroke instead of a ruler-straight border */
textarea {
  display: block;
  width: 100%;
  resize: none;
  overflow: hidden;
  font-family: var(--marker);
  font-size: clamp(17px, 1.4vw, 20px);
  line-height: 1.35;
  color: var(--text-ink);
  border: 0;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 220 7'%3E%3Cpath d='M0 3C40 1.2 80 2.2 110 3.2S180 4.6 220 3L220 4.8C180 6.6 140 4.6 110 5.4S40 6 0 4.8Z' fill='%230b0614'/%3E%3C/svg%3E")
    left bottom / 220px 7px repeat-x;
  padding: 0 6px 7px;
}
textarea:focus {
  outline: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 220 7'%3E%3Cpath d='M0 2.6C40 .6 80 1.8 110 2.8S180 4.2 220 2.6L220 5.4C180 7 140 5 110 5.8S40 6.8 0 5.4Z' fill='%235a1fd1'/%3E%3C/svg%3E");
}
textarea::placeholder {
  color: rgba(11, 6, 20, 0.35);
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
.dots i.hit {
  background: var(--pink);
  transform: scale(1.6) rotate(12deg);
}
.flow {
  flex: none;
  margin-left: auto;
  font-family: var(--display);
  font-size: 13px;
  letter-spacing: 0.04em;
  border-radius: 999px 900px 999px 950px;
  padding: 5px 10px 2px;
  position: relative;
  isolation: isolate;
  min-width: 76px;
  text-align: center;
  transform: rotate(2deg);
}
/* fill + inked outline on ::before so the rough filter doesn't smear the label */
.flow::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  background: var(--flow-bg);
  box-shadow: var(--line-sm);
  filter: url(#rough);
}
.flow.ok {
  --flow-bg: linear-gradient(168deg, #b6ffd9 0 25%, var(--mint) 25% 70%, #1fd182 70%);
}
.flow.busy {
  --flow-bg: var(--cel-yellow);
}
.flow.crowd {
  --flow-bg: var(--cel-pink);
  color: var(--paper);
}
.flow.thin {
  --flow-bg: linear-gradient(168deg, #eef1f8 0 25%, var(--metal) 25% 70%, #9aa3bd 70%);
}
.legend {
  margin-top: 18px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
}
.legend .flow {
  min-width: 0;
  margin-left: 0;
  font-size: 11px;
}
@media (max-width: 640px) {
  .sheet {
    padding: 22px 16px 24px 50px;
    transform: none;
  }
  .sheet::before {
    background:
      linear-gradient(
        to right,
        transparent 32px,
        rgba(255, 61, 165, 0.7) 32px 35px,
        transparent 35px
      ),
      repeating-linear-gradient(to bottom, transparent 0 63px, var(--paper-line) 63px 65px),
      var(--paper);
  }
  .num {
    left: -42px;
  }
}
</style>
