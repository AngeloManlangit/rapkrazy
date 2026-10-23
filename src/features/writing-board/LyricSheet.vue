<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import NotebookSheet from '@/shared/ui/NotebookSheet.vue'
import BarRow from '@/shared/ui/BarRow.vue'
import { flowOf } from './flow'

// The taped notebook sheet: one line per bar, beat dots under each line, and a flow sticker
// (syllables per bar). The bar being played gets the yellow highlighter. Stays still: it is
// where you type.

const lines = defineModel<string[]>('lines', { required: true })
const props = defineProps<{
  /** Bar playing now, -1 when stopped. */
  activeBar: number
  /** Beat within the active bar. */
  beat: number
  beatsPerBar: number
}>()
const emit = defineEmits<{ focusLine: [el: HTMLElement | null] }>()

const sheet = useTemplateRef<InstanceType<typeof NotebookSheet>>('sheet')
const list = computed(() => sheet.value?.list ?? null)
const inputs = ref<HTMLTextAreaElement[]>([])
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The line list scrolls inside the sheet so the page fits one screen. While playing, follow the
 * active bar once it nears the bottom (or is above the view), parking it a third of the way
 * down. Skipped while the player is typing in the sheet, so the line under the cursor stays put.
 */
watch(
  () => props.activeBar,
  (bar) => {
    const box = list.value
    const li = box?.children[bar] as HTMLElement | undefined
    if (!box || !li || box.contains(document.activeElement)) return
    const top = li.offsetTop
    const bottom = top + li.offsetHeight
    if (top >= box.scrollTop && bottom <= box.scrollTop + box.clientHeight * 0.75) return
    box.scrollTo({
      top: top - box.clientHeight / 3,
      behavior: reduceMotion ? 'auto' : 'smooth',
    })
  },
)

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
  // Ref arrays from v-for are not guaranteed to be in list order, so go by position.
  list.value?.children[i + 1]?.querySelector('textarea')?.focus()
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
  <NotebookSheet
    ref="sheet"
    title="Verse 1"
    :note="`One line per bar · dots are the ${beatsPerBar} beats`"
  >
    <BarRow
      v-for="(text, i) in lines"
      :key="i"
      :num="i + 1"
      :active="i === activeBar"
      :hit="i === activeBar ? beat : -1"
      :beats="beatsPerBar"
    >
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
      <template #sticker>
        <span class="ink-sticker" :class="flowOf(text).kind">{{ flowOf(text).label }}</span>
      </template>
    </BarRow>
    <template #footer>
      <div class="legend" aria-label="Flow meter legend">
        <span class="ink-sticker thin">Too empty</span>
        <span class="ink-sticker ok">On flow</span>
        <span class="ink-sticker busy">Busy</span>
        <span class="ink-sticker crowd">Crowded</span>
        <span>syllables per bar, so you know if a line fits before the robot raps it</span>
      </div>
    </template>
  </NotebookSheet>
</template>

<style scoped>
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
.legend {
  flex: none;
  margin-top: 10px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
}
.legend .ink-sticker {
  min-width: 0;
  margin-left: 0;
  font-size: 11px;
}
</style>
