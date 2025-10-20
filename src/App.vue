<template>
  <div id="app" v-cloak :class="{ 'dark-mode': isDarkMode }">
    <AppHeader />
    <div class="app-content-wrapper">
      <TabNav />
      <router-view />
    </div>
    <DebugConsole v-if="showDebugConsole" />
    <DebugToggle @toggle="showDebugConsole = !showDebugConsole" :active="showDebugConsole" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AppHeader from '@components/common/AppHeader.vue'
import TabNav from '@components/common/TabNav.vue'
import DebugConsole from '@components/debug/DebugConsole.vue'
import DebugToggle from '@components/debug/DebugToggle.vue'

// Theme management
const isDarkMode = ref(false)
const showDebugConsole = ref(false)

// Load theme from localStorage
onMounted(() => {
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'dark') {
    isDarkMode.value = true
  }
})

// Watch for theme changes
function toggleTheme() {
  isDarkMode.value = !isDarkMode.value
  localStorage.setItem('theme', isDarkMode.value ? 'dark' : 'light')
}

// Expose to window for child components
window.__toggleTheme = toggleTheme
</script>

<style>
/* Global app styles are imported in main.js */
</style>
