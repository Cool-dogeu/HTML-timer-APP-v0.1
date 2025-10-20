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
            <td :class="'result-' + result.status">
              {{ formatResultDisplay(result) }}
            </td>
            <td>{{ result.timestamp }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useTimerStore } from '@stores/timer'
import { useSettingsStore } from '@stores/settings'

const timerStore = useTimerStore()
const settingsStore = useSettingsStore()

// Selection state
const selectedResultIndex = ref(null)
const copyButtonEffect = ref(null)

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
  return result.status === 'fault' ? `${formatted}F` : formatted
}
</script>

<style scoped>
/* Component-specific styles if needed - most styles are in main.css */
</style>
