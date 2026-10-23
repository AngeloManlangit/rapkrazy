<script setup lang="ts">
import { useTemplateRef } from 'vue'

// The taped notebook sheet from /write: paper with a pink margin, washi tape, a title, and a
// scrolling list of bar rows (BarRow) in the default slot. Used by the lyric sheet and rap mode.
// Height comes from --sheet-h (default: fill the screen under the top bar).

defineProps<{ title: string; note?: string }>()

const list = useTemplateRef<HTMLOListElement>('list')
/** The scrolling list, for callers that follow the playing bar. */
defineExpose({ list })
</script>

<template>
  <div class="sheet ink">
    <span class="tape tape-l" aria-hidden="true"></span>
    <span class="tape tape-r" aria-hidden="true"></span>
    <div class="sheet-head">
      <h1 class="toon grad-pink">{{ title }}</h1>
      <slot name="head">
        <span v-if="note" class="note">{{ note }}</span>
      </slot>
    </div>
    <slot name="top" />
    <ol ref="list" class="lines">
      <slot />
    </ol>
    <slot name="footer" />
  </div>
</template>

<style scoped>
.sheet {
  --fill: var(--cel-paper);
  border-radius: 12px 16px 10px 18px;
  color: var(--text-ink);
  padding: 24px 24px 22px 58px;
  transform: rotate(0.6deg);
  /* only the line list scrolls */
  display: flex;
  flex-direction: column;
  height: var(--sheet-h, max(440px, calc(100dvh - 190px)));
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
.note {
  font-weight: 500;
  font-size: 13px;
}
/* Scroll box. Negative margins + padding pull the line numbers and the highlighter's overhang
   inside it so they aren't clipped; the mask fades lines at the edges as a scroll hint. */
.lines {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  list-style: none;
  margin: 0 -14px 0 -54px;
  padding: 10px 14px 18px 54px;
  display: flex;
  flex-direction: column;
  mask-image: linear-gradient(transparent, #000 12px, #000 calc(100% - 26px), transparent);
  scrollbar-width: thin;
  scrollbar-color: var(--pink) transparent;
}
/* stacked layouts scroll the page anyway; keep the sheet shorter than the screen */
@media (max-width: 1000px) {
  .sheet {
    height: var(--sheet-h, min(75dvh, 760px));
    min-height: 420px;
  }
}
@media (max-width: 640px) {
  .sheet {
    padding: 22px 16px 24px 50px;
    transform: none;
  }
  .lines {
    margin-left: -46px;
    padding-left: 46px;
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
}
</style>
