<script setup lang="ts">
import { computed, ref } from 'vue'

// Home of /collab: pick a nickname, then host a new lobby or join one with its 6-letter code.
defineProps<{ busy: boolean; error: string }>()
const emit = defineEmits<{ host: [name: string]; join: [code: string, name: string] }>()

const name = ref('')
const code = ref('')
const cleanName = computed(() => name.value.trim())
const cleanCode = computed(() => code.value.trim().toUpperCase())
</script>

<template>
  <section class="lobby" aria-label="Collab lobby">
    <label class="field name-field">
      <span class="tag">Your nickname</span>
      <input
        v-model="name"
        class="input"
        maxlength="20"
        placeholder="MC Something"
        autocomplete="off"
      />
    </label>

    <p v-if="error" class="error ink" role="alert">{{ error }}</p>

    <div class="cards">
      <form class="card panel ink halftone host" @submit.prevent="emit('host', cleanName)">
        <h2 class="toon">Host a lobby</h2>
        <p>Start a room, share the code, and up to 4 friends can join you.</p>
        <button class="go ink glint" type="submit" :disabled="busy || !cleanName">
          Create lobby
        </button>
      </form>

      <form
        class="card panel ink halftone join"
        @submit.prevent="emit('join', cleanCode, cleanName)"
      >
        <h2 class="toon">Join a lobby</h2>
        <label class="field">
          <span class="tag">Lobby code</span>
          <input
            v-model="code"
            class="input code"
            maxlength="6"
            placeholder="ABCDEF"
            autocomplete="off"
            autocapitalize="characters"
          />
        </label>
        <button
          class="go ink glint"
          type="submit"
          :disabled="busy || !cleanName || cleanCode.length !== 6"
        >
          Join
        </button>
      </form>
    </div>
  </section>
</template>

<style scoped>
.lobby {
  display: grid;
  gap: 26px;
  max-width: 880px;
  margin: 0 auto;
  width: 100%;
}
.field {
  display: grid;
  gap: 8px;
  justify-items: start;
}
.name-field {
  max-width: 360px;
}
.input {
  width: 100%;
  box-sizing: border-box;
  font: 500 18px/1.2 var(--ui);
  color: var(--text-ink);
  background: #fff;
  border: 3px solid var(--ink);
  border-radius: 12px 16px 10px 14px;
  padding: 10px 14px;
  box-shadow: 3px 4px 0 var(--ink);
}
.input.code {
  font-family: var(--display);
  font-size: 26px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
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
  padding: 24px;
}
.host {
  --fill: var(--cel-yellow);
  --tilt: -1deg;
}
.join {
  --fill: var(--cel-cyan);
  --tilt: 1deg;
  animation-delay: 0.08s;
}
/* Cards drop in, lift and lean toward you on hover, and stay lifted while you type in them */
.card {
  transform: rotate(var(--tilt));
  transition: transform 0.3s var(--spring);
  animation: card-in 0.5s var(--spring) backwards;
}
@keyframes card-in {
  from {
    translate: 0 24px;
    scale: 0.94;
    opacity: 0;
  }
}
.card:hover,
.card:focus-within {
  transform: rotate(calc(var(--tilt) * -3)) translateY(-16px) scale(1.05);
}
/* jelly wobble as the card jumps up */
.card:hover {
  animation: jelly 0.6s var(--spring);
}
@keyframes jelly {
  30% {
    scale: 1.06 0.93;
  }
  55% {
    scale: 0.97 1.05;
  }
  80% {
    scale: 1.01 0.99;
  }
}
.card:hover::before,
.card:focus-within::before {
  box-shadow:
    var(--shade),
    0 0 0 3px var(--ink),
    18px 22px 0 3px var(--ink);
}
/* The title grows from its left edge and stays level, so it never pokes past the card */
.card h2 {
  transform-origin: left center;
  transition: transform 0.35s var(--spring);
}
.card:hover h2 {
  transform: scale(1.06);
  animation: title-bounce 0.4s var(--spring) 0.1s;
}
@keyframes title-bounce {
  40% {
    translate: 0 -4px;
  }
}
.card h2 {
  margin: 0;
  font-size: 32px;
  font-weight: 400;
}
.card p {
  margin: 0;
  font-weight: 500;
}
.go {
  --fill: var(--cel-pink);
  justify-self: start;
  font-family: var(--display);
  font-size: 20px;
  letter-spacing: 0.06em;
  color: var(--paper);
  text-shadow: 2px 2px 0 var(--ink);
  padding: 12px 26px 9px;
  border-radius: 16px 22px 14px 20px;
  transition: transform 0.2s var(--spring);
}
.go:hover:not(:disabled) {
  transform: rotate(-5deg) scale(1.15);
}
.go:hover:not(:disabled)::before {
  box-shadow: var(--line-lift);
}
.go:active:not(:disabled) {
  transform: translate(3px, 4px) scale(1.05, 0.9);
  transition-duration: 0.06s;
}
.go:active:not(:disabled)::before {
  box-shadow: var(--line-press);
}
/* once the card is filled in, the button pops and keeps pulsing until you click it */
.go:not(:disabled) {
  animation:
    ready 0.5s var(--spring),
    pulse 1.3s ease-in-out 0.5s infinite;
}
.go:not(:disabled):hover {
  animation: none;
}
@keyframes ready {
  40% {
    transform: rotate(-6deg) scale(1.2);
  }
}
@keyframes pulse {
  50% {
    scale: 1.08;
  }
}
.input {
  transition:
    transform 0.2s var(--spring),
    box-shadow 0.15s;
}
.input:focus {
  outline: none;
  transform: translateY(-2px) rotate(-0.5deg);
  box-shadow: 5px 7px 0 var(--ink);
}
.go:disabled {
  opacity: 0.45;
  cursor: not-allowed;
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
@media (max-width: 700px) {
  .cards {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
