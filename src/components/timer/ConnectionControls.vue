<template>
  <div>
    <div class="connection-type-selector">
      <label class="connection-type-label">Connection Type:</label>
      <div class="connection-type-options">
        <label class="radio-label">
          <input
            type="radio"
            value="serial"
            v-model="serialStore.connectionType"
            :disabled="serialStore.isConnected"
          />
          Web Serial API
        </label>
        <label class="radio-label">
          <input
            type="radio"
            value="usb"
            v-model="serialStore.connectionType"
            :disabled="serialStore.isConnected"
          />
          WebUSB API
        </label>
      </div>
    </div>

    <div class="control-buttons">
      <button
        @click="toggleConnection"
        class="btn"
        :class="{ 'btn-danger': serialStore.isConnected, 'btn-primary': !serialStore.isConnected }"
      >
        <i class="material-icons">
          {{ serialStore.isConnected ? 'usb_off' : 'usb' }}
        </i>
        {{ serialStore.isConnected ? 'Disconnect' : 'Connect' }}
      </button>
      <button @click="openSettings" class="btn btn-secondary">
        <i class="material-icons">settings</i>
        Settings
      </button>
      <button @click="openInfo" class="btn btn-secondary">
        <i class="material-icons">info</i>
        Info
      </button>
    </div>
  </div>
</template>

<script setup>
import { useSerialStore } from '@stores/serial'
import { useSettingsStore } from '@stores/settings'

const serialStore = useSerialStore()
const settingsStore = useSettingsStore()

/**
 * Toggle connection to timing device
 */
async function toggleConnection() {
  if (serialStore.isConnected) {
    await serialStore.disconnect()
  } else {
    try {
      await serialStore.connect()
    } catch (error) {
      console.error('Connection failed:', error)
      // Could show an error notification here
    }
  }
}

/**
 * Open settings modal
 */
function openSettings() {
  settingsStore.showSettings = true
}

/**
 * Open info modal
 */
function openInfo() {
  settingsStore.showInfo = true
}
</script>

<style scoped>
/* Component-specific styles if needed - most styles are in main.css */
</style>
