// Generates original placeholder beats into public/beats/ plus beats.json.
// Synthesized from scratch (no samples), so there is nothing to license. Timing is exact,
// which makes them good for testing sync. Replace with real beats by editing beats.json.
//
//   node scripts/gen-placeholder-beats.mjs

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SR = 22050
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'beats')

/** Seeded RNG so reruns produce identical files (no noisy git diffs). */
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const midi = (n) => 440 * 2 ** ((n - 69) / 12)

function makeTrack(seconds, seed) {
  const buf = new Float32Array(Math.ceil(seconds * SR))
  const rand = rng(seed)
  const add = (start, length, fn) => {
    const i0 = Math.round(start * SR)
    const n = Math.min(Math.round(length * SR), buf.length - i0)
    for (let i = 0; i < n; i++) buf[i0 + i] += fn(i / SR)
  }

  return {
    buf,
    kick(at, level = 0.9) {
      let phase = 0
      add(at, 0.4, (t) => {
        phase += (2 * Math.PI * (42 + 110 * Math.exp(-t * 28))) / SR
        return Math.sin(phase) * Math.exp(-t * 8) * level
      })
    },
    snare(at, level = 0.5) {
      let prev = 0
      add(at, 0.25, (t) => {
        const n = rand() * 2 - 1
        const hp = n - prev
        prev = n
        const tone = Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t * 30)
        return (hp * 0.6 * Math.exp(-t * 16) + tone * 0.5) * level
      })
    },
    hat(at, level = 0.12, open = false) {
      let prev = 0
      add(at, open ? 0.3 : 0.06, (t) => {
        const n = rand() * 2 - 1
        const hp = n - prev
        prev = n
        return hp * Math.exp(-t * (open ? 12 : 70)) * level
      })
    },
    bass(at, length, note, level = 0.45, glide = false) {
      const f = midi(note)
      let phase = 0
      add(at, length, (t) => {
        const env = Math.min(t / 0.005, 1) * Math.min((length - t) / 0.03, 1)
        phase += (2 * Math.PI * f * (glide ? 1 + 0.5 * Math.exp(-t * 40) : 1)) / SR
        return (Math.sin(phase) + 0.25 * Math.sin(2 * phase)) * env * level
      })
    },
    chord(at, length, notes, level = 0.07) {
      add(at, length, (t) => {
        const env = Math.min(t / 0.02, 1) * Math.exp(-t * 1.5) * Math.min((length - t) / 0.05, 1)
        let s = 0
        for (const n of notes)
          s += Math.sin(2 * Math.PI * midi(n) * t) + 0.3 * Math.sin(4 * Math.PI * midi(n) * t)
        return s * env * level
      })
    },
  }
}

function toWav(samples) {
  let peak = 0
  for (const s of samples) peak = Math.max(peak, Math.abs(s))
  const gain = peak > 0 ? 0.9 / peak : 1
  const data = Buffer.alloc(samples.length * 2)
  for (let i = 0; i < samples.length; i++) {
    data.writeInt16LE(Math.round(Math.tanh(samples[i] * gain) * 32767), i * 2)
  }
  const h = Buffer.alloc(44)
  h.write('RIFF', 0)
  h.writeUInt32LE(36 + data.length, 4)
  h.write('WAVE', 8)
  h.write('fmt ', 12)
  h.writeUInt32LE(16, 16)
  h.writeUInt16LE(1, 20) // PCM
  h.writeUInt16LE(1, 22) // mono
  h.writeUInt32LE(SR, 24)
  h.writeUInt32LE(SR * 2, 28)
  h.writeUInt16LE(2, 32)
  h.writeUInt16LE(16, 34)
  h.write('data', 36)
  h.writeUInt32LE(data.length, 40)
  return Buffer.concat([h, data])
}

/**
 * Each pattern gets the track, the bar start time and the beat length, and draws one bar.
 * Bars cycle through `progression` (bass root note per bar).
 */
const beats = [
  {
    id: 'placeholder-boom-bap',
    title: 'Placeholder: Boom Bap',
    bpm: 90,
    offsetMs: 0,
    totalBars: 16,
    vibe: 'classic',
    progression: [36, 36, 39, 34],
    bar(tr, t, b, root, i) {
      tr.kick(t)
      tr.kick(t + 2.5 * b, 0.7)
      if (i % 2 === 1) tr.kick(t + 3.5 * b, 0.5)
      tr.snare(t + b)
      tr.snare(t + 3 * b)
      for (let k = 0; k < 8; k++) tr.hat(t + (k * b) / 2, k % 2 ? 0.07 : 0.12)
      tr.bass(t, 1.4 * b, root)
      tr.bass(t + 2.5 * b, 1.2 * b, root + 7, 0.35)
      tr.chord(t, 4 * b, [root + 24, root + 27, root + 31])
    },
  },
  {
    id: 'placeholder-lofi-stroll',
    title: 'Placeholder: Lo-fi Stroll',
    bpm: 80,
    // Half a second of silence before bar 1, to exercise offset handling.
    offsetMs: 500,
    totalBars: 16,
    vibe: 'chill',
    progression: [41, 40, 38, 36],
    bar(tr, t, b, root) {
      tr.kick(t, 0.7)
      tr.kick(t + 1.75 * b, 0.45)
      tr.kick(t + 2.5 * b, 0.6)
      tr.snare(t + b, 0.35)
      tr.snare(t + 3 * b, 0.35)
      // Swung eighths: the off-beat lands two-thirds through each beat.
      for (let k = 0; k < 4; k++) {
        tr.hat(t + k * b, 0.08)
        tr.hat(t + (k + 2 / 3) * b, 0.05)
      }
      tr.bass(t, 2 * b, root, 0.35)
      tr.bass(t + 2 * b, 2 * b, root - 5, 0.3)
      tr.chord(t, 4 * b, [root + 24, root + 28, root + 31, root + 35], 0.06)
    },
  },
  {
    id: 'placeholder-trap-sprint',
    title: 'Placeholder: Trap Sprint',
    bpm: 140,
    offsetMs: 0,
    totalBars: 16,
    vibe: 'hype',
    progression: [37, 37, 40, 35],
    bar(tr, t, b, root, i) {
      tr.kick(t)
      tr.kick(t + 1.5 * b, 0.7)
      if (i % 2 === 1) tr.kick(t + 3.25 * b, 0.6)
      tr.snare(t + 2 * b, 0.6)
      for (let k = 0; k < 8; k++) tr.hat(t + (k * b) / 2, 0.1)
      if (i % 4 === 3) for (let k = 0; k < 6; k++) tr.hat(t + 3 * b + (k * b) / 6, 0.07)
      tr.hat(t + 3.5 * b, 0.08, true)
      tr.bass(t, 3 * b, root, 0.55, true)
    },
  },
]

mkdirSync(OUT, { recursive: true })
const catalog = []
beats.forEach((def, n) => {
  const b = 60 / def.bpm
  const barLen = b * 4
  const offset = def.offsetMs / 1000
  // Half a second of tail so the last hits ring out.
  const tr = makeTrack(offset + def.totalBars * barLen + 0.5, 1234 + n)
  for (let i = 0; i < def.totalBars; i++) {
    def.bar(tr, offset + i * barLen, b, def.progression[i % def.progression.length], i)
  }
  const file = `${def.id}.wav`
  writeFileSync(join(OUT, file), toWav(tr.buf))
  catalog.push({
    id: def.id,
    title: def.title,
    creator: 'Rapkrazy (generated placeholder)',
    file: `/beats/${file}`,
    bpm: def.bpm,
    beatsPerBar: 4,
    offsetMs: def.offsetMs,
    totalBars: def.totalBars,
    vibe: def.vibe,
  })
  console.log(`${file}: ${(tr.buf.length / SR).toFixed(1)} s`)
})
writeFileSync(join(OUT, 'beats.json'), JSON.stringify(catalog, null, 2) + '\n')
console.log('wrote beats.json')
