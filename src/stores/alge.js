/**
 * Alge Store - Manages Alge GAZ display connections and modules
 * Handles Alge connection, coursewalks, and timer link
 * Based on Python scripts: fdstoalge.py and cwalge.py
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { AlgeSerialManager } from '@services/serial/AlgeSerialManager'
import { getDeviceInfo } from '@services/serial/deviceHelpers'
import { saveAlgeSettings, loadAlgeSettings } from '@services/storage/LocalStorageService'

export const useAlgeStore = defineStore('alge', () => {
  // ============================================================================
  // STATE
  // ============================================================================

  // Connection state
  const isConnected = ref(false)
  const manager = ref(null)
  const port = ref(null)
  const deviceInfo = ref(null)

  // Display settings
  const previewText = ref('')
  const activeLabel = ref('Idle')

  // Coursewalks module
  const cwEnabled = ref(false)
  const cwVersion = ref('1')
  const cwDuration = ref('8')
  const cwBreak = ref('20')
  const cwCancel = ref(false)
  const cwTimers = ref([])
  const cwActiveIndex = ref(0) // Currently active coursewalk (1-4)

  // Timer LINK module
  const linkEnabled = ref(false)
  const linkHold = ref(7) // Hold time in seconds after timer stops
  const linkStatus = ref('Waiting for timer data...')
  const linkClearTimer = ref(null)
  const linkLastSentSecond = ref(-1) // Track last sent second for throttling

  // Initialization flag
  const isInitializing = ref(true)

  // ============================================================================
  // COMPUTED / GETTERS
  // ============================================================================

  const connectionStatus = computed(() => {
    return isConnected.value ? 'Connected' : 'Disconnected'
  })

  const statusLedClass = computed(() => {
    return isConnected.value ? 'status-ok' : 'status-error'
  })

  // ============================================================================
  // ACTIONS - Connection
  // ============================================================================

  /**
   * Initialize Alge store
   */
  function initialize() {
    console.log('Initializing Alge store...')

    // Load settings
    const settings = loadAlgeSettings()
    if (settings) {
      // Coursewalks module
      if (settings.cwVersion !== undefined) cwVersion.value = settings.cwVersion
      if (settings.cwDuration !== undefined) cwDuration.value = settings.cwDuration
      if (settings.cwBreak !== undefined) cwBreak.value = settings.cwBreak

      // Timer LINK module
      if (settings.linkHold !== undefined) linkHold.value = settings.linkHold
    }

    isInitializing.value = false
    console.log('Alge store initialized')
  }

  /**
   * Persist Alge settings to localStorage
   */
  function persistSettings() {
    const settings = {
      cwVersion: cwVersion.value,
      cwDuration: cwDuration.value,
      cwBreak: cwBreak.value,
      linkHold: linkHold.value,
    }

    saveAlgeSettings(settings)
    console.log('Alge settings saved')
  }

  /**
   * Connect to Alge display
   */
  async function connect() {
    try {
      // Request port from user
      const requestedPort = await navigator.serial.requestPort()

      // Get device info
      deviceInfo.value = getDeviceInfo(requestedPort)
      port.value = requestedPort

      // Create manager instance
      manager.value = new AlgeSerialManager()

      // Set up callbacks
      manager.value.onConnectionChange = handleConnectionChange

      // Connect
      await manager.value.connect(requestedPort)

      isConnected.value = true

      // Save device info
      localStorage.setItem('algeDeviceInfo', JSON.stringify(deviceInfo.value))

      console.log('Alge connected successfully')

      // Clear display on connect
      await manager.value.clear()
    } catch (error) {
      console.error('Alge connection failed:', error)
      throw error
    }
  }

  /**
   * Disconnect from Alge display
   */
  async function disconnect() {
    if (manager.value) {
      try {
        await manager.value.disconnect()
      } catch (error) {
        console.error('Alge disconnect error:', error)
      }
    }

    isConnected.value = false
    port.value = null
    deviceInfo.value = null
    manager.value = null

    localStorage.removeItem('algeDeviceInfo')

    console.log('Alge disconnected')
  }

  /**
   * Auto-reconnect to previously authorized Alge port
   */
  async function autoReconnect() {
    if (!('serial' in navigator)) {
      return false
    }

    try {
      // Get previously authorized ports
      const ports = await navigator.serial.getPorts()
      if (ports.length === 0) {
        return false
      }

      // Load saved device info
      const savedDeviceInfo = localStorage.getItem('algeDeviceInfo')
      if (!savedDeviceInfo) {
        return false
      }

      const savedInfo = JSON.parse(savedDeviceInfo)

      // Find matching port
      for (const p of ports) {
        const info = getDeviceInfo(p)
        if (info.vendorId === savedInfo.vendorId && info.productId === savedInfo.productId) {
          console.log('Found Alge device, attempting auto-reconnect...')

          manager.value = new AlgeSerialManager()
          manager.value.onConnectionChange = handleConnectionChange

          await manager.value.connect(p)

          port.value = p
          deviceInfo.value = info
          isConnected.value = true

          console.log('Alge auto-reconnected successfully')

          // Clear display
          await manager.value.clear()

          return true
        }
      }
    } catch (error) {
      console.error('Alge auto-reconnect failed:', error)
    }

    return false
  }

  /**
   * Handle connection state changes
   * @param {boolean} connected - Connection status
   */
  function handleConnectionChange(connected) {
    isConnected.value = connected

    if (!connected) {
      console.log('Alge connection lost')
    }
  }

  // ============================================================================
  // ACTIONS - Display Communication
  // ============================================================================

  /**
   * Clear Alge display
   */
  async function clear() {
    if (!isConnected.value) {
      throw new Error('Alge not connected')
    }

    console.log('Clearing Alge display...')

    // Stop any active modules
    stopCoursewalks()

    // Cancel Timer LINK auto-clear
    if (linkClearTimer.value) {
      clearTimeout(linkClearTimer.value)
      linkClearTimer.value = null
    }

    // Clear display
    await manager.value.clear()

    // Reset state
    previewText.value = ''
    activeLabel.value = 'Idle'

    console.log('Alge display cleared')
  }

  // ============================================================================
  // ACTIONS - Coursewalks Module
  // ============================================================================

  /**
   * Sleep utility for coursewalks
   * @param {number} ms - Milliseconds to sleep
   */
  function cwSleep(ms) {
    return new Promise((resolve) => {
      const id = setTimeout(resolve, ms)
      cwTimers.value.push(id)
    })
  }

  /**
   * Stop all coursewalk timers
   */
  function stopCoursewalks() {
    cwCancel.value = true
    cwTimers.value.forEach((id) => clearTimeout(id))
    cwTimers.value = []
    cwActiveIndex.value = 0
  }

  /**
   * Run one coursewalk
   * @param {number} n - Coursewalk index (1-4)
   * @param {number} minutes - Duration in minutes
   */
  async function cwRunOne(n, minutes) {
    if (cwCancel.value) return

    cwActiveIndex.value = n

    // Show break message first
    await manager.value.sendCoursewalkBreak(n)
    previewText.value = `${n}  - - -`
    activeLabel.value = 'Coursewalks'

    // Wait for break duration
    await cwSleep(parseInt(cwBreak.value) * 1000)
    if (cwCancel.value) return

    // Countdown
    let seconds = Math.max(0, Math.floor(minutes * 60))
    for (let t = seconds; t >= 0; t--) {
      if (cwCancel.value) return

      await manager.value.sendCoursewalkRunning(n, t)
      const m = Math.floor(t / 60)
      const s = t % 60
      previewText.value = `${n}  ${m}.${s.toString().padStart(2, '0')}`

      if (t > 0) {
        await cwSleep(1000)
      }
    }

    if (cwCancel.value) return
  }

  /**
   * Run coursewalk sequence
   * @param {number} upto - Number of coursewalks (1-4)
   * @param {number} minutes - Duration per coursewalk in minutes
   */
  async function runCoursewalk(upto, minutes) {
    cwCancel.value = false
    cwTimers.value = []

    // Cancel Timer LINK auto-clear
    if (linkClearTimer.value) {
      clearTimeout(linkClearTimer.value)
      linkClearTimer.value = null
    }

    for (let i = 1; i <= upto; i++) {
      if (cwCancel.value) break
      await cwRunOne(i, minutes)
    }

    // After sequence completes, wait 3 seconds then clear to 0.00
    if (!cwCancel.value) {
      await cwSleep(3000)
      if (!cwCancel.value) {
        await manager.value.clear()
      }
    }

    cwActiveIndex.value = 0
    activeLabel.value = 'Idle'
    previewText.value = ''
  }

  /**
   * Start coursewalk sequence
   */
  async function startCoursewalk() {
    if (!isConnected.value) {
      throw new Error('Alge not connected')
    }

    if (!cwEnabled.value) {
      throw new Error('Coursewalks module is disabled')
    }

    const version = parseInt(cwVersion.value)
    const duration = parseInt(cwDuration.value)

    await runCoursewalk(version, duration)
  }

  // ============================================================================
  // ACTIONS - Timer LINK Module
  // ============================================================================

  /**
   * Route timer data to Alge display
   * @param {string} timeStr - Time string (e.g., "45.67")
   * @param {string} state - Timer state ('running' or 'finished')
   */
  async function routeTimerToDisplay(timeStr, state) {
    if (!linkEnabled.value) return
    if (!isConnected.value) return

    try {
      // Parse time string to get seconds and hundredths
      const parts = timeStr.split('.')
      const sec = parseInt(parts[0]) || 0
      const dd = parts[1] ? parseInt(parts[1].substring(0, 2).padEnd(2, '0')) : 0

      if (state === 'running') {
        // DETECT NEW RUN START: Clear display when timer starts from 0
        // This prevents flashing previous result digits
        if (sec === 0 && linkLastSentSecond.value !== 0) {
          await manager.value.clear()
        }

        // THROTTLE: Only send once per second (when second changes)
        // This matches the Python fdstoalge.py behavior
        if (sec === linkLastSentSecond.value) {
          return // Skip - already sent for this second
        }
        linkLastSentSecond.value = sec

        // Running - send without decimals
        await manager.value.sendTimeWithoutDecimals(sec)
        previewText.value = `${sec}.  `
        activeLabel.value = 'Timer Link (Running)'
        linkStatus.value = `Routing: ${timeStr} (Running)`

        // Clear any pending auto-clear timer when running
        if (linkClearTimer.value) {
          clearTimeout(linkClearTimer.value)
          linkClearTimer.value = null
        }
      } else if (state === 'finished') {
        // Reset throttle for next run
        linkLastSentSecond.value = -1

        // Finished - send with decimals
        await manager.value.sendTimeWithDecimals(sec, dd)
        previewText.value = `${sec}.${dd.toString().padStart(2, '0')}`
        activeLabel.value = 'Timer Link (Finished)'
        linkStatus.value = `Routed: ${timeStr} (Finished)`

        // Auto-clear after configured hold time
        if (linkClearTimer.value) {
          clearTimeout(linkClearTimer.value)
        }
        linkClearTimer.value = setTimeout(() => {
          clear()
          linkStatus.value = 'Waiting for timer data...'
        }, linkHold.value * 1000)
      }
    } catch (error) {
      console.error('Timer LINK routing error:', error)
    }
  }

  // ============================================================================
  // WATCHERS - Module Exclusivity
  // ============================================================================

  watch(cwEnabled, (newVal, oldVal) => {
    if (isInitializing.value) return

    if (newVal === true && oldVal === false) {
      // Enabling - disable other modules
      linkEnabled.value = false
    }

    if (oldVal === true && newVal === false && isConnected.value) {
      stopCoursewalks()
    }
  })

  watch(linkEnabled, (newVal, oldVal) => {
    if (isInitializing.value) return

    if (newVal === true && oldVal === false) {
      // Enabling - disable other modules
      cwEnabled.value = false

      // Stop any active modules
      stopCoursewalks()
    }

    if (oldVal === true && newVal === false && isConnected.value) {
      linkStatus.value = 'Waiting for timer data...'
    }
  })

  // Auto-save settings watchers
  watch([cwVersion, cwDuration, cwBreak, linkHold], () => {
    if (!isInitializing.value) {
      persistSettings()
    }
  })

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Cleanup function for when store is destroyed
   */
  function cleanup() {
    stopCoursewalks()

    if (linkClearTimer.value) {
      clearTimeout(linkClearTimer.value)
    }

    if (manager.value) {
      manager.value.disconnect()
    }
  }

  // ============================================================================
  // RETURN PUBLIC API
  // ============================================================================

  return {
    // State
    isConnected,
    manager,
    port,
    deviceInfo,

    // Display settings
    previewText,
    activeLabel,

    // Coursewalks module
    cwEnabled,
    cwVersion,
    cwDuration,
    cwBreak,
    cwActiveIndex,

    // Timer LINK module
    linkEnabled,
    linkHold,
    linkStatus,

    // Computed
    connectionStatus,
    statusLedClass,

    // Actions - Connection
    initialize,
    persistSettings,
    connect,
    disconnect,
    autoReconnect,

    // Actions - Display
    clear,

    // Actions - Coursewalks Module
    startCoursewalk,
    stopCoursewalks,

    // Actions - Timer LINK Module
    routeTimerToDisplay,

    // Cleanup
    cleanup,
  }
})

export default useAlgeStore
