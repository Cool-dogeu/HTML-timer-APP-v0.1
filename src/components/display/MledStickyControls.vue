<template>
  <div class="mled-sticky-controls">
    <div class="mled-preview">
      <div class="mled-preview-row">
        <div class="mled-preview-left" v-html="mledStore.previewText"></div>
        <div class="mled-preview-right">Active: {{ mledStore.activeModuleLabel }}</div>
      </div>
    </div>

    <div class="mled-sticky-controls-row">
      <button
        @click="toggleConnection"
        class="btn"
        :class="mledStore.isConnected ? 'btn-danger' : 'btn-primary'"
      >
        <i class="material-icons">{{ mledStore.isConnected ? 'usb_off' : 'usb' }}</i>
        {{ mledStore.isConnected ? 'Disconnect' : 'Connect' }}
      </button>

      <div class="mled-sticky-right-controls">
        <div class="brightness-slider-wrap">
          <span style="color: var(--text-primary);">Brightness</span>
          <div class="brightness-slider" :data-pos="mledStore.brightness">
            <div class="brightness-knob"></div>
            <button @click="mledStore.setBrightness(1)" type="button">1</button>
            <button @click="mledStore.setBrightness(2)" type="button">2</button>
            <button @click="mledStore.setBrightness(3)" type="button">3</button>
          </div>
        </div>
        <button @click="mledStore.clear" class="btn btn-warning">
          <i class="material-icons">clear_all</i>
          Clear
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useMledStore } from '@stores/mled'

const mledStore = useMledStore()

/**
 * Toggle MLED connection
 */
async function toggleConnection() {
  if (mledStore.isConnected) {
    await mledStore.disconnect()
  } else {
    try {
      await mledStore.connect()
    } catch (error) {
      console.error('MLED connection failed:', error)
    }
  }
}
</script>

<style scoped>
/* Component-specific styles if needed - most styles are in main.css */
</style>
