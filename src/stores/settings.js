/**
 * Settings Store - Manages application settings and preferences
 * Handles API configuration, display preferences, and persistence
 */

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { saveSettings, loadSettings, saveTheme, loadTheme } from '@services/storage/LocalStorageService'

export const useSettingsStore = defineStore('settings', () => {
  // ============================================================================
  // STATE
  // ============================================================================

  // Display preferences
  const highPrecisionTime = ref(false)
  const isDarkMode = ref(false)
  const maxRunningTime = ref(120) // Default 2 minutes in seconds

  // Auto-connect preferences
  const autoConnectEnabled = ref(true)
  const mledAutoConnectEnabled = ref(true)

  // API Integration settings
  const apiEnabled = ref(false)
  const apiProvider = ref('other') // 'agigames' or 'other'
  const apiEndpoint = ref('')
  const apiMethod = ref('POST')
  const apiKey = ref('')
  const apiStartedEnabled = ref(false)
  const apiFinishedEnabled = ref(true)

  // Status code mappings
  const statusMappings = ref({
    started: 3,
    finished: 4,
  })

  // Competition settings
  const competitionId = ref('')

  // UI state - Modal visibility
  const showSettings = ref(false)
  const showInfo = ref(false)
  const showRefreshConfirmation = ref(false)
  const showClearConfirmation = ref(false)
  const showCompactTimer = ref(false)
  const showApiKey = ref(false)
  const apiTestInProgress = ref(false)
  const apiTestResult = ref(null)
  const competitionIdError = ref('')

  // Active tab
  const activeTab = ref('timer')

  // Online status
  const isOnline = ref(navigator.onLine)

  // JSON export
  const jsonFileHandle = ref(null)
  const jsonExportEnabled = ref(false)

  // Initialization flag
  const isInitializing = ref(true)

  // ============================================================================
  // ACTIONS
  // ============================================================================

  /**
   * Initialize settings from localStorage
   */
  function initialize() {
    console.log('Initializing settings...')

    // Load theme
    const savedTheme = loadTheme()
    isDarkMode.value = savedTheme === 'dark'

    // Apply theme
    if (isDarkMode.value) {
      document.body.classList.add('dark-mode')
    }

    // Load settings
    const savedSettings = loadSettings()
    if (savedSettings) {
      // Display preferences
      highPrecisionTime.value = savedSettings.highPrecisionTime ?? false
      maxRunningTime.value = savedSettings.maxRunningTime ?? 120

      // Auto-connect preferences
      autoConnectEnabled.value = savedSettings.autoConnectEnabled ?? true
      mledAutoConnectEnabled.value = savedSettings.mledAutoConnectEnabled ?? true

      // API settings
      apiEnabled.value = savedSettings.apiEnabled ?? false
      apiProvider.value = savedSettings.apiProvider ?? 'other'
      apiEndpoint.value = savedSettings.apiEndpoint ?? ''
      apiMethod.value = savedSettings.apiMethod ?? 'POST'
      apiKey.value = savedSettings.apiKey ?? ''
      apiStartedEnabled.value = savedSettings.apiStartedEnabled ?? false
      apiFinishedEnabled.value = savedSettings.apiFinishedEnabled ?? true

      if (savedSettings.statusMappings) {
        statusMappings.value = savedSettings.statusMappings
      }

      // Competition settings
      competitionId.value = savedSettings.competitionId ?? ''
    }

    // Set up online/offline listeners
    window.addEventListener('online', () => {
      isOnline.value = true
    })

    window.addEventListener('offline', () => {
      isOnline.value = false
    })

    // Mark initialization complete
    isInitializing.value = false

    console.log('Settings initialized')
  }

  /**
   * Save current settings to localStorage
   */
  function persistSettings() {
    const settingsToSave = {
      highPrecisionTime: highPrecisionTime.value,
      maxRunningTime: maxRunningTime.value,
      autoConnectEnabled: autoConnectEnabled.value,
      mledAutoConnectEnabled: mledAutoConnectEnabled.value,
      apiEnabled: apiEnabled.value,
      apiProvider: apiProvider.value,
      apiEndpoint: apiEndpoint.value,
      apiMethod: apiMethod.value,
      apiKey: apiKey.value,
      apiStartedEnabled: apiStartedEnabled.value,
      apiFinishedEnabled: apiFinishedEnabled.value,
      statusMappings: statusMappings.value,
      competitionId: competitionId.value,
    }

    saveSettings(settingsToSave)
    console.log('Settings saved')
  }

  /**
   * Alias for persistSettings (for component compatibility)
   */
  function saveSettingsAlias() {
    persistSettings()
  }

  /**
   * Toggle dark mode theme
   */
  function toggleTheme() {
    isDarkMode.value = !isDarkMode.value

    if (isDarkMode.value) {
      document.body.classList.add('dark-mode')
      saveTheme('dark')
    } else {
      document.body.classList.remove('dark-mode')
      saveTheme('light')
    }

    console.log('Theme toggled:', isDarkMode.value ? 'dark' : 'light')
  }

  /**
   * Open settings modal
   */
  function openSettings() {
    showSettings.value = true
  }

  /**
   * Close settings modal and save
   */
  function closeSettings() {
    showSettings.value = false
    persistSettings()
  }

  /**
   * Cancel settings (don't save)
   */
  function cancelSettings() {
    showSettings.value = false
    // Reload settings to revert changes
    initialize()
  }

  /**
   * Open info modal
   */
  function openInfo() {
    showInfo.value = true
  }

  /**
   * Close info modal
   */
  function closeInfo() {
    showInfo.value = false
  }

  /**
   * Update API endpoint based on provider
   */
  function updateApiEndpoint() {
    if (apiProvider.value === 'agigames') {
      apiEndpoint.value = 'https://new.agigames.cz/api/api_timer.php?apikey=[key]&status=[status]&time=[time_no_decimal]&dec=[decimals]'
    }
    // For 'other' provider, user enters custom endpoint
  }

  /**
   * Test API connection
   */
  async function testApiConnection() {
    if (!apiEndpoint.value) return

    apiTestInProgress.value = true
    apiTestResult.value = null

    try {
      // Replace placeholders with test values
      const testUrl = apiEndpoint.value
        .replace('[key]', apiKey.value || 'test')
        .replace('[status]', '4')
        .replace('[time]', '12.34')
        .replace('[time_no_decimal]', '1234')
        .replace('[decimals]', '34')
        .replace('[timestamp]', Date.now().toString())

      const response = await fetch(testUrl, {
        method: apiMethod.value,
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        apiTestResult.value = {
          success: true,
          message: 'Connection successful! API is responding.',
        }
      } else {
        apiTestResult.value = {
          success: false,
          message: `API returned error: ${response.status} ${response.statusText}`,
        }
      }
    } catch (error) {
      apiTestResult.value = {
        success: false,
        message: `Connection failed: ${error.message}`,
      }
    } finally {
      apiTestInProgress.value = false

      // Auto-clear result after 5 seconds
      setTimeout(() => {
        apiTestResult.value = null
      }, 5000)
    }
  }

  /**
   * Send API call for timer event
   * @param {string} eventType - 'started' or 'finished'
   * @param {number} time - Time value in seconds
   * @param {string} status - Result status
   */
  async function sendApiCall(eventType, time = 0, status = 'clean') {
    if (!apiEnabled.value || !apiEndpoint.value) return

    // Check if this event type is enabled
    if (eventType === 'started' && !apiStartedEnabled.value) return
    if (eventType === 'finished' && !apiFinishedEnabled.value) return

    try {
      // Get status code
      const statusCode = statusMappings.value[eventType] || 0

      // Format time
      const timeStr = time.toFixed(3)
      const timeNoDecimal = Math.floor(time * 100).toString() // Time without decimal, 2 digits precision
      const decimals = (time % 1).toFixed(3).slice(2) // Get decimal part

      // Replace placeholders
      const url = apiEndpoint.value
        .replace('[key]', apiKey.value || '')
        .replace('[status]', statusCode.toString())
        .replace('[time]', timeStr)
        .replace('[time_no_decimal]', timeNoDecimal)
        .replace('[decimals]', decimals)
        .replace('[timestamp]', Date.now().toString())

      await fetch(url, {
        method: apiMethod.value,
        headers: {
          'Content-Type': 'application/json',
        },
      })

      console.log('API call sent:', { eventType, time, status, statusCode })
    } catch (error) {
      console.error('API call failed:', error)
    }
  }

  /**
   * Validate competition ID
   * @param {string} id - Competition ID to validate
   */
  function validateCompetitionId(id) {
    if (!id) {
      competitionIdError.value = ''
      return true
    }

    // Must be at least 6 alphanumeric characters
    if (id.length < 6) {
      competitionIdError.value = 'Competition ID must be at least 6 characters long'
      return false
    }

    if (!/^[a-zA-Z0-9]+$/.test(id)) {
      competitionIdError.value = 'Competition ID can only contain letters and numbers'
      return false
    }

    competitionIdError.value = ''
    return true
  }

  /**
   * Show refresh confirmation modal
   */
  function confirmRefresh() {
    showRefreshConfirmation.value = true
  }

  /**
   * Cancel refresh
   */
  function cancelRefresh() {
    showRefreshConfirmation.value = false
  }

  /**
   * Perform page refresh
   */
  function refreshPage() {
    window.location.reload()
  }

  /**
   * Open compact timer (Picture-in-Picture)
   */
  function openCompactTimer() {
    showCompactTimer.value = true
  }

  /**
   * Close compact timer
   */
  function closeCompactTimer() {
    showCompactTimer.value = false
  }

  /**
   * Confirm clear results action
   */
  function confirmClearResults() {
    showClearConfirmation.value = false
  }

  /**
   * Cancel clear results
   */
  function cancelClearResults() {
    showClearConfirmation.value = false
  }

  // ============================================================================
  // WATCHERS - Auto-save on changes (after initialization)
  // ============================================================================

  watch(
    [highPrecisionTime, maxRunningTime, autoConnectEnabled, mledAutoConnectEnabled],
    () => {
      if (!isInitializing.value) {
        persistSettings()
      }
    }
  )

  // ============================================================================
  // RETURN PUBLIC API
  // ============================================================================

  return {
    // State
    highPrecisionTime,
    maxRunningTime,
    isDarkMode,
    autoConnectEnabled,
    mledAutoConnectEnabled,
    apiEnabled,
    apiProvider,
    apiEndpoint,
    apiMethod,
    apiKey,
    apiStartedEnabled,
    apiFinishedEnabled,
    statusMappings,
    competitionId,
    showSettings,
    showInfo,
    showRefreshConfirmation,
    showClearConfirmation,
    showCompactTimer,
    showApiKey,
    apiTestInProgress,
    apiTestResult,
    competitionIdError,
    activeTab,
    isOnline,
    jsonFileHandle,
    jsonExportEnabled,
    isInitializing,

    // Actions
    initialize,
    persistSettings,
    saveSettings: saveSettingsAlias,
    toggleTheme,
    openSettings,
    closeSettings,
    cancelSettings,
    openInfo,
    closeInfo,
    updateApiEndpoint,
    testApiConnection,
    sendApiCall,
    validateCompetitionId,
    confirmRefresh,
    cancelRefresh,
    refreshPage,
    openCompactTimer,
    closeCompactTimer,
    confirmClearResults,
    cancelClearResults,
  }
})

export default useSettingsStore
