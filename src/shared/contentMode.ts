import { readonly, ref } from 'vue'

/**
 * family: clean lyrics (the default).
 * explicit: the AI ghostwriter may cuss and trash-talk. It still never writes slurs or hate.
 * Only the AI ghostwriter reads this. Multiplayer has no AI writer, so players on either mode can
 * share a lobby.
 */
export type ContentMode = 'family' | 'explicit'

const KEY = 'rapkrazy-content-mode'

function load(): ContentMode {
  try {
    return localStorage.getItem(KEY) === 'explicit' ? 'explicit' : 'family'
  } catch {
    return 'family'
  }
}

const mode = ref<ContentMode>(load())

export function useContentMode() {
  function setMode(next: ContentMode) {
    mode.value = next
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* private mode: the choice lasts until the tab closes */
    }
  }
  return { mode: readonly(mode), setMode }
}

/** For non-component code (the lyrics service). */
export const currentContentMode = (): ContentMode => mode.value
