<script setup lang="ts">
// Placeholder. Main menu UI and loading screen live in src/features/main-menu/.
const isDev = import.meta.env.DEV
</script>

<template>
  <main>
    <h1>RAPKRAZY</h1>
    <nav>
      <RouterLink to="/write">Write</RouterLink>
      ·
      <RouterLink to="/collab">Collab</RouterLink>
    </nav>
    <!-- Dev-only test pages. Not included in production builds. -->
    <nav v-if="isDev">
      <p>Dev tools</p>
      <RouterLink to="/dev/clock">Beat clock</RouterLink>
      ·
      <RouterLink to="/dev/robot">Robot voice</RouterLink>
    </nav>
  </main>
</template>
