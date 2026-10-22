<script setup lang="ts">
import { ref } from 'vue'

// Placeholder. Main menu UI and loading screen live in src/features/main-menu/.
const isDev = import.meta.env.DEV

// images
import rapkrazyLogo from '@/assets/images/Rapkrazy logo.png'
import writeFast from '@/assets/images/write_title_fast.gif'
import writeSlow from '@/assets/images/write_title_slow.gif'
import collabFast from '@/assets/images/collab_title_fast.gif'
import collabSlow from '@/assets/images/collab_title_slow.gif'
import settingsFast from '@/assets/images/settings_title_fast.gif'
import settingsSlow from '@/assets/images/settings_title_slow.gif'

// Reactive state to track which image is currently being hovered
const hoveredMenu = ref({
  write: false,
  collab: false,
  settings: false,
})
</script>

<template>
  <main class="w-full min-h-screen grid grid-cols-2">
    <section class="p-10 pt-2 items-center">
      <img :src="rapkrazyLogo" />
    </section>
    
    <section class="p-10 m-5 mr-0 rounded-3xl rounded-r-none bg-[#18c3e190] flex flex-col relative">
      
      <!-- Added flex flex-col items-center and gap to space out the items -->
      <nav class="w-full flex flex-col items-center">
        <!-- WRITE LINK -->
        <RouterLink 
          to="/write" 
          class="w-full flex justify-center"
          @mouseenter="hoveredMenu.write = true"
          @mouseleave="hoveredMenu.write = false"
        >
          <img 
            :src="hoveredMenu.write ? writeFast : writeSlow" 
            class="object-contain w-2/5 transition-transform duration-200 hover:scale-150" 
            alt="Write"
          />
        </RouterLink>

        <!-- COLLAB LINK -->
        <RouterLink 
          to="/collab" 
          class="w-full flex justify-center"
          @mouseenter="hoveredMenu.collab = true"
          @mouseleave="hoveredMenu.collab = false"
        >
          <img 
            :src="hoveredMenu.collab ? collabFast : collabSlow" 
            class="object-contain w-2/5 transition-transform duration-300 hover:scale-150" 
            alt="Collab"
          />
        </RouterLink>

        <!-- SETTINGS LINK -->
        <RouterLink 
          to="/settings" 
          class="w-full flex justify-center"
          @mouseenter="hoveredMenu.settings = true"
          @mouseleave="hoveredMenu.settings = false"
        >
          <img 
            :src="hoveredMenu.settings ? settingsFast : settingsSlow"
            class="object-contain w-2/5 transition-transform duration-300 hover:scale-150"
            alt="Settings"
          />
        </RouterLink>
      </nav>

      <!-- Dev-only test pages. Not included in production builds. -->
      <nav v-if="isDev" class="absolute bottom-10 right-10 text-right">
        <p class="font-bold">Dev tools</p>
        <RouterLink to="/dev/clock" class="hover:underline">Beat clock</RouterLink>
        ·
        <RouterLink to="/dev/robot" class="hover:underline">Robot voice</RouterLink>
        ·
        <RouterLink to="/dev/template-gen" class="hover:underline">Template gen</RouterLink>
      </nav>
    </section>
  </main>
</template>