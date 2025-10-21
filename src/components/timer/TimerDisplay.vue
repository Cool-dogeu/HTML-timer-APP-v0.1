<template>
  <section class="timer-section">
    <div class="section-header">
      <h2>Latest Result</h2>
      <div style="display: flex; gap: 0.5rem;">
        <button
          @click="openPictureInPicture"
          class="btn btn-secondary btn-small"
          title="Open Picture-in-Picture window"
        >
          <i class="material-icons">picture_in_picture_alt</i>
        </button>
        <button
          @click="copyLatestResult"
          class="btn btn-secondary"
          :class="{ 'copy-success': copyButtonEffect === 'latest' }"
        >
          <i class="material-icons">
            {{ copyButtonEffect === 'latest' ? 'check' : 'content_copy' }}
          </i>
          {{ copyButtonEffect === 'latest' ? 'Copied!' : 'Copy' }}
        </button>
      </div>
    </div>
    <div
      class="timer-display"
      :class="{ running: timerStore.isRunning }"
      @dblclick="copyLatestResult"
      title="Double-click to copy"
    >
      <div class="timer-value">{{ timerStore.displayTime }}</div>
      <div class="timer-status" v-if="displayStatus">{{ displayStatus }}</div>
    </div>

    <div class="precision-toggle">
      <label class="checkbox-label">
        <input
          type="checkbox"
          v-model="settingsStore.highPrecisionTime"
          @change="updateDisplayPrecision"
        />
        High Precision (3 decimals)
      </label>
    </div>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useTimerStore } from '@stores/timer'
import { useSettingsStore } from '@stores/settings'

const timerStore = useTimerStore()
const settingsStore = useSettingsStore()

// Copy button effect state
const copyButtonEffect = ref(null)

/**
 * Display status (hide "Clean", show everything else)
 */
const displayStatus = computed(() => {
  const status = timerStore.timerStatus
  return status === 'Clean' ? '' : status
})

/**
 * Copy latest result to clipboard
 */
async function copyLatestResult() {
  try {
    await navigator.clipboard.writeText(timerStore.displayTime)
    copyButtonEffect.value = 'latest'
    setTimeout(() => {
      copyButtonEffect.value = null
    }, 2000)
  } catch (error) {
    console.error('Failed to copy:', error)
  }
}

/**
 * Update display precision when checkbox changes
 */
function updateDisplayPrecision() {
  settingsStore.saveSettings()
  timerStore.updateDisplayTime()
}

/**
 * Open Picture-in-Picture window (compact timer modal)
 */
function openPictureInPicture() {
  settingsStore.showCompactTimer = true
}
</script>

<style scoped>
/* Component-specific styles if needed - most styles are in main.css */
</style>
