import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '@/pages/HomePage.vue'

// Add routes in their own small PR; this file is shared by everyone.
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomePage },
    { path: '/write', name: 'write', component: () => import('@/pages/WritePage.vue') },
    { path: '/collab', name: 'collab', component: () => import('@/pages/CollabPage.vue') },
    {
      path: '/dev/clock',
      name: 'dev-clock',
      component: () => import('@/features/music-player/dev/ClockDemo.vue'),
    },
  ],
})

export default router
