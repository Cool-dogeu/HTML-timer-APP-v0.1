<template>
  <div class="mled-module" :class="{ disabled: !hdmiStore.linkEnabled }">
    <div class="module-toggle">
      <label>
        <input type="checkbox" v-model="hdmiStore.linkEnabled" />
        Enable
      </label>
    </div>
    <div class="module-header">Timer LINK</div>

    <div style="padding: 1rem;">
      <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem;">
        <label class="module-label">Hold</label>
        <select v-model.number="hdmiStore.linkHold" class="mled-select" :disabled="!hdmiStore.linkEnabled">
          <option :value="1">1 s</option>
          <option :value="3">3 s</option>
          <option :value="5">5 s</option>
          <option :value="10">10 s</option>
          <option :value="15">15 s</option>
          <option :value="20">20 s</option>
          <option :value="30">30 s</option>
          <option :value="60">60 s</option>
        </select>
      </div>

      <div class="module-section-container">
        <label class="module-section-label">Status:</label>
        <div class="module-section-text">
          {{ hdmiStore.linkStatus }}
        </div>
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
