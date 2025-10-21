<template>
  <div class="mled-module" :class="{ disabled: !mledStore.dataEnabled }">
    <div class="module-toggle">
      <label>
        <input
          type="checkbox"
          v-model="mledStore.dataEnabled"
          :disabled="!mledStore.isConnected"
        />
        Enable
      </label>
    </div>
    <div class="module-header">ONLINE DATA INTEGRATOR</div>

    <div style="padding: 1rem;">
      <!-- JSON URL Section -->
      <div class="module-section-container">
        <label class="module-label" style="display: block; margin-bottom: 0.5rem;">JSON URL:</label>
        <input
          v-model="mledStore.dataUrl"
          type="text"
          placeholder="https://www.smarteragilitysecretary.com/api/ring-jumbotron?key=...&token=..."
          class="mled-select"
          style="width: 100%; font-size: 0.85rem;"
          :disabled="!mledStore.dataEnabled"
        />
        <small style="color: #888; font-size: 0.75rem; display: block; margin-top: 0.25rem;">
          Paste full smarteragilitysecretary.com URL - will be auto-proxied to avoid CORS
        </small>
        <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
          <button
            @click="mledStore.toggleDataAutoUpdate"
            class="btn"
            :class="mledStore.dataAutoUpdate ? 'btn-danger' : 'btn-primary'"
            style="flex: 1;"
            :disabled="!mledStore.dataEnabled || !mledStore.dataUrl"
          >
            {{ mledStore.dataAutoUpdate ? 'Stop Auto-Update' : 'Start Auto-Update' }}
          </button>
        </div>

        <div class="module-section-label" style="font-size: 0.85rem; margin-top: 0.75rem;">
          {{ mledStore.dataStatus }}
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
