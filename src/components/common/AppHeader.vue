<template>
  <header class="app-header">
    <div class="logo-container">
      <img src="/assets/images/logo.png" alt="CoolDog" class="logo" />
      <h1>Agility Timer Online v2.1</h1>
    </div>

    <div class="connection-status">
      <button @click="confirmRefresh" class="btn btn-secondary btn-small">
        <i class="material-icons">refresh</i>
        Refresh
      </button>

      <span v-if="!settingsStore.isOnline" class="offline-indicator">
        <i class="material-icons">cloud_off</i>
        OFFLINE
      </span>

      <button
        @click="toggleTheme"
        class="btn btn-secondary btn-small theme-toggle"
        :title="settingsStore.isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
      >
        <i class="material-icons">{{ settingsStore.isDarkMode ? 'light_mode' : 'dark_mode' }}</i>
      </button>

      <img
        src="/assets/images/logo.png"
        alt="CoolDog"
        class="header-logo"
        @click="openWebsite"
      />
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useSerialStore } from '@stores/serial'
import { useMledStore } from '@stores/mled'
import { useSettingsStore } from '@stores/settings'

const serialStore = useSerialStore()
const mledStore = useMledStore()
const settingsStore = useSettingsStore()

// Computed properties for status LED classes
const timerStatusClass = computed(() => serialStore.statusLedClass)
const mledStatusClass = computed(() => mledStore.statusLedClass)

/**
 * Toggle dark/light theme
 */
function toggleTheme() {
  settingsStore.toggleTheme()
}

/**
 * Confirm page refresh
 */
function confirmRefresh() {
  settingsStore.confirmRefresh()
}

/**
 * Open CoolDog website
 */
function openWebsite() {
  window.open('https://cool-dog.eu', '_blank')
}
</script>

<style scoped>
/* Component-specific styles if needed - most styles are in main.css */
</style>
