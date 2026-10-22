import type { Beat } from '@/shared/types'

/** A song the player added from their own files. Stored only in this browser (IndexedDB). */
export interface StoredSong {
  beat: Omit<Beat, 'file'>
  audio: Blob
}

const DB_NAME = 'rapkrazy'
const STORE = 'custom-songs'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export const listSongs = () => run<StoredSong[]>('readonly', (s) => s.getAll())
export const saveSong = (song: StoredSong) => run('readwrite', (s) => s.put(song, song.beat.id))
export const deleteSong = (id: string) => run('readwrite', (s) => s.delete(id))
