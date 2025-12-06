<template>
  <div class="mled-module" :class="{ disabled: !algeStore.cwEnabled }">
    <div class="module-toggle">
      <label>
        <input
          type="checkbox"
          v-model="algeStore.cwEnabled"
          :disabled="!algeStore.isConnected"
        />
        Enable
      </label>
    </div>
    <div class="module-header">Coursewalks</div>

    <div style="padding: 1rem;">
      <!-- Settings row -->
      <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem;">
        <label class="module-label">Version</label>
        <select v-model="algeStore.cwVersion" class="mled-select" :disabled="!algeStore.cwEnabled">
          <option value="1">CW1</option>
          <option value="2">CW2</option>
          <option value="3">CW3</option>
          <option value="4">CW4</option>
        </select>

        <label class="module-label" style="margin-left: 1rem;">Duration</label>
        <select v-model="algeStore.cwDuration" class="mled-select" :disabled="!algeStore.cwEnabled">
          <option value="7">7 min</option>
          <option value="8">8 min</option>
          <option value="9">9 min</option>
          <option value="10">10 min</option>
        </select>

        <label class="module-label" style="margin-left: 1rem;">Wait</label>
        <select v-model="algeStore.cwBreak" class="mled-select" :disabled="!algeStore.cwEnabled">
          <option value="10">10 s</option>
          <option value="20">20 s</option>
          <option value="30">30 s</option>
        </select>
      </div>

      <!-- Buttons row -->
      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <button @click="algeStore.startCoursewalk" class="btn btn-primary" :disabled="!algeStore.cwEnabled || algeStore.cwRunning">
          {{ algeStore.cwRunning ? 'Running...' : 'Start' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useAlgeStore } from '@stores/alge'

const algeStore = useAlgeStore()
</script>

<style scoped>
/* Component-specific styles if needed - most styles are in main.css */
</style>
