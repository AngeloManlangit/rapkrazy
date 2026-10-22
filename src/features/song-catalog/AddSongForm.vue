<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Beat } from '@/shared/types'
import { useSongCatalog } from './useSongCatalog'

const emit = defineEmits<{ added: [beat: Beat]; cancel: [] }>()
const { addCustom } = useSongCatalog()

const file = ref<File | null>(null)
const title = ref('')
const bpm = ref<number | null>(null)
const offsetMs = ref(0)
const busy = ref(false)
const error = ref('')

const valid = computed(() => !!file.value && !!bpm.value && bpm.value >= 40 && bpm.value <= 240)

// Tap tempo: average the gaps between taps; a pause of 2 s starts a new measurement.
let taps: number[] = []
function tap() {
  const now = performance.now()
  if (taps.length && now - taps[taps.length - 1]! > 2000) taps = []
  taps = [...taps, now].slice(-8)
  if (taps.length < 2) return
  const avgGap = (taps[taps.length - 1]! - taps[0]!) / (taps.length - 1)
  const tapped = Math.round(60000 / avgGap)
  // Ignore double clicks and stray taps instead of filling in a nonsense tempo.
  if (tapped >= 40 && tapped <= 240) bpm.value = tapped
}

function pick(e: Event) {
  file.value = (e.target as HTMLInputElement).files?.[0] ?? null
  if (file.value && !title.value) title.value = file.value.name.replace(/\.[^.]+$/, '')
}

async function submit() {
  if (!valid.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const beat = await addCustom({
      file: file.value!,
      title: title.value,
      bpm: bpm.value!,
      offsetMs: offsetMs.value || 0,
    })
    emit('added', beat)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <form
    class="flex flex-col gap-3 rounded-lg border border-neutral-300 p-4"
    @submit.prevent="submit"
  >
    <h3 class="font-bold">Add your own beat</h3>
    <p class="text-sm text-neutral-600">
      Only use beats you made or have the rights to. It stays in this browser only.
    </p>

    <label class="flex flex-col gap-1 text-sm">
      Audio file
      <input type="file" accept="audio/*" required @change="pick" />
    </label>

    <label class="flex flex-col gap-1 text-sm">
      Title
      <input v-model="title" class="rounded border border-neutral-300 px-2 py-1" maxlength="60" />
    </label>

    <div class="flex flex-wrap items-end gap-2">
      <label class="flex flex-col gap-1 text-sm">
        BPM
        <input
          v-model.number="bpm"
          type="number"
          min="40"
          max="240"
          required
          class="w-24 rounded border border-neutral-300 px-2 py-1"
        />
      </label>
      <button type="button" class="rounded border px-3 py-1" @click="tap">Tap tempo</button>
      <label class="flex flex-col gap-1 text-sm">
        Start offset (ms)
        <input
          v-model.number="offsetMs"
          type="number"
          min="0"
          max="10000"
          step="10"
          class="w-28 rounded border border-neutral-300 px-2 py-1"
        />
      </label>
    </div>
    <p class="text-xs text-neutral-500">
      Don't know the BPM? Play the song elsewhere and tap along to the beat. Offset is the silence
      before the first beat.
    </p>

    <p v-if="error" class="text-sm text-red-700">{{ error }}</p>
    <div class="flex gap-2">
      <button
        type="submit"
        class="rounded bg-neutral-900 px-4 py-1 font-bold text-white disabled:opacity-40"
        :disabled="!valid || busy"
      >
        {{ busy ? 'Adding…' : 'Add song' }}
      </button>
      <button type="button" class="rounded border px-3 py-1" @click="emit('cancel')">Cancel</button>
    </div>
  </form>
</template>
