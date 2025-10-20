<template>
  <div class="mled-sticky-controls">
    <div class="mled-preview">
      <div class="mled-preview-row">
        <div class="mled-preview-left" v-html="hdmiStore.previewText"></div>
        <div class="mled-preview-right">Active: {{ hdmiStore.activeModuleLabel }}</div>
      </div>
    </div>

    <div class="mled-sticky-controls-row">
      <div class="hdmi-style-controls">
        <div class="hdmi-control-group">
          <label class="module-label">Background:</label>
          <input type="color" v-model="hdmiStore.backgroundColor" class="color-picker" />
        </div>
        <div class="hdmi-control-group">
          <label class="module-label">Font Color:</label>
          <input type="color" v-model="hdmiStore.foregroundColor" class="color-picker" />
        </div>
        <div class="hdmi-control-group">
          <label class="module-label">Font Size:</label>
          <select v-model="hdmiStore.fontSize" class="mled-select">
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
            <option value="xlarge">X-Large</option>
          </select>
        </div>
      </div>

      <div class="mled-sticky-right-controls">
        <button @click="hdmiStore.openWindow" class="btn btn-primary">
          <i class="material-icons">open_in_new</i>
          Open Output
        </button>
        <button
          @click="hdmiStore.toggleFullscreen"
          class="btn btn-secondary"
          v-if="hdmiStore.isWindowOpen"
        >
          <i class="material-icons">fullscreen</i>
          Fullscreen
        </button>
        <button @click="hdmiStore.clear" class="btn btn-secondary">
          <i class="material-icons">clear_all</i>
          Clear
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useHdmiStore } from '@stores/hdmi'

const hdmiStore = useHdmiStore()
</script>

<style scoped>
/* Component-specific styles if needed - most styles are in main.css */
</style>
