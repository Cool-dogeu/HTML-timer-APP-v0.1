<template>
  <section class="results-section">
    <div class="section-header">
      <h2>Result History</h2>
      <button
        @click="copySelectedResult"
        class="btn btn-secondary"
        :class="{ 'copy-success': copyButtonEffect === 'selected' }"
        :disabled="!selectedResult"
      >
        <i class="material-icons">
          {{ copyButtonEffect === 'selected' ? 'check' : 'content_copy' }}
        </i>
        {{ copyButtonEffect === 'selected' ? 'Copied!' : 'Copy Selected' }}
      </button>
    </div>
    <div class="results-table-container">
      <table class="results-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Result</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(result, index) in timerStore.results"
            :key="index"
            @click="selectResult(index)"
            @dblclick="copyResultRow(index)"
            :class="{ selected: selectedResultIndex === index }"
            title="Click to select, double-click to copy"
          >
            <td>{{ timerStore.results.length - index }}</td>
            <td class="result-clean">
              {{ formatResultDisplay(result) }}
            </td>
            <td>{{ result.timestamp }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Action buttons underneath the table -->
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
  </section>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useTimerStore } from '@stores/timer'
import { useSettingsStore } from '@stores/settings'
import { resultsToCSVString } from '@services/formatters/CsvExporter'

const timerStore = useTimerStore()
const settingsStore = useSettingsStore()

// Selection state
const selectedResultIndex = ref(null)
const copyButtonEffect = ref(null)

// JSON file handle for continuous export
const jsonFileHandle = ref(null)

// Computed property for selected result
const selectedResult = computed(() => {
  if (selectedResultIndex.value !== null) {
    return timerStore.results[selectedResultIndex.value]
  }
  return null
})

/**
 * Select a result row
 * @param {number} index - Result index
 */
function selectResult(index) {
  selectedResultIndex.value = index
}

/**
 * Copy selected result to clipboard
 */
async function copySelectedResult() {
  if (!selectedResult.value) return

  try {
    const text = formatResultDisplay(selectedResult.value)
    await navigator.clipboard.writeText(text)
    copyButtonEffect.value = 'selected'
    setTimeout(() => {
      copyButtonEffect.value = null
    }, 2000)
  } catch (error) {
    console.error('Failed to copy:', error)
  }
}

/**
 * Copy result row on double-click
 * @param {number} index - Result index
 */
async function copyResultRow(index) {
  selectedResultIndex.value = index
  await copySelectedResult()
}

/**
 * Format result for display
 * @param {Object} result - Result object
 * @returns {string} Formatted result string
 */
function formatResultDisplay(result) {
  const precision = settingsStore.highPrecisionTime ? 3 : 2
  const formatted = result.time.toFixed(precision)
  // Always show clean results without F suffix
  return formatted
}

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

// Expose writeJsonToFile for external use (if needed by stores)
defineExpose({
  writeJsonToFile
})
</script>

<style scoped>
/* Component-specific styles if needed - most styles are in main.css */
</style>
