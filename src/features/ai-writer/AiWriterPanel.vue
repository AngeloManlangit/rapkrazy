<script setup lang="ts">
import { ref } from 'vue'
import LoadingBars from './LoadingBars.vue'
import { useAiWriter } from './useAiWriter'
import { useContentMode } from '@/shared/contentMode'

const props = defineProps<{
    bars?: number // current beat's bar count
    bpm?: number
    syllablesPerBar?: number
}>()

const emit = defineEmits<{
    (e: 'add-to-board', payload: { title: string; lines: string[] }): void
}>()

const { mode } = useContentMode()
const dialog = ref<HTMLDialogElement | null>(null)
const { inputs, status, result, error, canSubmit, generate, backToForm, reset } = useAiWriter(() => ({
    bars: props.bars,
    bpm: props.bpm,
    syllablesPerBar: props.syllablesPerBar,
    mode: mode.value,
}))

const open = () => dialog.value?.showModal()
defineExpose({ open })
const close = () => dialog.value?.close()

function onBackdropClick(e: MouseEvent) {
    if (e.target === dialog.value) close()
}

function addToBoard() {
    if (!result.value) return
    emit('add-to-board', { title: result.value.title, lines: [...result.value.lines] })
    close()
}
</script>

<template>
    <dialog ref="dialog" class="slab" @close="reset" @click="onBackdropClick">
        <div class="inner">
        <header class="head">
            <h2>Ghostwriter</h2>
            <button class="x" type="button" aria-label="Close" @click="close">&times;</button>
            <span class="drip d1" /><span class="drip d2" /><span class="drip d3" />
        </header>

        <!-- 1. Prompt -->
        <form v-if="status === 'form' || status === 'error'" class="form" @submit.prevent="generate">
            <p v-if="status === 'error'" class="error" role="alert">{{ error }}</p>

            <label>
            <span>Give me a subject</span>
            <input v-model="inputs.subject" maxlength="40" placeholder="a noun: crown, night bus" autocomplete="off" />
            </label>
            <label>
            <span>An action</span>
            <input v-model="inputs.action" maxlength="40" placeholder="a verb: climb, outrun" autocomplete="off" />
            </label>
            <label>
            <span>Give an adjective</span>
            <input v-model="inputs.adjective" maxlength="40" placeholder="golden, restless" autocomplete="off" />
            </label>
            <label>
            <span>What do you want to rap about?</span>
            <textarea v-model="inputs.topic" maxlength="140" rows="2" placeholder="leaving home, a rival, first paycheck" />
            </label>

            <button class="primary" type="submit" :disabled="!canSubmit">Write my bars</button>
        </form>

        <!-- 2. Loading -->
        <LoadingBars v-else-if="status === 'loading'" />

        <!-- 3. Result -->
        <section v-else-if="status === 'result' && result" class="result">
            <h3>{{ result.title }}</h3>
            <p v-if="result.fallback" class="note">The AI is resting, so these bars come from the backup book.</p>
            <ol class="lines">
            <li v-for="(line, i) in result.lines" :key="i" :style="{ '--i': i }">{{ line }}</li>
            </ol>
            <div class="actions">
            <button class="primary" type="button" @click="addToBoard">Add to writing board</button>
            <button class="ghost" type="button" @click="generate">Write another</button>
            <button class="ghost" type="button" @click="backToForm">Change prompt</button>
            </div>
        </section>
        </div>
    </dialog>
</template>

<style scoped>
button:focus-visible, input:focus-visible, textarea:focus-visible {
    outline: 3px solid #19d3f3;
    outline-offset: 3px;
}

/* A black slab with a spray-painted neon edge. */
.slab {
    width: min(33rem, calc(100vw - 2rem));
    max-height: calc(100vh - 2rem);
    padding: 0;
    overflow: visible;
    border: 0;
    background: transparent;
    color: #f5f5f0;
    font-family: 'Rubik', system-ui, sans-serif;
}
.slab::backdrop { background: rgba(10, 8, 12, 0.7); }

.inner {
    position: relative;
    min-height: 22rem;
    max-height: calc(100vh - 2rem);
    overflow: auto;
    padding: 1.3rem 1.6rem 1.7rem;
    background: #141216;
    border: 3px solid #ff2e88;
    border-radius: 6px;
    box-shadow: 0 0 0 3px #111, 0 0 26px rgba(255, 46, 136, 0.55), 7px 8px 0 #19d3f3;
}

.head { position: relative; display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.head h2 {
    margin: 0;
    font: 400 2rem/1.1 'Permanent Marker', cursive;
    color: #ffe600;
    text-shadow: 2px 2px 0 #ff2e88, 4px 4px 0 #111;
}
.x { background: none; border: 0; font-size: 2rem; line-height: 1; color: #f5f5f0; cursor: pointer; }

/* Paint drips run once when the slab opens. */
.drip {
    position: absolute;
    top: 100%;
    width: 6px;
    height: 0;
    border-radius: 0 0 6px 6px;
    background: #ffe600;
    animation: drip 1.4s ease-out 0.25s forwards;
}
.d1 { left: 10%; --h: 22px; }
.d2 { left: 34%; --h: 36px; animation-delay: 0.45s; }
.d3 { left: 61%; --h: 16px; animation-delay: 0.35s; }
@keyframes drip { to { height: var(--h); } }

.form { display: grid; gap: 0.5rem; }
label { display: grid; gap: 0.1rem; }
label span { font: 400 1rem 'Permanent Marker', cursive; color: #19d3f3; }
input, textarea {
    font: 500 1.05rem/1.7rem 'Rubik', sans-serif;
    color: #f5f5f0;
    background: rgba(255, 255, 255, 0.06);
    border: 0;
    border-bottom: 3px solid #ff2e88;
    border-radius: 3px 3px 0 0;
    padding: 0.35rem 0.6rem;
    resize: none;
}
input::placeholder, textarea::placeholder { color: rgba(245, 245, 240, 0.4); }

.primary {
    margin-top: 0.9rem;
    justify-self: start;
    font: 400 1.1rem 'Permanent Marker', cursive;
    padding: 0.6rem 1.3rem;
    color: #111;
    background: #ff2e88;
    border: 3px solid #111;
    border-radius: 4px;
    box-shadow: 3px 3px 0 #ffe600;
    cursor: pointer;
}
.primary:disabled { opacity: 0.35; cursor: not-allowed; box-shadow: none; }
.ghost {
    margin-top: 0.9rem;
    font: 500 0.95rem 'Rubik', sans-serif;
    padding: 0.55rem 1rem;
    color: #f5f5f0;
    background: transparent;
    border: 2px solid rgba(245, 245, 240, 0.6);
    border-radius: 4px;
    cursor: pointer;
}
.ghost:hover { border-color: #19d3f3; color: #19d3f3; }
.error {
    margin: 0;
    padding: 0.4rem 0.7rem;
    background: #ffe600;
    color: #111;
    font-weight: 700;
    border-radius: 4px;
}

.note { margin: 0 0 0.6rem; font-size: 0.9rem; color: #ffe600; }
.result h3 {
    margin: 0 0 0.6rem;
    font: 400 1.6rem/1.2 'Permanent Marker', cursive;
    color: #19d3f3;
}
.lines { margin: 0; padding: 0; list-style: none; }
.lines li {
    font: 400 1.15rem/1.9rem 'Permanent Marker', cursive;
    color: #f5f5f0;
    text-shadow: 1px 1px 0 #ff2e88;
    animation: tag 0.3s ease-out both;
    animation-delay: calc(var(--i) * 80ms);
}
.actions { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-top: 0.4rem; }
.actions .primary { margin-top: 0.9rem; }

@keyframes tag {
    from { opacity: 0; transform: translateX(-8px) rotate(-1deg); }
    to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
    .lines li { animation: none; }
    .drip { animation: none; height: var(--h); }
}
</style>


