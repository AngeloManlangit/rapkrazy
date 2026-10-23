<script setup lang="ts">
import '@fontsource/luckiest-guy'
import '@fontsource/rubik/700.css'

// "Made by Devtones" credit shown at the bottom of every page. Colors are written out here
// (not taken from ink.css) so it also looks right on the home page, which is not an .rk page.
</script>

<template>
  <p class="made-by">
    <span class="small">Made by</span>
    <span class="name">Devtones</span>
  </p>
</template>

<style scoped>
.made-by {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  padding: 6px 14px 4px;
  background: #0b0614;
  border-radius: 6px 12px 5px 14px;
  box-shadow:
    0 0 0 2.5px #fff200,
    4px 5px 0 2.5px #ff3da5;
  transform: rotate(-1.5deg);
  user-select: none;
}
.small {
  font-family: 'Rubik', system-ui, sans-serif;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #fff7e3;
}
.name {
  font-family: 'Luckiest Guy', 'Arial Black', Impact, sans-serif;
  font-size: 20px;
  letter-spacing: 0.08em;
  color: #fff200;
  text-shadow: 2px 2px 0 #ff3da5;
}
</style>
