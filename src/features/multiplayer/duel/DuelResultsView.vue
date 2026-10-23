<script setup lang="ts">
import { computed, watch } from 'vue'
import { playSfx } from '@/features/soundboard/sfx'
import type { DuelResult, RoomPlayer } from '@/shared/types'

// Rhyme Duel, step 3: both raps side by side, with the winner (or a tie).

const props = defineProps<{
  players: RoomPlayer[]
  results: DuelResult[]
  me: string
  isHost: boolean
  busy: boolean
}>()
const emit = defineEmits<{ again: []; leave: [] }>()

const cards = computed(() =>
  props.players.map((p) => ({
    player: p,
    result: props.results.find((r) => r.playerId === p.id) ?? null,
  })),
)

const verdict = computed(() => {
  const scored = cards.value.filter((c) => c.result)
  if (scored.length < 2) return ''
  const [a, b] = scored as [(typeof scored)[0], (typeof scored)[0]]
  if (a.result!.score === b.result!.score) return "It's a tie!"
  const win = a.result!.score > b.result!.score ? a : b
  return `${win.player.name} wins!`
})

/*
 * The verdict sound, once both raps are in: the air horn for the winner (or for both players in a
 * tie), and the "yeah" for the loser.
 */
const outcome = computed<'win' | 'tie' | 'lose' | null>(() => {
  const mine = props.results.find((r) => r.playerId === props.me)
  const theirs = props.results.find((r) => r.playerId !== props.me)
  if (!mine || !theirs) return null
  if (mine.score === theirs.score) return 'tie'
  return mine.score > theirs.score ? 'win' : 'lose'
})
watch(
  outcome,
  (result, before) => {
    if (!result || before) return
    playSfx(result === 'lose' ? 'yeah' : 'horn')
  },
  { immediate: true },
)

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
</script>

<template>
  <div class="results">
    <h2 class="verdict toon grad">{{ verdict }}</h2>

    <div class="cards">
      <section
        v-for="(c, i) in cards"
        :key="c.player.id"
        class="card panel ink halftone"
        :class="i === 0 ? 'a' : 'b'"
        :aria-label="`${c.player.name}'s rap`"
      >
        <header class="head">
          <span class="name toon"
            >{{ c.player.name }}<small v-if="c.player.id === me"> (you)</small></span
          >
          <span class="score"
            >{{ c.result ? fmt(c.result.score) : '-' }} / {{ c.result?.lines.length ?? '-' }}</span
          >
        </header>

        <ol v-if="c.result" class="lines">
          <li v-for="(l, j) in c.result.lines" :key="j">
            <div class="words">
              <span class="target">{{ l.target }}</span>
              <span class="arrow">&rarr;</span>
              <span class="heard">{{ l.heard || '(missed)' }}</span>
            </div>
            <div class="badges">
              <span class="badge" :class="l.rhymes ? 'yes' : 'no'">{{
                l.rhymes ? 'Rhymed' : 'No rhyme'
              }}</span>
              <span class="badge" :class="l.onBeat ? 'yes' : 'no'">{{
                l.onBeat ? 'On beat' : 'Off beat'
              }}</span>
              <span class="pts">+{{ fmt(l.points) }}</span>
            </div>
          </li>
        </ol>
        <p v-else class="wait">No rap saved.</p>
      </section>
    </div>

    <div class="actions">
      <button
        v-if="isHost"
        class="again ink glint"
        type="button"
        :disabled="busy"
        @click="emit('again')"
      >
        Play again
      </button>
      <p v-else class="hint">The host can start another round.</p>
      <button class="leave" type="button" @click="emit('leave')">Leave lobby</button>
    </div>
    <p class="rules">
      1 point for a rhyme on the last beat, half a point for a rhyme that missed the beat.
    </p>
  </div>
</template>

<style scoped>
.results {
  display: grid;
  gap: 22px;
  max-width: 980px;
  margin: 0 auto;
  width: 100%;
}
.verdict {
  margin: 0;
  text-align: center;
  font-size: clamp(36px, 7vw, 64px);
  font-weight: 400;
}
.cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 26px;
}
.card {
  display: grid;
  align-content: start;
  gap: 14px;
  padding: 22px;
  color: var(--text-ink);
}
.card.a {
  --fill: var(--cel-yellow);
  transform: rotate(-0.8deg);
}
.card.b {
  --fill: var(--cel-cyan);
  transform: rotate(0.8deg);
}
.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}
.name {
  font-size: 28px;
}
.name small {
  font-family: var(--ui);
  font-size: 14px;
  -webkit-text-stroke: 0;
  text-shadow: none;
}
.score {
  font-family: var(--display);
  font-size: 26px;
}
.lines {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.lines li {
  display: grid;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.55);
}
.words {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
  font: 400 22px/1.3 var(--marker);
}
.target {
  opacity: 0.7;
}
.arrow {
  font-family: var(--ui);
}
.badges {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.badge {
  font-family: var(--display);
  font-size: 12px;
  letter-spacing: 0.08em;
  padding: 3px 9px 1px;
  border-radius: 6px 9px 5px 10px;
  background: var(--ink);
}
.badge.yes {
  color: var(--mint);
}
.badge.no {
  color: var(--pink);
}
.pts {
  margin-left: auto;
  font-family: var(--display);
  font-size: 18px;
}
.wait,
.hint,
.rules {
  margin: 0;
  font-weight: 700;
}
.rules {
  text-align: center;
  opacity: 0.8;
}
.actions {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 18px;
}
.again {
  --fill: var(--cel-pink);
  font-family: var(--display);
  font-size: 20px;
  letter-spacing: 0.06em;
  color: var(--paper);
  text-shadow: 2px 2px 0 var(--ink);
  padding: 12px 28px 9px;
  border-radius: 16px 22px 14px 20px;
  transition: transform 0.2s var(--spring);
}
.again:hover:not(:disabled) {
  transform: rotate(-2deg) scale(1.06);
}
.leave {
  background: none;
  border: 0;
  padding: 4px;
  color: var(--text);
  font-weight: 700;
  text-decoration: underline;
}
@media (max-width: 800px) {
  .cards {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
