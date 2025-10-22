<template>
  <div class="mled-sticky-controls">
    <div class="mled-preview">
      <div class="mled-preview-row">
        <div class="mled-preview-left">{{ algeStore.previewText || 'Ready' }}</div>
        <div class="mled-preview-right">Active: {{ algeStore.activeLabel }}</div>
      </div>
    </div>

    <div class="mled-sticky-controls-row">
      <button
        @click="toggleConnection"
        class="btn"
        :class="algeStore.isConnected ? 'btn-danger' : 'btn-primary'"
      >
        <i class="material-icons">{{ algeStore.isConnected ? 'usb_off' : 'usb' }}</i>
        {{ algeStore.isConnected ? 'Disconnect' : 'Connect' }}
      </button>

      <div class="mled-sticky-right-controls">
        <button @click="clearDisplay" class="btn btn-secondary" :disabled="!algeStore.isConnected">
          <i class="material-icons">clear_all</i>
          Clear
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useAlgeStore } from '@stores/alge'

const algeStore = useAlgeStore()

/**
 * Toggle Alge connection
 */
async function toggleConnection() {
  if (algeStore.isConnected) {
    await algeStore.disconnect()
  } else {
    try {
      await algeStore.connect()
    } catch (error) {
      console.error('Alge connection failed:', error)
      alert(`Connection failed: ${error.message}`)
    }
  }
}

/**
 * Clear Alge display
 */
async function clearDisplay() {
  try {
    await algeStore.clear()
  } catch (error) {
    console.error('Clear failed:', error)
    alert(`Clear failed: ${error.message}`)
  }
}
</script>

<style scoped>
/* Component-specific styles if needed - most styles are in main.css */
</style>
