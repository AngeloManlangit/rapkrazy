<script setup lang="ts">
import '@fontsource/luckiest-guy'
import '@fontsource/permanent-marker'
import '@fontsource/rubik/400.css'
import '@fontsource/rubik/500.css'
import '@fontsource/rubik/700.css'
import '@/shared/ui/ink.css'
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useBeatClock } from '@/shared/audio'
import InkFilters from '@/shared/ui/InkFilters.vue'
import TopBar from '@/shared/ui/TopBar.vue'
import MadeBy from '@/shared/ui/MadeBy.vue'
import { isCustom, useSongCatalog } from '@/features/song-catalog/useSongCatalog'
import LobbyView from '@/features/multiplayer/LobbyView.vue'
import WaitingRoom from '@/features/multiplayer/WaitingRoom.vue'
import TurnView from '@/features/multiplayer/TurnView.vue'
import RevealView from '@/features/multiplayer/RevealView.vue'
import WordsView from '@/features/multiplayer/duel/WordsView.vue'
import RapView from '@/features/multiplayer/duel/RapView.vue'
import DuelResultsView from '@/features/multiplayer/duel/DuelResultsView.vue'
import { useRoom } from '@/features/multiplayer/useRoom'
import { hasBackend } from '@/features/multiplayer/roomApi'
import collab1 from '@/assets/write/collab-1.webp'
import collab2 from '@/assets/write/collab-2.webp'

// Multiplayer: lobby -> waiting room -> writing turns -> reveal. The phase comes from the room row
// in Supabase, so every player's screen follows the host's referee.

const game = useRoom()
const { clock } = useBeatClock()
const { beats, ready } = useSongCatalog()

/** Custom songs live only in one browser, so they cannot be shared with the room. */
const sharedBeats = computed(() => beats.value.filter((b) => !isCustom(b)))
const chosen = computed(
  () => sharedBeats.value.find((b) => b.id === game.room.value?.beatId) ?? null,
)

/* Everyone loads the host's beat (paused) so the reveal is ready to play. */
watch(
  () => [chosen.value?.id, game.phase.value] as const,
  async ([id, phase]) => {
    if (!chosen.value || id === clock.beat?.id || phase === 'reveal') return
    clock.pause()
    await clock.load(chosen.value)
  },
  { immediate: true },
)

const revealLines = computed(() =>
  game.lines.value.map((l) => ({ text: l.text, author: game.nameOf(l.playerId) })),
)

onMounted(async () => {
  await ready()
  if (hasBackend) await game.resume()
})

/* Mid-game, leaving skips your turns for everyone else, so ask first. */
const LEAVE_WARNING = 'The game is still going. Leave anyway? Your turns will be skipped.'
onBeforeRouteLeave(() => game.phase.value !== 'writing' || confirm(LEAVE_WARNING))
function warnOnUnload(e: BeforeUnloadEvent) {
  if (game.phase.value !== 'writing') return
  e.preventDefault()
  e.returnValue = ''
}
onMounted(() => addEventListener('beforeunload', warnOnUnload))
onBeforeUnmount(() => removeEventListener('beforeunload', warnOnUnload))
</script>

<template>
  <div class="rk">
    <InkFilters />
    <div class="wrap">
      <TopBar title="Collab" :frames="[collab1, collab2]" />

      <main class="stage">
        <section v-if="!hasBackend" class="notice panel ink halftone" role="status">
          <h2 class="toon">Multiplayer needs Supabase</h2>
          <p>
            Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your
            <code>.env</code> file, then restart the dev server.
          </p>
        </section>

        <LobbyView
          v-else-if="game.phase.value === 'home'"
          :busy="game.busy.value"
          :error="game.error.value"
          @host="game.host"
          @join="game.join"
        />

        <template v-else-if="game.room.value">
          <p v-if="game.error.value" class="error ink" role="alert">{{ game.error.value }}</p>

          <WaitingRoom
            v-if="game.phase.value === 'lobby'"
            :room="game.room.value"
            :players="game.players.value"
            :me="game.me.value"
            :is-host="game.isHost.value"
            :beats="sharedBeats"
            :busy="game.busy.value"
            @pick-beat="game.setBeat"
            @settings="game.setSettings"
            @set-mode="game.setMode"
            @start="
              game.room.value.mode === 'duel'
                ? game.startDuel(chosen?.totalBars ?? 0)
                : game.start(chosen?.totalBars ?? 16)
            "
            @leave="game.leave"
          />

          <TurnView
            v-else-if="game.phase.value === 'writing'"
            :players="game.players.value"
            :me="game.me.value"
            :host-id="game.room.value.hostId"
            :writer-id="game.writer.value?.id ?? ''"
            :writer-name="game.writer.value?.name ?? ''"
            :next-id="game.nextWriter.value?.id ?? ''"
            :is-my-turn="game.isMyTurn.value"
            :submitted="game.alreadyWrote.value"
            :previous-text="game.previousLine.value?.text ?? null"
            :previous-author="
              game.previousLine.value ? game.nameOf(game.previousLine.value.playerId) : ''
            "
            :turn-index="game.room.value.turnIndex"
            :total-turns="game.room.value.totalTurns"
            :turn-seconds="game.room.value.turnSeconds"
            :seconds-left="game.secondsLeft.value"
            :busy="game.busy.value"
            @submit="game.submit"
          />

          <WordsView
            v-else-if="game.phase.value === 'words'"
            :opponent-name="game.opponent.value?.name ?? 'your opponent'"
            :line-count="game.room.value.lineCount"
            :seconds-left="game.secondsLeft.value"
            :done="game.myWordsDone.value"
            :busy="game.busy.value"
            @submit="game.submitMyWords"
          />

          <RapView
            v-else-if="game.phase.value === 'rap'"
            :me="game.me.value"
            :opponent-name="game.opponent.value?.name ?? 'your opponent'"
            :targets="game.myTargets.value"
            :seconds-left="game.secondsLeft.value"
            :done="!!game.myResult.value"
            :save="game.submitMyResult"
          />

          <DuelResultsView
            v-else-if="game.phase.value === 'results'"
            :players="game.players.value"
            :results="game.results.value"
            :me="game.me.value"
            :is-host="game.isHost.value"
            :busy="game.busy.value"
            @again="game.playAgain"
            @leave="game.leave"
          />

          <RevealView
            v-else
            :lines="revealLines"
            :votes="game.votes.value"
            :me="game.me.value"
            :is-host="game.isHost.value"
            :busy="game.busy.value"
            @again="game.playAgain"
            @vote="game.vote"
            @leave="game.leave"
          />
        </template>

        <p v-else class="loading toon">Loading...</p>
      </main>
      <footer class="credit"><MadeBy /></footer>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  max-width: 1280px;
  margin: 0 auto;
  padding-block: 14px 40px;
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px));
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.credit {
  display: flex;
  justify-content: center;
  padding-top: 8px;
}
.stage {
  display: grid;
  gap: 22px;
}
.notice {
  --fill: var(--cel-yellow);
  max-width: 640px;
  margin: 0 auto;
  padding: 24px;
  display: grid;
  gap: 10px;
}
.notice h2 {
  margin: 0;
  font-weight: 400;
}
.notice p {
  margin: 0;
  color: var(--text-ink);
  font-weight: 500;
}
.error {
  --fill: var(--cel-yellow);
  margin: 0;
  padding: 10px 16px;
  color: var(--text-ink);
  font-weight: 700;
  border-radius: 12px 16px 10px 14px;
  justify-self: start;
}
.loading {
  text-align: center;
  font-size: 32px;
}
</style>
