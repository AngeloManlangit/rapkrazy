<script setup lang="ts">
const rows = [0.92, 0.7, 0.84, 0.58, 0.76]
</script>

<template>
    <div class="loading" role="status" aria-live="polite">
        <div class="rows" aria-hidden="true">
        <div v-for="(w, i) in rows" :key="i" class="row">
            <span class="stroke" :style="{ '--w': w, '--d': `${i * 0.35}s` }" />
        </div>
        </div>
        <p class="caption">Writing your bars…</p>
    </div>
</template>

<style scoped>
.loading { padding: 0.5rem 0 0; }
.row { height: 2.1rem; display: flex; align-items: center; }
.stroke {
    display: block;
    height: 0.6rem;
    width: calc(var(--w) * 100%);
    border-radius: 999px;
    background: #1b1f3b;
    opacity: 0.85;
    transform-origin: left center;
    transform: scaleX(0);
    animation: scribble 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    animation-delay: var(--d);
}
.caption {
    margin: 1rem 0 0;
    font-family: 'Kalam', 'Comic Sans MS', cursive;
    font-size: 1.15rem;
    color: #1b1f3b;
}
@keyframes scribble {
    0% { transform: scaleX(0); opacity: 0.85; }
    55% { transform: scaleX(1); opacity: 0.85; }
    85% { transform: scaleX(1); opacity: 0.85; }
    100% { transform: scaleX(1); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
    .stroke { animation: none; transform: scaleX(1); opacity: 0.35; }
}
</style>