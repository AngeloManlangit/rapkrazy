<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { trackDuration, useBeatClock } from '@/shared/audio'
import type { Beat } from '@/shared/types'
import AddSongForm from './AddSongForm.vue'
import { isCustom, useSongCatalog } from './useSongCatalog'

// osu!-style song select: scrollable cards on the right, details of the selected one on the
// left. Selecting a song loads it into the shared beatClock and plays a preview.

const props = withDefaults(defineProps<{ preview?: boolean }>(), { preview: true })
const emit = defineEmits<{
  /** The highlighted song changed (already loaded into beatClock). */
  select: [beat: Beat]
  /** The player picked this song (button, Enter or double click). */
  confirm: [beat: Beat]
}>()

const { clock } = useBeatClock()
const { beats, loaded, error, ready, removeCustom } = useSongCatalog()

const query = ref('')
const selectedId = ref<string | null>(null)
const adding = ref(false)
const list = ref<HTMLElement | null>(null)

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return beats.value
  return beats.value.filter((b) =>
    [b.title, b.creator, b.vibe ?? '', String(b.bpm)].some((f) => f.toLowerCase().includes(q)),
  )
})
const selected = computed(() => beats.value.find((b) => b.id === selectedId.value) ?? null)

// Highlight the first song once the list arrives, without auto-playing (no click yet).
ready().then(() => {
  const first = beats.value[0]
  if (first && !selectedId.value) select(first, false)
})

/** Load into the clock and, when this came from a click or key press, play a preview. */
async function select(beat: Beat, play = props.preview) {
  if (beat.id === selectedId.value) return
  selectedId.value = beat.id
  emit('select', beat)
  const loading = clock.load(beat)
  // play() waits for the decode itself; calling it now keeps it inside the user gesture.
  if (play) clock.play()
  await loading
}

function move(step: number) {
  const items = visible.value
  if (!items.length) return
  const i = items.findIndex((b) => b.id === selectedId.value)
  const next = items[Math.min(Math.max(i + step, 0), items.length - 1)]
  if (next) select(next)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') move(1)
  else if (e.key === 'ArrowUp') move(-1)
  else if (e.key === 'Enter' && selected.value) emit('confirm', selected.value)
  else return
  e.preventDefault()
}

watch(selectedId, async (id) => {
  await nextTick()
  list.value
    ?.querySelector(`[data-id="${id}"]`)
    ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
})

async function remove(beat: Beat) {
  if (!confirm(`Remove "${beat.title}" from your songs?`)) return
  const i = visible.value.findIndex((b) => b.id === beat.id)
  if (selectedId.value === beat.id) {
    clock.stop()
    selectedId.value = null
  }
  await removeCustom(beat.id)
  const next = visible.value[Math.min(i, visible.value.length - 1)]
  if (next) select(next, false)
}

function added(beat: Beat) {
  adding.value = false
  select(beat)
}

function fmt(seconds: number) {
  const s = Math.round(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
</script>

<template>
  <section class="grid gap-4 md:grid-cols-[1fr_1.2fr]">
    <!-- Details of the highlighted song -->
    <div class="flex flex-col gap-3 rounded-lg border border-neutral-300 p-4">
      <template v-if="selected">
        <p class="text-xs font-bold tracking-widest text-neutral-500 uppercase">
          {{ selected.vibe ?? 'beat' }}
        </p>
        <h2 class="text-2xl font-black break-words">{{ selected.title }}</h2>
        <p class="text-neutral-600">by {{ selected.creator }}</p>
        <dl class="grid grid-cols-3 gap-2 text-center">
          <div class="rounded bg-neutral-100 p-2">
            <dt class="text-xs text-neutral-500">BPM</dt>
            <dd class="text-lg font-bold">{{ selected.bpm }}</dd>
          </div>
          <div class="rounded bg-neutral-100 p-2">
            <dt class="text-xs text-neutral-500">Bars</dt>
            <dd class="text-lg font-bold">{{ selected.totalBars }}</dd>
          </div>
          <div class="rounded bg-neutral-100 p-2">
            <dt class="text-xs text-neutral-500">Length</dt>
            <dd class="text-lg font-bold">{{ fmt(trackDuration(selected)) }}</dd>
          </div>
        </dl>
        <div class="mt-auto flex flex-wrap gap-2">
          <button
            class="rounded bg-neutral-900 px-4 py-2 font-bold text-white"
            @click="emit('confirm', selected)"
          >
            Write to this beat
          </button>
          <button
            v-if="isCustom(selected)"
            class="rounded border px-3 py-2 text-sm"
            @click="remove(selected)"
          >
            Remove
          </button>
        </div>
      </template>
      <p v-else-if="error" class="text-red-700">{{ error }}</p>
      <p v-else-if="!loaded" class="text-neutral-500">Loading songs…</p>
      <p v-else class="text-neutral-500">Pick a song.</p>
    </div>

    <!-- Song list -->
    <div class="flex min-w-0 flex-col gap-2">
      <input
        v-model="query"
        type="search"
        placeholder="Search title, creator, vibe or bpm"
        aria-label="Search songs"
        class="rounded border border-neutral-300 px-3 py-2"
      />
      <ul
        ref="list"
        class="flex max-h-[60vh] flex-col gap-2 overflow-y-auto overflow-x-hidden py-1 pr-1 pl-6 outline-none"
        tabindex="0"
        role="listbox"
        aria-label="Songs"
        :aria-activedescendant="selectedId ? `song-${selectedId}` : undefined"
        @keydown="onKey"
      >
        <li
          v-for="b in visible"
          :id="`song-${b.id}`"
          :key="b.id"
          :data-id="b.id"
          role="option"
          :aria-selected="b.id === selectedId"
          class="cursor-pointer rounded-lg border p-3 transition-all duration-150"
          :class="
            b.id === selectedId
              ? '-translate-x-5 border-neutral-900 bg-neutral-900 text-white shadow-lg'
              : 'border-neutral-300 bg-white opacity-80 hover:-translate-x-2 hover:opacity-100'
          "
          @click="select(b)"
          @dblclick="emit('confirm', b)"
        >
          <p class="truncate font-bold">{{ b.title }}</p>
          <p class="truncate text-sm opacity-70">
            {{ b.creator }} · {{ b.bpm }} bpm<span v-if="b.vibe"> · {{ b.vibe }}</span>
          </p>
        </li>
        <li v-if="loaded && !visible.length" class="p-3 text-neutral-500">No songs match.</li>
      </ul>

      <AddSongForm v-if="adding" @added="added" @cancel="adding = false" />
      <button v-else class="rounded border border-dashed px-3 py-2" @click="adding = true">
        + Add custom song
      </button>
    </div>
  </section>
</template>
