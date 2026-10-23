<script setup lang="ts">
import { ref } from 'vue'
import MadeBy from '@/shared/ui/MadeBy.vue'

// Placeholder. Main menu UI and loading screen live in src/features/main-menu/.

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
  <main class="w-full min-h-screen grid grid-cols-2 relative">
    <section class="p-10 pt-2 items-center">
      <img :src="rapkrazyLogo" />
    </section>

    <div class="absolute bottom-8 left-10"><MadeBy /></div>
    
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
    </section>
  </main>
</template>