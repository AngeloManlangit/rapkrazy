import type { Beat } from '@/shared/types'

let cached: Promise<Beat[]> | null = null

/** The beat list from `public/beats/beats.json`. Fetched once, then cached. */
export function loadBeats(): Promise<Beat[]> {
  cached ??= fetch('/beats/beats.json').then((res) => {
    if (!res.ok) {
      cached = null
      throw new Error(`Could not load beats.json: ${res.status}`)
    }
    return res.json() as Promise<Beat[]>
  })
  return cached
}
