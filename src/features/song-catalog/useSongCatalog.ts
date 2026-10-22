import { readonly, ref } from 'vue'
import { barDuration } from '@/shared/audio'
import type { Beat } from '@/shared/types'
import { deleteSong, listSongs, saveSong } from './customSongs'
import { loadBeats } from './loadBeats'

/** Built-in beats followed by the player's custom songs. Shared by every component. */
const beats = ref<Beat[]>([])
const loaded = ref(false)
const error = ref('')
let loading: Promise<void> | null = null
/** Object URLs for custom songs (`Beat.file` is a `blob:` URL for those), by beat id. */
const urls = new Map<string, string>()

export interface NewSong {
  file: File
  title: string
  bpm: number
  /** Silence before beat 1, in ms. */
  offsetMs?: number
  beatsPerBar?: number
}

export const isCustom = (beat: Beat) => beat.id.startsWith('custom-')

function withUrl(beat: Omit<Beat, 'file'>, audio: Blob): Beat {
  let url = urls.get(beat.id)
  if (!url) {
    url = URL.createObjectURL(audio)
    urls.set(beat.id, url)
  }
  return { ...beat, file: url }
}

async function load(): Promise<void> {
  const [builtIn, custom] = await Promise.all([
    loadBeats(),
    // Custom songs are a bonus; private browsing or blocked storage must not break the menu.
    listSongs().catch(() => []),
  ])
  beats.value = [...builtIn, ...custom.map((s) => withUrl(s.beat, s.audio))]
  loaded.value = true
}

/** Decode just to learn the length, so totalBars matches the file. */
async function audioDuration(file: Blob): Promise<number> {
  const ctx = new OfflineAudioContext(1, 1, 44100)
  const buffer = await ctx.decodeAudioData(await file.arrayBuffer())
  return buffer.duration
}

export function useSongCatalog() {
  if (!loading) {
    loading = load().catch((e) => {
      loading = null
      error.value = (e as Error).message
    })
  }

  /** Add a song from the player's files. Throws if the file is not decodable audio. */
  async function addCustom(song: NewSong): Promise<Beat> {
    const duration = await audioDuration(song.file).catch(() => {
      throw new Error('That file is not audio this browser can play.')
    })
    const meta: Omit<Beat, 'file'> = {
      id: `custom-${crypto.randomUUID()}`,
      title: song.title.trim() || song.file.name.replace(/\.[^.]+$/, ''),
      creator: 'You',
      bpm: song.bpm,
      beatsPerBar: song.beatsPerBar ?? 4,
      offsetMs: song.offsetMs ?? 0,
      totalBars: 0,
      vibe: 'custom',
    }
    meta.totalBars = Math.max(
      1,
      Math.floor((duration - meta.offsetMs / 1000) / barDuration({ ...meta, file: '' })),
    )
    const beat = withUrl(meta, song.file)
    beats.value = [...beats.value, beat]
    // Still usable this session if saving fails (e.g. private browsing).
    await saveSong({ beat: meta, audio: song.file }).catch(() => {})
    return beat
  }

  async function removeCustom(id: string): Promise<void> {
    beats.value = beats.value.filter((b) => b.id !== id)
    const url = urls.get(id)
    if (url) URL.revokeObjectURL(url)
    urls.delete(id)
    await deleteSong(id).catch(() => {})
  }

  return {
    beats: readonly(beats),
    loaded: readonly(loaded),
    error: readonly(error),
    ready: () => loading ?? Promise.resolve(),
    addCustom,
    removeCustom,
  }
}
