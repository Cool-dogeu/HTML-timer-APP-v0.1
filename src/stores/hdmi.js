/**
 * HDMI Store - Manages HDMI output window and modules
 * Handles popup window management, text display, coursewalks, countdown timers, and timer link
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { saveHdmiSettings, loadHdmiSettings } from '@services/storage/LocalStorageService'

export const useHdmiStore = defineStore('hdmi', () => {
  // ============================================================================
  // STATE
  // ============================================================================

  // Window state
  const isEnabled = ref(false)
  const windowRef = ref(null)
  const windowCheckInterval = ref(null)

  // Display settings
  const backgroundColor = ref('#000000')
  const foregroundColor = ref('#ffffff')
  const fontSize = ref('large') // small, medium, large, xlarge
  const previewText = ref('HDMI preview')
  const activeLabel = ref('Idle')

  // Text module
  const textEnabled = ref(false)
  const textInput = ref('')
  const textColor = ref('Default')
  const charsLeft = ref(64)

  // Coursewalks module
  const cwEnabled = ref(false)
  const cwVersion = ref('1')
  const cwDuration = ref('9')
  const cwWait = ref('20')
  const cwCancel = ref(false)
  const cwTimers = ref([])

  // Countdown Timer module
  const timerEnabled = ref(false)

  // Count Up
  const upColor = ref('Red')
  const upTimer = ref(null)
  const upStartTs = ref(0)
  const upClearTimer = ref(null)

  // Count Down
  const downColor = ref('Red')
  const downHH = ref(0)
  const downMM = ref(10)
  const downSS = ref(0)
  const downTimer = ref(null)
  const downEndTs = ref(0)
  const downHold = ref(10) // Hold time in seconds after countdown reaches 0
  const downClearTimer = ref(null)

  // Timer LINK module
  const linkEnabled = ref(false)
  const linkColor = ref('Green')
  const linkHold = ref(7) // Hold time in seconds after timer stops
  const linkStatus = ref('Waiting for timer data...')
  const linkClearTimer = ref(null)

  // Initialization flag
  const isInitializing = ref(true)

  // ============================================================================
  // COMPUTED / GETTERS
  // ============================================================================

  const connectionStatus = computed(() => {
    return isEnabled.value ? 'Enabled' : 'Disabled'
  })

  const isWindowOpen = computed(() => {
    return windowRef.value && !windowRef.value.closed
  })

  // ============================================================================
  // ACTIONS - Window Management
  // ============================================================================

  /**
   * Initialize HDMI store
   */
  function initialize() {
    console.log('Initializing HDMI store...')

    // Load settings
    const settings = loadHdmiSettings()
    if (settings) {
      // Display settings
      if (settings.backgroundColor !== undefined) backgroundColor.value = settings.backgroundColor
      if (settings.foregroundColor !== undefined) foregroundColor.value = settings.foregroundColor
      if (settings.fontSize !== undefined) fontSize.value = settings.fontSize

      // Text module
      if (settings.textColor !== undefined) textColor.value = settings.textColor

      // Coursewalks module
      if (settings.cwVersion !== undefined) cwVersion.value = settings.cwVersion
      if (settings.cwDuration !== undefined) cwDuration.value = settings.cwDuration
      if (settings.cwWait !== undefined) cwWait.value = settings.cwWait

      // Countdown Timer module
      if (settings.upColor !== undefined) upColor.value = settings.upColor
      if (settings.downColor !== undefined) downColor.value = settings.downColor
      if (settings.downHH !== undefined) downHH.value = settings.downHH
      if (settings.downMM !== undefined) downMM.value = settings.downMM
      if (settings.downSS !== undefined) downSS.value = settings.downSS
      if (settings.downHold !== undefined) downHold.value = settings.downHold

      // Timer LINK module
      if (settings.linkColor !== undefined) linkColor.value = settings.linkColor
      if (settings.linkHold !== undefined) linkHold.value = settings.linkHold
    }

    isInitializing.value = false
    console.log('HDMI store initialized')
  }

  /**
   * Persist HDMI settings to localStorage
   */
  function persistSettings() {
    const settings = {
      backgroundColor: backgroundColor.value,
      foregroundColor: foregroundColor.value,
      fontSize: fontSize.value,
      textColor: textColor.value,
      cwVersion: cwVersion.value,
      cwDuration: cwDuration.value,
      cwWait: cwWait.value,
      upColor: upColor.value,
      downColor: downColor.value,
      downHH: downHH.value,
      downMM: downMM.value,
      downSS: downSS.value,
      downHold: downHold.value,
      linkColor: linkColor.value,
      linkHold: linkHold.value,
    }

    saveHdmiSettings(settings)
    console.log('HDMI settings saved')
  }

  /**
   * Open HDMI output window
   */
  function openWindow() {
    if (windowRef.value && !windowRef.value.closed) {
      console.log('HDMI window already open')
      return
    }

    const win = window.open('about:blank', 'HDMI_OUTPUT', 'width=1920,height=1080')
    if (!win) {
      throw new Error('Failed to open HDMI output window. Please check your browser popup blocker settings.')
    }

    windowRef.value = win

    // Create HTML document
    const htmlDoc = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>HDMI Output</title>
  <style>
    html, body {
      width: 100vw;
      height: 100vh;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: ${backgroundColor.value};
      font-family: Arial, Helvetica, sans-serif;
    }
    #output {
      text-align: center;
      white-space: nowrap;
      color: ${foregroundColor.value};
      font-weight: bold;
      letter-spacing: 2px;
    }
    .size-small { font-size: 80px; }
    .size-medium { font-size: 160px; }
    .size-large { font-size: 240px; }
    .size-xlarge { font-size: 320px; }
  </style>
</head>
<body>
  <div id="output" class="size-${fontSize.value}">Ready</div>
</body>
</html>`

    win.document.open()
    win.document.write(htmlDoc)
    win.document.close()

    isEnabled.value = true
    console.log('HDMI output window opened')

    // Update with preview text
    updateOutput(previewText.value)

    // Monitor window close
    startWindowMonitoring()
  }

  /**
   * Close HDMI output window
   */
  function closeWindow() {
    stopWindowMonitoring()

    if (windowRef.value) {
      try {
        windowRef.value.close()
      } catch (error) {
        console.error('Error closing HDMI window:', error)
      }
      windowRef.value = null
    }

    isEnabled.value = false
    clear()

    console.log('HDMI output window closed')
  }

  /**
   * Start monitoring window for closure
   */
  function startWindowMonitoring() {
    if (windowCheckInterval.value) {
      clearInterval(windowCheckInterval.value)
    }

    windowCheckInterval.value = setInterval(() => {
      if (windowRef.value && windowRef.value.closed) {
        console.log('HDMI output window was closed externally')
        windowRef.value = null
        isEnabled.value = false
        clear()
        stopWindowMonitoring()
      }
    }, 1000)
  }

  /**
   * Stop monitoring window
   */
  function stopWindowMonitoring() {
    if (windowCheckInterval.value) {
      clearInterval(windowCheckInterval.value)
      windowCheckInterval.value = null
    }
  }

  /**
   * Toggle fullscreen mode
   */
  function toggleFullscreen() {
    if (!windowRef.value || windowRef.value.closed) {
      throw new Error('HDMI window is not open')
    }

    const doc = windowRef.value.document
    if (!doc.fullscreenElement) {
      doc.documentElement.requestFullscreen().catch(err => {
        console.error('Error attempting to enable fullscreen:', err)
        throw new Error(`Failed to enable fullscreen: ${err.message}`)
      })
    } else {
      doc.exitFullscreen()
    }
  }

  // ============================================================================
  // ACTIONS - Display Output
  // ============================================================================

  /**
   * Update HDMI output text
   * @param {string} text - Text to display
   */
  function updateOutput(text) {
    if (!windowRef.value || windowRef.value.closed) {
      console.warn('HDMI window not open, cannot update output')
      return
    }

    const outputDiv = windowRef.value.document.getElementById('output')
    if (!outputDiv) {
      console.error('Output div not found in HDMI window')
      return
    }

    outputDiv.textContent = text || ''

    // Update styling
    outputDiv.parentElement.style.backgroundColor = backgroundColor.value
    outputDiv.style.color = foregroundColor.value
    outputDiv.className = `size-${fontSize.value}`

    previewText.value = text

    console.log('HDMI output updated:', text)
  }

  /**
   * Clear HDMI display
   */
  function clear() {
    console.log('Clearing HDMI display...')

    // Stop all running timers
    stopCountUp()
    stopCountDown()
    stopCoursewalks()

    // Clear all pending auto-clear timers
    if (linkClearTimer.value) {
      clearTimeout(linkClearTimer.value)
      linkClearTimer.value = null
    }

    // Reset output
    if (windowRef.value && !windowRef.value.closed) {
      updateOutput('')
    }

    // Reset state
    previewText.value = ''
    activeLabel.value = 'Idle'
    linkStatus.value = 'Waiting for timer data...'
    textInput.value = ''
    updateCharCounter()

    console.log('HDMI display cleared')
  }

  /**
   * Get color code for text
   * @param {string} colorName - Color name
   * @returns {string} Color hex code
   */
  function getColorHex(colorName) {
    const colorMap = {
      'Default': '#ffffff',
      'Red': '#ff0000',
      'Green': '#00ff00',
      'Yellow': '#ffff00',
      'Blue': '#0000ff',
      'Magenta': '#ff00ff',
      'Cyan': '#00ffff',
      'White': '#ffffff',
      'Orange': '#ff8800',
      'Deep pink': '#ff1493',
      'Light Blue': '#00bfff'
    }
    return colorMap[colorName] || '#ffffff'
  }

  // ============================================================================
  // ACTIONS - Text Module
  // ============================================================================

  /**
   * Update character counter for text input
   */
  function updateCharCounter() {
    charsLeft.value = Math.max(0, 64 - textInput.value.length)
  }

  /**
   * Send text to HDMI display
   */
  function sendText() {
    if (!textEnabled.value) {
      throw new Error('HDMI Text module is disabled')
    }

    if (!windowRef.value || windowRef.value.closed) {
      throw new Error('HDMI output window is not open')
    }

    const text = textInput.value.trim()
    if (!text) {
      throw new Error('Please enter some text')
    }

    // Stop any active modules
    stopCountUp()
    stopCountDown()
    stopCoursewalks()

    // Cancel Timer LINK auto-clear
    if (linkClearTimer.value) {
      clearTimeout(linkClearTimer.value)
      linkClearTimer.value = null
    }

    // Update output
    updateOutput(text)
    activeLabel.value = 'Text'
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
   * Format coursewalk label
   * @param {number} i - Current number
   * @param {number} n - Total number
   * @returns {string} Label
   */
  function cwLabel(i, n) {
    return `${i}/${n}`
  }

  /**
   * Format time as M:SS
   * @param {number} totalSeconds - Total seconds
   * @returns {string} Formatted time
   */
  function cwFormatMSS(totalSeconds) {
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  /**
   * Stop all coursewalk timers
   */
  function stopCoursewalks() {
    cwCancel.value = true
    cwTimers.value.forEach((id) => clearTimeout(id))
    cwTimers.value = []
  }

  /**
   * Run one coursewalk
   * @param {string} label - Coursewalk label
   * @param {number} minutes - Duration in minutes
   */
  async function cwRunOne(label, minutes) {
    if (cwCancel.value) return

    // Show "soon" message
    updateOutput(`${label} soon`)
    previewText.value = `${label} soon`
    activeLabel.value = 'Coursewalks'

    // Wait before starting countdown
    await cwSleep(parseInt(cwWait.value) * 1000)
    if (cwCancel.value) return

    // Countdown
    let seconds = Math.max(0, Math.floor(minutes * 60))
    for (let t = seconds; t >= 1; t--) {
      if (cwCancel.value) return
      const disp = cwFormatMSS(t)
      updateOutput(`${label} ${disp}`)
      previewText.value = `${label} ${disp}`
      await cwSleep(1000)
    }

    if (cwCancel.value) return

    // Show "END" message
    updateOutput(`${label} END`)
    previewText.value = `${label} END`

    // Wait after ending
    await cwSleep(parseInt(cwWait.value) * 1000)
    if (cwCancel.value) return
  }

  /**
   * Run coursewalk sequence
   * @param {number} n - Number of coursewalks
   * @param {number} minutes - Duration per coursewalk in minutes
   */
  async function runCoursewalk(n, minutes) {
    stopCountUp()
    stopCountDown()

    // Cancel Timer LINK auto-clear
    if (linkClearTimer.value) {
      clearTimeout(linkClearTimer.value)
      linkClearTimer.value = null
    }

    cwCancel.value = false
    cwTimers.value = []

    for (let i = 1; i <= n; i++) {
      if (cwCancel.value) break
      const label = cwLabel(i, n)
      await cwRunOne(label, minutes)
    }

    activeLabel.value = 'Idle'
    previewText.value = ''
  }

  /**
   * Start coursewalk
   */
  async function startCoursewalk() {
    if (!windowRef.value || windowRef.value.closed) {
      throw new Error('HDMI output window is not open')
    }

    if (!cwEnabled.value) {
      throw new Error('Coursewalks module is disabled')
    }

    const version = parseInt(cwVersion.value)
    const duration = parseInt(cwDuration.value)

    await runCoursewalk(version, duration)
  }

  // ============================================================================
  // ACTIONS - Countdown Timer Module
  // ============================================================================

  /**
   * Tick for count up timer
   */
  async function tickUp() {
    if (!upTimer.value || !windowRef.value || windowRef.value.closed) return

    const now = performance.now()
    const elapsed = Math.max(0, (now - upStartTs.value) / 1000)
    const mm = Math.floor(elapsed / 60)
    const ss = Math.floor(elapsed % 60)
    const cc = Math.floor((elapsed - Math.floor(elapsed)) * 100)

    const text = mm === 0
      ? `${String(ss).padStart(2, '0')}.${String(cc).padStart(2, '0')}`
      : `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(cc).padStart(2, '0')}`

    updateOutput(text)
    previewText.value = text
    activeLabel.value = 'Timer Up'

    upTimer.value = setTimeout(() => tickUp(), 100)
  }

  /**
   * Stop count up timer
   */
  function stopCountUp() {
    if (upTimer.value) {
      clearTimeout(upTimer.value)
      upTimer.value = null
    }
    if (upClearTimer.value) {
      clearTimeout(upClearTimer.value)
      upClearTimer.value = null
    }
  }

  /**
   * Start count up timer
   */
  async function startCountUp() {
    if (!windowRef.value || windowRef.value.closed) {
      throw new Error('HDMI output window is not open')
    }

    if (!timerEnabled.value) {
      throw new Error('Countdown Timer module is disabled')
    }

    stopCountUp()
    stopCountDown()
    stopCoursewalks()

    // Cancel Timer LINK auto-clear
    if (linkClearTimer.value) {
      clearTimeout(linkClearTimer.value)
      linkClearTimer.value = null
    }

    upStartTs.value = performance.now()
    upTimer.value = setTimeout(() => tickUp(), 10)
  }

  /**
   * Tick for count down timer
   */
  async function tickDown() {
    if (!downTimer.value || !windowRef.value || windowRef.value.closed) return

    const now = performance.now()
    const remainSec = Math.max(0, Math.floor((downEndTs.value - now) / 1000))
    const h = Math.floor(remainSec / 3600)
    const m = Math.floor((remainSec % 3600) / 60)
    const s = remainSec % 60

    const fmt = h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`

    updateOutput(fmt)
    previewText.value = fmt
    activeLabel.value = 'Timer Down'

    if (remainSec <= 0) {
      stopCountDown()
      // Timer completed - auto-clear after configured hold time
      downClearTimer.value = setTimeout(() => {
        clear()
      }, downHold.value * 1000)
    } else {
      downTimer.value = setTimeout(() => tickDown(), 250)
    }
  }

  /**
   * Stop count down timer
   */
  function stopCountDown() {
    if (downTimer.value) {
      clearTimeout(downTimer.value)
      downTimer.value = null
    }
    if (downClearTimer.value) {
      clearTimeout(downClearTimer.value)
      downClearTimer.value = null
    }
  }

  /**
   * Start count down timer
   */
  async function startCountDown() {
    if (!windowRef.value || windowRef.value.closed) {
      throw new Error('HDMI output window is not open')
    }

    if (!timerEnabled.value) {
      throw new Error('Countdown Timer module is disabled')
    }

    stopCountUp()
    stopCountDown()
    stopCoursewalks()

    // Cancel Timer LINK auto-clear
    if (linkClearTimer.value) {
      clearTimeout(linkClearTimer.value)
      linkClearTimer.value = null
    }

    const totalSeconds = downHH.value * 3600 + downMM.value * 60 + downSS.value
    downEndTs.value = performance.now() + totalSeconds * 1000
    downTimer.value = setTimeout(() => tickDown(), 10)
  }

  // ============================================================================
  // ACTIONS - Timer LINK Module
  // ============================================================================

  /**
   * Route timer data to HDMI display
   * @param {string} timeStr - Time string
   * @param {string} state - Timer state ('running' or 'finished')
   */
  async function routeTimerToDisplay(timeStr, state) {
    if (!linkEnabled.value) return
    if (!windowRef.value || windowRef.value.closed) return

    updateOutput(timeStr)
    previewText.value = timeStr

    if (state === 'running') {
      activeLabel.value = 'Timer Link (Running)'
      linkStatus.value = `Routing: ${timeStr} (Running)`

      // Clear any pending auto-clear timer when running
      if (linkClearTimer.value) {
        clearTimeout(linkClearTimer.value)
        linkClearTimer.value = null
      }
    } else if (state === 'finished') {
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
  }

  // ============================================================================
  // WATCHERS - Module Exclusivity
  // ============================================================================

  watch(textEnabled, (newVal, oldVal) => {
    if (isInitializing.value) return

    if (newVal === true && oldVal === false) {
      // Enabling - disable other modules
      cwEnabled.value = false
      timerEnabled.value = false
      linkEnabled.value = false

      // Stop any active timers
      stopCoursewalks()
      stopCountUp()
      stopCountDown()
    }

    if (oldVal === true && newVal === false && windowRef.value) {
      clear()
    }
  })

  watch(cwEnabled, (newVal, oldVal) => {
    if (isInitializing.value) return

    if (newVal === true && oldVal === false) {
      // Enabling - disable other modules
      textEnabled.value = false
      timerEnabled.value = false
      linkEnabled.value = false

      // Stop any active timers
      stopCountUp()
      stopCountDown()
    }

    if (oldVal === true && newVal === false && windowRef.value) {
      stopCoursewalks()
    }
  })

  watch(timerEnabled, (newVal, oldVal) => {
    if (isInitializing.value) return

    if (newVal === true && oldVal === false) {
      // Enabling - disable other modules
      textEnabled.value = false
      cwEnabled.value = false
      linkEnabled.value = false

      // Stop any active modules
      stopCoursewalks()
    }

    if (oldVal === true && newVal === false && windowRef.value) {
      stopCountUp()
      stopCountDown()
    }
  })

  watch(linkEnabled, (newVal, oldVal) => {
    if (isInitializing.value) return

    if (newVal === true && oldVal === false) {
      // Enabling - disable other modules
      textEnabled.value = false
      cwEnabled.value = false
      timerEnabled.value = false

      // Stop any active modules
      stopCoursewalks()
      stopCountUp()
      stopCountDown()
    }

    if (oldVal === true && newVal === false && windowRef.value) {
      linkStatus.value = 'Waiting for timer data...'
    }
  })

  // Auto-update window styling when settings change
  watch(backgroundColor, () => {
    if (!isInitializing.value && windowRef.value && !windowRef.value.closed) {
      const body = windowRef.value.document.body
      if (body) {
        body.style.backgroundColor = backgroundColor.value
      }
    }
    persistSettings()
  })

  watch(foregroundColor, () => {
    if (!isInitializing.value && windowRef.value && !windowRef.value.closed) {
      const outputDiv = windowRef.value.document.getElementById('output')
      if (outputDiv) {
        outputDiv.style.color = foregroundColor.value
      }
    }
    persistSettings()
  })

  watch(fontSize, () => {
    if (!isInitializing.value && windowRef.value && !windowRef.value.closed) {
      const outputDiv = windowRef.value.document.getElementById('output')
      if (outputDiv) {
        outputDiv.className = `size-${fontSize.value}`
      }
    }
    persistSettings()
  })

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Cleanup function for when store is destroyed
   */
  function cleanup() {
    stopCountUp()
    stopCountDown()
    stopCoursewalks()
    stopWindowMonitoring()

    if (linkClearTimer.value) {
      clearTimeout(linkClearTimer.value)
    }

    if (windowRef.value) {
      try {
        windowRef.value.close()
      } catch (error) {
        console.error('Error closing HDMI window during cleanup:', error)
      }
    }
  }

  // ============================================================================
  // RETURN PUBLIC API
  // ============================================================================

  return {
    // State
    isEnabled,
    windowRef,

    // Display settings
    backgroundColor,
    foregroundColor,
    fontSize,
    previewText,
    activeLabel,

    // Text module
    textEnabled,
    textInput,
    textColor,
    charsLeft,

    // Coursewalks module
    cwEnabled,
    cwVersion,
    cwDuration,
    cwWait,

    // Countdown Timer module
    timerEnabled,
    upColor,
    downColor,
    downHH,
    downMM,
    downSS,
    downHold,

    // Timer LINK module
    linkEnabled,
    linkColor,
    linkHold,
    linkStatus,

    // Computed
    connectionStatus,
    isWindowOpen,

    // Actions - Window Management
    initialize,
    persistSettings,
    openWindow,
    closeWindow,
    toggleFullscreen,

    // Actions - Display
    updateOutput,
    clear,

    // Actions - Text Module
    updateCharCounter,
    sendText,

    // Actions - Coursewalks Module
    startCoursewalk,
    stopCoursewalks,

    // Actions - Countdown Timer Module
    startCountUp,
    stopCountUp,
    startCountDown,
    stopCountDown,

    // Actions - Timer LINK Module
    routeTimerToDisplay,

    // Cleanup
    cleanup,
  }
})

export default useHdmiStore
