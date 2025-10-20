<template>
  <div class="mled-module" :class="{ disabled: !mledStore.data.enabled }">
    <div class="module-toggle">
      <label>
        <input
          type="checkbox"
          v-model="mledStore.data.enabled"
          :disabled="!mledStore.isConnected"
        />
        Enable
      </label>
    </div>
    <div class="module-header">DATA INTEGRATOR</div>

    <div style="padding: 1rem;">
      <div class="module-section-container">
        <label class="module-label" style="display: block; margin-bottom: 0.5rem;">JSON URL:</label>
        <input
          v-model="mledStore.data.url"
          type="text"
          placeholder="https://www.smarteragilitysecretary.com/api/ring-jumbotron?key=...&token=..."
          class="mled-select"
          style="width: 100%; font-size: 0.85rem;"
          :disabled="!mledStore.data.enabled"
        />
        <small style="color: #888; font-size: 0.75rem; display: block; margin-top: 0.25rem;">
          Paste full smarteragilitysecretary.com URL - will be auto-proxied to avoid CORS
        </small>
        <div style="display: flex; margin-top: 0.5rem;">
          <button
            @click="mledStore.toggleDataAutoUpdate"
            class="btn"
            :class="mledStore.data.autoUpdate ? 'btn-danger' : 'btn-primary'"
            style="width: 100%;"
            :disabled="!mledStore.data.enabled || !mledStore.data.url"
          >
            {{ mledStore.data.autoUpdate ? 'Stop Auto-Update' : 'Start Auto-Update' }}
          </button>
        </div>

        <div class="module-section-label" style="font-size: 0.85rem; margin-top: 1rem;">
          {{ mledStore.data.status }}
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
