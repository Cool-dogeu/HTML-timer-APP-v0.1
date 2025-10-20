/**
 * Vue Router Configuration
 * Defines application routes and navigation
 */

import { createRouter, createWebHistory } from 'vue-router'
import TimerView from '@/views/TimerView.vue'
import ResultsView from '@/views/ResultsView.vue'
import DisplayView from '@/views/DisplayView.vue'
import HdmiView from '@/views/HdmiView.vue'

const routes = [
  {
    path: '/',
    name: 'timer',
    component: TimerView,
    meta: {
      title: 'Timer',
      icon: 'timer'
    }
  },
  {
    path: '/results',
    name: 'results',
    component: ResultsView,
    meta: {
      title: 'Results',
      icon: 'list'
    }
  },
  {
    path: '/display',
    name: 'display',
    component: DisplayView,
    meta: {
      title: 'Display',
      icon: 'display_settings'
    }
  },
  {
    path: '/hdmi',
    name: 'hdmi',
    component: HdmiView,
    meta: {
      title: 'HDMI',
      icon: 'tv'
    }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// Navigation guard to update document title
router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} - Agility Timer` : 'Agility Timer'
})

export default router
