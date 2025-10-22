/**
 * Timer Store - Manages timer state and results
 * Core state for timing functionality
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { formatTime, getCurrentTimestamp } from '@services/formatters/TimeFormatter'
import { saveResults, loadResults, clearResults as clearStoredResults } from '@services/storage/LocalStorageService'
import { useSettingsStore } from './settings'
import { useMledStore } from './mled'
import { useHdmiStore } from './hdmi'
import { useAlgeStore } from './alge'

export const useTimerStore = defineStore('timer', () => {
  // ============================================================================
  // STATE
  // ============================================================================

  // Timer state
  const isRunning = ref(false)
  const displayTime = ref('0.00')
  const timerStatus = ref('Ready')
  const startTime = ref(null)
  const startTimeAbsolute = ref(null)
  const finishTime = ref(null)
  const activeUserId = ref(null)

  // Results management
  const results = ref([])
  const selectedResultIndex = ref(null)

  // Timer intervals and buffers
  const runningTimerInterval = ref(null)
  const finishSignalBuffer = ref([])
  const finishSignalTimeout = ref(null)

  // UI state
  const copyButtonEffect = ref('')
  const copyButtonTimeout = ref(null)

  // ============================================================================
  // COMPUTED / GETTERS
  // ============================================================================

  const latestResult = computed(() => {
    return results.value.length > 0 ? results.value[0] : null
  })

  const selectedResult = computed(() => {
    return selectedResultIndex.value !== null
      ? results.value[selectedResultIndex.value]
      : null
  })

  const hasResults = computed(() => {
    return results.value.length > 0
  })

  // ============================================================================
  // ACTIONS
  // ============================================================================

  /**
   * Initialize timer store - load persisted data
   */
  function initialize() {
    const savedResults = loadResults()
    if (savedResults && savedResults.length > 0) {
      results.value = savedResults
    }
  }

  /**
   * Start timer with absolute time
   * @param {Date} absoluteTime - Start time from timing device
   * @param {number} userId - User ID from packet
   */
  function startTimer(absoluteTime, userId = 0) {
    // Prevent starting timer if already running
    if (isRunning.value) {
      console.log('Timer already running - ignoring start signal')
      return
    }

    console.log('Timer started:', { absoluteTime, userId })

    isRunning.value = true
    startTime.value = Date.now()
    startTimeAbsolute.value = absoluteTime
    activeUserId.value = userId
    timerStatus.value = 'Running...'

    // Start display update interval
    if (runningTimerInterval.value) {
      clearInterval(runningTimerInterval.value)
    }

    runningTimerInterval.value = setInterval(() => {
      if (isRunning.value && startTime.value) {
        const elapsed = (Date.now() - startTime.value) / 1000
        const settingsStore = useSettingsStore()
        displayTime.value = formatTime(elapsed, settingsStore.highPrecisionTime)
      }
    }, 50) // Update every 50ms for smooth display
  }

  /**
   * Stop timer with delta time result
   * @param {number} deltaTime - Elapsed time in seconds
   * @param {string} status - Result status ('clean' or 'fault')
   * @param {number} userId - User ID from packet
   */
  function stopTimer(deltaTime, status = 'clean', userId = 0) {
    console.log('Timer stopped:', { deltaTime, status, userId })

    // Only stop if this is for the active user
    if (activeUserId.value !== null && userId !== activeUserId.value) {
      console.log('Ignoring stop signal for different user')
      return
    }

    isRunning.value = false
    finishTime.value = deltaTime
    const settingsStore = useSettingsStore()
    displayTime.value = formatTime(deltaTime, settingsStore.highPrecisionTime)
    timerStatus.value = status === 'fault' ? 'Fault' : 'Clean'

    // Stop display update interval
    if (runningTimerInterval.value) {
      clearInterval(runningTimerInterval.value)
      runningTimerInterval.value = null
    }

    // Add result to history
    addResult({
      time: deltaTime,
      status: status,
      timestamp: getCurrentTimestamp()
    })

    // Reset active user
    activeUserId.value = null
  }

  /**
   * Add finish signal to buffer (for prioritizing c1 over other channels)
   * @param {Object} packet - Timing packet
   */
  function bufferFinishSignal(packet) {
    finishSignalBuffer.value.push(packet)

    // Clear existing timeout
    if (finishSignalTimeout.value) {
      clearTimeout(finishSignalTimeout.value)
    }

    // Wait 100ms for c1 signal, then process buffered signals
    finishSignalTimeout.value = setTimeout(() => {
      processBufferedFinishSignals()
    }, 100)
  }

  /**
   * Process buffered finish signals (prioritize c1)
   */
  function processBufferedFinishSignals() {
    if (finishSignalBuffer.value.length === 0) return

    // Prioritize channel 1 signals
    const c1Signal = finishSignalBuffer.value.find(p => p.channelNumber === 1)
    const signalToProcess = c1Signal || finishSignalBuffer.value[0]

    // Clear buffer
    finishSignalBuffer.value = []
    finishSignalTimeout.value = null

    // Process the selected signal
    if (signalToProcess) {
      const status = signalToProcess.status === 0 ? 'clean' : 'fault'
      stopTimer(signalToProcess.deltaTime, status, signalToProcess.userId)
    }
  }

  /**
   * Add result to history
   * @param {Object} result - Result object {time, status, timestamp}
   */
  function addResult(result) {
    // Add to beginning of array (newest first)
    results.value.unshift(result)

    // Keep only last 100 results
    if (results.value.length > 100) {
      results.value = results.value.slice(0, 100)
    }

    // Save to localStorage
    saveResults(results.value)
  }

  /**
   * Select a result by index
   * @param {number} index - Result index
   */
  function selectResult(index) {
    selectedResultIndex.value = index
  }

  /**
   * Clear result selection
   */
  function clearSelection() {
    selectedResultIndex.value = null
  }

  /**
   * Clear all results
   */
  function clearAllResults() {
    results.value = []
    selectedResultIndex.value = null
    clearStoredResults()
  }

  /**
   * Update display time with current precision
   * @param {boolean} highPrecision - Use 3 decimals
   */
  function updateDisplayPrecision(highPrecision) {
    if (finishTime.value !== null) {
      displayTime.value = formatTime(finishTime.value, highPrecision)
    } else if (isRunning.value && startTime.value) {
      const elapsed = (Date.now() - startTime.value) / 1000
      displayTime.value = formatTime(elapsed, highPrecision)
    }
  }

  /**
   * Update display time using current settings precision
   */
  function updateDisplayTime() {
    const settingsStore = useSettingsStore()
    updateDisplayPrecision(settingsStore.highPrecisionTime)
  }

  /**
   * Reset timer to ready state
   */
  function resetTimer() {
    isRunning.value = false
    const settingsStore = useSettingsStore()
    displayTime.value = settingsStore.highPrecisionTime ? '0.000' : '0.00'
    timerStatus.value = 'Ready'
    startTime.value = null
    startTimeAbsolute.value = null
    finishTime.value = null
    activeUserId.value = null

    if (runningTimerInterval.value) {
      clearInterval(runningTimerInterval.value)
      runningTimerInterval.value = null
    }

    // Clear finish signal buffer
    finishSignalBuffer.value = []
    if (finishSignalTimeout.value) {
      clearTimeout(finishSignalTimeout.value)
      finishSignalTimeout.value = null
    }
  }

  /**
   * Set copy button effect
   * @param {string} effect - Effect identifier ('latest', 'selected')
   */
  function setCopyButtonEffect(effect) {
    copyButtonEffect.value = effect

    // Clear existing timeout
    if (copyButtonTimeout.value) {
      clearTimeout(copyButtonTimeout.value)
    }

    // Auto-clear after 2 seconds
    copyButtonTimeout.value = setTimeout(() => {
      copyButtonEffect.value = ''
      copyButtonTimeout.value = null
    }, 2000)
  }

  /**
   * Copy result to clipboard
   * @param {Object} result - Result to copy
   * @returns {boolean} Success status
   */
  async function copyResultToClipboard(result) {
    if (!result) return false

    try {
      const text = formatTime(result.time, true) // Always use high precision for copy
      await navigator.clipboard.writeText(text)
      return true
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      return false
    }
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Cleanup function for when store is destroyed
   */
  function cleanup() {
    if (runningTimerInterval.value) {
      clearInterval(runningTimerInterval.value)
    }
    if (finishSignalTimeout.value) {
      clearTimeout(finishSignalTimeout.value)
    }
    if (copyButtonTimeout.value) {
      clearTimeout(copyButtonTimeout.value)
    }
  }

  // ============================================================================
  // WATCHERS - Timer Link Integration
  // ============================================================================

  /**
   * Watch timer state and route to MLED, HDMI, and Alge displays
   */
  watch([displayTime, isRunning], ([time, running]) => {
    const mledStore = useMledStore()
    const hdmiStore = useHdmiStore()
    const algeStore = useAlgeStore()
    const state = running ? 'running' : 'finished'

    // Route to all display types
    mledStore.routeTimerToDisplay(time, state)
    hdmiStore.routeTimerToDisplay(time, state)
    algeStore.routeTimerToDisplay(time, state)
  })

  // ============================================================================
  // RETURN PUBLIC API
  // ============================================================================

  return {
    // State
    isRunning,
    displayTime,
    timerStatus,
    startTime,
    startTimeAbsolute,
    finishTime,
    activeUserId,
    results,
    selectedResultIndex,
    copyButtonEffect,

    // Computed
    latestResult,
    selectedResult,
    hasResults,

    // Actions
    initialize,
    startTimer,
    stopTimer,
    bufferFinishSignal,
    processBufferedFinishSignals,
    addResult,
    selectResult,
    clearSelection,
    clearAllResults,
    updateDisplayPrecision,
    updateDisplayTime,
    resetTimer,
    setCopyButtonEffect,
    copyResultToClipboard,
    cleanup,
  }
})

export default useTimerStore
