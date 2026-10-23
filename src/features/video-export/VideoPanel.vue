<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef } from 'vue'
import { beatClock } from '@/shared/audio'
import type { RobotRapper } from '@/features/robot/RobotRapper'
import headEyeless from '@/assets/write/robot-head-eyeless.webp'
import { recordRapVideo, type RapVideo } from './recordRapVideo'

// "Make video": plays the beat from the top with the robot rapping your lyrics, records it, and
// shows the result in a dialog that loops, with a download button.

const props = defineProps<{
  rapper: RobotRapper
  /** Bars to record: last written line + 1. 0 disables the button. */
  bars: number
  /** Flush pending edits into the rapper (synthesizes every chunk) before recording. */
  prepare: () => Promise<void>
}>()
const emit = defineEmits<{ toast: [msg: string] }>()

const status = ref<'idle' | 'recording' | 'done'>('idle')
const progress = ref(0)
const video = ref<RapVideo | null>(null)
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const player = useTemplateRef<HTMLVideoElement>('player')
let abort: AbortController | null = null

const busy = computed(() => status.value === 'recording')
const canRecord = computed(() => props.bars > 0 && !busy.value && !!beatClock.beat)

function discard() {
  if (video.value) URL.revokeObjectURL(video.value.url)
  video.value = null
}

async function start() {
  if (!canRecord.value) return
  status.value = 'recording'
  progress.value = 0
  abort = new AbortController()
  try {
    await props.prepare()
    const result = await recordRapVideo({
      clock: beatClock,
      rapper: props.rapper,
      headSrc: headEyeless,
      bars: props.bars,
      onProgress: (p) => (progress.value = p),
      signal: abort.signal,
    })
    discard()
    video.value = result
    status.value = 'done'
    dialog.value?.showModal()
    await nextTick()
    player.value?.play().catch(() => {}) // sound may need the play button
  } catch (e) {
    status.value = 'idle'
    if ((e as Error).name !== 'AbortError') {
      console.error('Video failed', e)
      emit('toast', (e as Error).message || 'Could not make the video')
    }
  }
}

function cancel() {
  abort?.abort()
}

function close() {
  player.value?.pause()
  dialog.value?.close()
}

onBeforeUnmount(() => {
  abort?.abort()
  discard()
})
</script>

<template>
  <div class="video-panel">
    <button class="make toon" type="button" :disabled="!canRecord" @click="start">
      {{ busy ? `Recording… ${Math.round(progress * 100)}%` : 'Make video' }}
    </button>
    <button v-if="busy" class="cancel toon" type="button" @click="cancel">Cancel</button>
    <p v-if="busy" class="note">Keep this tab open and visible while it records.</p>

    <dialog ref="dialog" class="preview" @close="player?.pause()">
      <video
        v-if="video"
        ref="player"
        :src="video.url"
        class="clip"
        controls
        loop
        playsinline
      />
      <div class="actions">
        <a v-if="video" class="make toon" :href="video.url" :download="`rap-verse.${video.ext}`">
          Download .{{ video.ext }}
        </a>
        <button class="cancel toon" type="button" @click="close">Close</button>
      </div>
    </dialog>
  </div>
</template>

<style scoped>
.video-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
.make,
.cancel {
  display: inline-block;
  font-family: var(--display);
  font-size: 20px;
  letter-spacing: 0.03em;
  color: var(--ink);
  background: var(--yellow);
  border: 0;
  border-radius: 14px 20px 12px 18px;
  box-shadow:
    0 0 0 3px var(--ink),
    5px 6px 0 3px var(--pink);
  padding: 10px 20px;
  cursor: pointer;
  text-decoration: none;
  transition: transform 0.2s var(--spring);
}
.cancel {
  background: #fff7e3;
  box-shadow:
    0 0 0 3px var(--ink),
    5px 6px 0 3px var(--ink);
}
.make:hover:not(:disabled),
.cancel:hover {
  transform: rotate(-1.5deg) scale(1.04);
}
.make:disabled {
  opacity: 0.55;
  cursor: default;
}
.note {
  margin: 0;
  flex-basis: 100%;
  text-align: center;
  font-size: 14px;
}
.preview {
  border: 0;
  padding: 18px;
  border-radius: 20px;
  background: var(--ink);
  box-shadow:
    0 0 0 3px var(--yellow),
    8px 9px 0 3px var(--pink);
  max-width: min(92vw, 560px);
}
.preview::backdrop {
  background: rgba(11, 6, 20, 0.7);
}
.clip {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 12px;
  background: #14061f;
}
.actions {
  display: flex;
  justify-content: center;
  gap: 14px;
  margin-top: 16px;
}
</style>
