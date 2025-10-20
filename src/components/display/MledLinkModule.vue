<template>
  <div class="mled-module" :class="{ disabled: !mledStore.link.enabled }">
    <div class="module-toggle">
      <label>
        <input
          type="checkbox"
          v-model="mledStore.link.enabled"
          :disabled="!mledStore.isConnected"
        />
        Enable
      </label>
    </div>
    <div class="module-header">Timer LINK</div>

    <div style="padding: 1rem;">
      <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem;">
        <label class="module-label">Color</label>
        <select v-model="mledStore.link.color" class="mled-select" :disabled="!mledStore.link.enabled">
          <option value="Red">Red</option>
          <option value="Green">Green</option>
          <option value="Blue">Blue</option>
          <option value="Yellow">Yellow</option>
          <option value="Magenta">Magenta</option>
          <option value="Cyan">Cyan</option>
          <option value="White">White</option>
          <option value="Orange">Orange</option>
          <option value="Deep pink">Deep pink</option>
          <option value="Light Blue">Light Blue</option>
        </select>
        <label class="module-label" style="margin-left: 1rem;">Hold</label>
        <select v-model.number="mledStore.link.hold" class="mled-select" :disabled="!mledStore.link.enabled">
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
          {{ mledStore.link.status }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useMledStore } from '@stores/mled'

const mledStore = useMledStore()
</script>

<style scoped>
/* Component-specific styles if needed - most styles are in main.css */
</style>
