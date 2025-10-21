<template>
  <div class="results-actions">
    <button
      @click="exportResults"
      class="btn btn-secondary"
      :disabled="timerStore.results.length === 0"
    >
      <i class="material-icons">download</i>
      Export CSV
    </button>
    <button
      @click="setupJsonExport"
      class="btn btn-secondary"
      :class="{ 'btn-success': jsonFileHandle !== null }"
    >
      <i class="material-icons">
        {{ jsonFileHandle !== null ? 'check_circle' : 'save' }}
      </i>
      {{ jsonFileHandle !== null ? 'JSON Active' : 'SAVE to JSON' }}
    </button>
    <button
      @click="confirmClearResults"
      class="btn btn-danger"
      :disabled="timerStore.results.length === 0"
    >
      <i class="material-icons">clear_all</i>
      Clear Results
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useTimerStore } from '@stores/timer'
import { useSettingsStore } from '@stores/settings'
import { resultsToCSVString } from '@services/formatters/CsvExporter'

const timerStore = useTimerStore()
const settingsStore = useSettingsStore()

// JSON file handle for continuous export
const jsonFileHandle = ref(null)

/**
 * Export results to CSV file
 */
async function exportResults() {
  try {
    const csv = resultsToCSVString(timerStore.results)

    // Create download link
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', `agility-timer-results-${Date.now()}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    console.error('Failed to export results:', error)
  }
}

/**
 * Setup JSON file export using File System Access API
 */
async function setupJsonExport() {
  if (!('showSaveFilePicker' in window)) {
    alert('File System Access API is not supported in this browser. Please use Chrome or Edge.')
    return
  }

  try {
    // Request file handle
    const handle = await window.showSaveFilePicker({
      suggestedName: `agility-timer-results-${Date.now()}.json`,
      types: [{
        description: 'JSON Files',
        accept: { 'application/json': ['.json'] }
      }]
    })

    jsonFileHandle.value = handle

    // Write initial data
    await writeJsonToFile()

    console.log('JSON export file set up successfully')
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Failed to setup JSON export:', error)
    }
  }
}

/**
 * Write results to JSON file
 */
async function writeJsonToFile() {
  if (!jsonFileHandle.value) return

  try {
    const writable = await jsonFileHandle.value.createWritable()
    const json = JSON.stringify(timerStore.results, null, 2)
    await writable.write(json)
    await writable.close()
  } catch (error) {
    console.error('Failed to write JSON file:', error)
    jsonFileHandle.value = null
  }
}

/**
 * Show confirmation modal for clearing results
 */
function confirmClearResults() {
  settingsStore.showClearConfirmation = true
}

// Watch for changes to results and auto-save to JSON if configured
// This will be handled by the timer store calling writeJsonToFile
// Expose writeJsonToFile for external use
defineExpose({
  writeJsonToFile
})
</script>

<style scoped>
/* Component-specific styles if needed - most styles are in main.css */
</style>
