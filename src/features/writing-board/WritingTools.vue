<script setup lang="ts">
import templateIcon from '@/assets/write/template-icon.webp'
import robotHead from '@/assets/write/robot-head.webp'

// The two writing helpers from the team sketch, on round sticker buttons.
const emit = defineEmits<{ template: []; ghostwriter: [] }>()
</script>

<template>
  <section class="tools" aria-label="Writing helpers">
    <button class="tool" type="button" @click="emit('template')">
      <div class="disc ink glint">
        <img :src="templateIcon" alt="" width="300" height="353" />
      </div>
      <span class="toon">Random<br />template</span>
    </button>
    <button class="tool" type="button" @click="emit('ghostwriter')">
      <div class="disc ink glint">
        <img :src="robotHead" alt="" width="600" height="511" />
        <svg
          class="sparkle"
          viewBox="0 0 24 24"
          fill="#fff200"
          stroke="#0b0614"
          stroke-width="2"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path
            d="M12 1.5l2.6 6.4 6.9 1.1-5.2 4.6 1.5 6.9L12 16.9l-5.8 3.6 1.5-6.9L2.5 9l6.9-1.1z"
          />
        </svg>
      </div>
      <span class="toon">AI<br />ghostwriter</span>
    </button>
  </section>
</template>

<style scoped>
.tools {
  display: flex;
  justify-content: center;
  gap: 26px;
  flex-wrap: wrap;
  padding-top: 6px;
}
.tool {
  display: grid;
  justify-items: center;
  gap: 12px;
  background: none;
  border: 0;
  padding: 0;
}
.disc {
  position: relative;
  width: 104px;
  height: 104px;
  border-radius: 52% 48% 50% 50% / 48% 52% 48% 52%;
  display: grid;
  place-items: center;
  transition: transform 0.3s var(--spring);
}
.tool:nth-child(1) .disc {
  --fill: var(--cel-yellow);
  transform: rotate(-6deg);
}
.tool:nth-child(2) .disc {
  --fill: var(--cel-pink);
  transform: rotate(5deg);
}
.tool:nth-child(1) .disc img {
  width: 70%;
  translate: 2px 2px;
}
.tool:nth-child(2) .disc img {
  width: 76%;
  translate: 0 3px;
}
.sparkle {
  position: absolute;
  top: -10px;
  right: -8px;
  width: 32px;
}
.tool:hover .disc {
  animation: wobble 0.55s var(--spring);
}
.tool:hover .disc::before {
  box-shadow: var(--line-lift);
}
.tool:active .disc {
  animation: none;
  transform: translate(4px, 5px) scale(1.08, 0.9);
  transition-duration: 0.06s;
}
.tool:active .disc::before {
  box-shadow: var(--line-press);
}
@keyframes wobble {
  0% {
    transform: rotate(-6deg) scale(1);
  }
  30% {
    transform: rotate(10deg) scale(1.12, 0.94);
  }
  60% {
    transform: rotate(-8deg) scale(0.96, 1.08);
  }
  100% {
    transform: rotate(-4deg) scale(1.06);
  }
}
.tool span {
  font-size: 17px;
  text-align: center;
  line-height: 1.1;
}
</style>
