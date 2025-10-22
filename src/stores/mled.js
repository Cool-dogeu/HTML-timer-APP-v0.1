/**
 * MLED Store - Manages LED display connections and modules
 * Handles MLED connection, text display, coursewalks, countdown timers, timer link, and data integrator
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { MledSerialManager } from '@services/serial/MledSerialManager'
import { getDeviceInfo } from '@services/serial/deviceHelpers'
import { saveMledSettings, loadMledSettings } from '@services/storage/LocalStorageService'
import { useTimerStore } from './timer'
import { useSettingsStore } from './settings'

export const useMledStore = defineStore('mled', () => {
  // ============================================================================
  // STATE
  // ============================================================================

  // Connection state
  const isConnected = ref(false)
  const manager = ref(null)
  const port = ref(null)
  const deviceInfo = ref(null)

  // Display settings
  const line = ref(7) // Main display line
  const brightness = ref(1)
  const previewText = ref('')
  const activeLabel = ref('Idle')
  const lastPayload = ref('')

  // Text module
  const textEnabled = ref(false)
  const textInput = ref('')
  const textColor = ref('Default')
  const scrollSpeed = ref('0')
  const rainbow = ref(false)
  const charsLeft = ref(64)

  // Scroll state
  const scrollJob = ref(null)
  const scrollBuf = ref('')
  const scrollDelay = ref(550)
  const scrollColor = ref(0)
  const scrollLen = ref(0)
  const scrollIdx = ref(0)
  const scrollRainbow = ref(false)
  const rainbowIdx = ref(0)
  const rainbowColors = ref([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) // Red, Green, Yellow, Blue, Magenta, Cyan, White, Orange, Deep pink, Light Blue

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

  // Count Down
  const downColor = ref('Red')
  const downHH = ref(0)
  const downMM = ref(10)
  const downSS = ref(0)
  const downTimer = ref(null)
  const downEndTs = ref(0)
  const downColorCode = ref(1)
  const downHold = ref(10) // Hold time in seconds after countdown reaches 0
  const downClearTimer = ref(null)

  // Timer LINK module
  const linkEnabled = ref(false)
  const linkToMled = ref(true)
  const linkLine = ref(7)
  const linkColor = ref('Green')
  const linkHold = ref(7) // Hold time in seconds after timer stops
  const linkStatus = ref('Waiting for timer data...')
  const linkLastUpdate = ref(0)
  const linkClearTimer = ref(null)

  // Data Integrator module
  const dataEnabled = ref(false)
  const dataSource = ref('url')
  const dataFileHandle = ref(null)
  const dataUrl = ref('https://www.smarteragilitysecretary.com/api/ring-jumbotron?key=38-1&token=b9d6ea8054ab28ebf82d6b38dfaae74479764c91852dac2250b63b08bb659d54')
  const dataAutoUpdate = ref(false)
  const dataUpdateInterval = ref(null)
  const dataStatus = ref('No data loaded')
  const dataPollTimer = ref(null)

  // Data fields
  const dataDorsal = ref('')
  const dataHandler = ref('')
  const dataDog = ref('')
  const dataCountry = ref('')
  const dataFaults = ref(0)
  const dataRefusals = ref(0)
  const dataElim = ref(false)

  // Data line assignments
  const dataLine1 = ref(1)
  const dataLine2 = ref(2)
  const dataLine3 = ref(3)
  const dataLine4 = ref(4)
  const dataLast = ref({ z1: '', z2: '', z3: '', z4: '' })

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
   * Initialize MLED store
   */
  function initialize() {
    console.log('Initializing MLED store...')

    // Load settings
    const settings = loadMledSettings()
    if (settings) {
      // Display settings
      if (settings.line !== undefined) line.value = settings.line
      if (settings.brightness !== undefined) brightness.value = settings.brightness

      // Text module
      if (settings.textColor !== undefined) textColor.value = settings.textColor
      if (settings.scrollSpeed !== undefined) scrollSpeed.value = settings.scrollSpeed
      if (settings.rainbow !== undefined) rainbow.value = settings.rainbow

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
      if (settings.linkLine !== undefined) linkLine.value = settings.linkLine
      if (settings.linkHold !== undefined) linkHold.value = settings.linkHold

      // Data Integrator module
      if (settings.dataUrl !== undefined) dataUrl.value = settings.dataUrl
      if (settings.dataLine1 !== undefined) dataLine1.value = settings.dataLine1
      if (settings.dataLine2 !== undefined) dataLine2.value = settings.dataLine2
      if (settings.dataLine3 !== undefined) dataLine3.value = settings.dataLine3
      if (settings.dataLine4 !== undefined) dataLine4.value = settings.dataLine4

      // Restore enabled states
      if (settings.dataEnabled === true) dataEnabled.value = true
    }

    isInitializing.value = false
    console.log('MLED store initialized')
  }

  /**
   * Persist MLED settings to localStorage
   */
  function persistSettings() {
    const settings = {
      line: line.value,
      brightness: brightness.value,
      textColor: textColor.value,
      scrollSpeed: scrollSpeed.value,
      rainbow: rainbow.value,
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
      linkLine: linkLine.value,
      linkHold: linkHold.value,
      dataUrl: dataUrl.value,
      dataLine1: dataLine1.value,
      dataLine2: dataLine2.value,
      dataLine3: dataLine3.value,
      dataLine4: dataLine4.value,
    }

    // Save enabled states if true
    if (dataEnabled.value) settings.dataEnabled = true

    saveMledSettings(settings)
    console.log('MLED settings saved')
  }

  /**
   * Connect to MLED display
   */
  async function connect() {
    try {
      // Request port from user
      const requestedPort = await navigator.serial.requestPort()

      // Get device info
      deviceInfo.value = getDeviceInfo(requestedPort)
      port.value = requestedPort

      // Create manager instance
      manager.value = new MledSerialManager()

      // Set up callbacks
      manager.value.onConnectionChange = handleConnectionChange

      // Connect
      await manager.value.connect(requestedPort)

      isConnected.value = true

      // Save device info
      localStorage.setItem('mledDeviceInfo', JSON.stringify(deviceInfo.value))

      console.log('MLED connected successfully')

      // Send welcome message
      await sendFrame(line.value, brightness.value, '^cs 2^FDS MLED^cs 0^')

      // Clear after 1 second and restore last payload
      setTimeout(async () => {
        if (isConnected.value) {
          await sendFrame(line.value, brightness.value, '')
          if (lastPayload.value) {
            console.log('Restoring last MLED display state...')
            await sendFrame(line.value, brightness.value, lastPayload.value)
          }
        }
      }, 1000)
    } catch (error) {
      console.error('MLED connection failed:', error)
      throw error
    }
  }

  /**
   * Disconnect from MLED display
   */
  async function disconnect() {
    if (manager.value) {
      try {
        await manager.value.disconnect()
      } catch (error) {
        console.error('MLED disconnect error:', error)
      }
    }

    isConnected.value = false
    port.value = null
    deviceInfo.value = null
    manager.value = null

    localStorage.removeItem('mledDeviceInfo')

    console.log('MLED disconnected')
  }

  /**
   * Auto-reconnect to previously authorized MLED port
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
      const savedDeviceInfo = localStorage.getItem('mledDeviceInfo')
      if (!savedDeviceInfo) {
        return false
      }

      const savedInfo = JSON.parse(savedDeviceInfo)

      // Find matching port
      for (const p of ports) {
        const info = getDeviceInfo(p)
        if (info.vendorId === savedInfo.vendorId && info.productId === savedInfo.productId) {
          console.log('Found MLED device, attempting auto-reconnect...')

          manager.value = new MledSerialManager()
          manager.value.onConnectionChange = handleConnectionChange

          await manager.value.connect(p)

          port.value = p
          deviceInfo.value = info
          isConnected.value = true

          console.log('MLED auto-reconnected successfully')

          // Send welcome message
          await sendFrame(line.value, brightness.value, '^cs 2^FDS MLED^cs 0^')
          setTimeout(async () => {
            if (isConnected.value) {
              await sendFrame(line.value, brightness.value, '')
              if (lastPayload.value) {
                await sendFrame(line.value, brightness.value, lastPayload.value)
              }
            }
          }, 1000)

          return true
        }
      }
    } catch (error) {
      console.error('MLED auto-reconnect failed:', error)
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
      console.log('MLED connection lost')
    }
  }

  // ============================================================================
  // ACTIONS - Display Communication
  // ============================================================================

  /**
   * Send frame to MLED display
   * @param {number} lineNum - Line number
   * @param {number} bright - Brightness level
   * @param {string} payload - Text payload
   */
  async function sendFrame(lineNum, bright, payload) {
    if (!isConnected.value || !manager.value) {
      console.warn('MLED not connected, cannot send frame')
      return
    }

    try {
      await manager.value.sendFrame(lineNum, bright, payload)

      // Update last payload for main line
      if (lineNum === line.value) {
        lastPayload.value = payload
      }
    } catch (error) {
      console.error('MLED send frame error:', error)
      throw error
    }
  }

  /**
   * Get color code for MLED
   * @param {string} colorName - Color name
   * @returns {number} Color code
   */
  function getColorCode(colorName) {
    const colorMap = {
      'Default': 0,
      'Red': 1,
      'Green': 2,
      'Yellow': 3,
      'Blue': 4,
      'Magenta': 5,
      'Cyan': 6,
      'White': 7,
      'Orange': 8,
      'Deep pink': 9,
      'Light Blue': 10
    }
    return colorMap[colorName] || 0
  }

  /**
   * Sanitize text for MLED display (remove special characters)
   * @param {string} text - Input text
   * @returns {string} Sanitized text
   */
  function sanitizeText(text) {
    return text.replace(/[^\x20-\x7E]/g, '') // Only ASCII printable characters
  }

  /**
   * Set brightness level and immediately update display
   * @param {number} level - Brightness level (1-3)
   */
  async function setBrightness(level) {
    if (level < 1 || level > 3) {
      console.warn('Invalid brightness level:', level)
      return
    }

    brightness.value = level
    console.log('MLED brightness set to:', level)

    // Persist settings
    persistSettings()

    // Immediately resend current display with new brightness
    if (isConnected.value) {
      // Resend main line payload if it exists
      if (lastPayload.value) {
        console.log('Resending main line with new brightness:', level)
        await sendFrame(line.value, level, lastPayload.value)
      }

      // Resend Data Integrator zones if active
      if (dataEnabled.value && dataLast.value) {
        console.log('Resending Data Integrator zones with new brightness:', level)

        // Z1: Dorsal
        if (dataLast.value.z1 && dataDorsal.value) {
          const dorsal = dataDorsal.value.replace(/\D/g, '').slice(0, 3).padStart(3, '0')
          const payload1 = `^cp 1 4 7^${dorsal}`
          await sendFrame(dataLine1.value, level, payload1)
        }

        // Z2: Handler + Dog
        if (dataLast.value.z2 && (dataHandler.value || dataDog.value)) {
          const handler = sanitizeText(dataHandler.value)
          const dog = sanitizeText(dataDog.value)

          let payload2 = ''
          if (handler || dog) {
            const hl = handler.length + 1
            const dl = dog.length
            payload2 = `^cp 1 ${hl} 7^${handler} ^cp ${hl} ${hl + dl} 8^${dog}`
            if (payload2.length > 64) {
              payload2 = `^cs 7^${handler.slice(0, 58)}`
            }
          }

          if (payload2) {
            await sendFrame(dataLine2.value, level, payload2)
          }
        }

        // Z3: Faults/Refusals/Elim
        if (dataLast.value.z3) {
          let payload3 = ''
          const f = dataFaults.value
          let r = dataRefusals.value

          if (!Number.isInteger(r) || r < 0) r = 0
          if (r > 3) r = 3

          if (dataElim.value) {
            payload3 = '^fd 5 1^^cp 1 10 1^  DIS^ic 3 1 2^^ic 3 1 11^'
          } else {
            const fd = (!f) ? '^cp 1 2 2^ F^ic 3 2^^cp 3 5 2^' : `^cp 1 3 1^ F${f} `
            const rd = (!r) ? '^cp 4 5 2^R^ic 3 2^' : `^cp 5 9 1^R${r}`
            payload3 = fd + rd
          }

          await sendFrame(dataLine3.value, level, payload3)
        }

        // Z4: Country
        if (dataLast.value.z4 && dataCountry.value) {
          const country = sanitizeText(dataCountry.value)
          const payload4 = country ? `^cp 1 3 7^${country}` : '^cp 1 3 7^'
          await sendFrame(dataLine4.value, level, payload4)
        }
      }
    }
  }

  /**
   * Clear MLED display
   */
  async function clear() {
    if (!isConnected.value) {
      throw new Error('MLED not connected')
    }

    console.log('Clearing MLED display...')

    // Stop auto-update FIRST to prevent it from refilling data
    if (dataAutoUpdate.value) {
      console.log('Stopping auto-update...')
      toggleDataAutoUpdate()
    }

    // Stop any active modules
    stopScroll()
    stopCoursewalks()
    stopCountUp()
    stopCountDown()

    // Cancel Timer LINK auto-clear
    if (linkClearTimer.value) {
      clearTimeout(linkClearTimer.value)
      linkClearTimer.value = null
    }

    // Clear main line
    await sendFrame(line.value, brightness.value, ' ')

    // Clear Data Integrator fields
    dataDorsal.value = ''
    dataHandler.value = ''
    dataDog.value = ''
    dataCountry.value = ''
    dataFaults.value = 0
    dataRefusals.value = 0
    dataElim.value = false
    dataLast.value = { z1: '', z2: '', z3: '', z4: '' }

    // Clear Data Integrator lines
    await sendFrame(dataLine1.value, brightness.value, ' ')
    await sendFrame(dataLine2.value, brightness.value, ' ')
    await sendFrame(dataLine3.value, brightness.value, ' ')
    await sendFrame(dataLine4.value, brightness.value, ' ')

    // Reset state
    lastPayload.value = ''
    previewText.value = ''
    activeLabel.value = 'Idle'
    textInput.value = ''
    updateCharCounter()

    console.log('MLED display cleared')
  }

  // ============================================================================
  // ACTIONS - Text Module
  // ============================================================================

  /**
   * Update character counter for text input
   */
  function updateCharCounter() {
    const text = sanitizeText(textInput.value)
    const colorCode = getColorCode(textColor.value)
    const colorOverhead = 12
    const maxLength = 64 - colorOverhead
    charsLeft.value = Math.max(0, maxLength - text.length)
  }

  /**
   * Get next rainbow color
   * @returns {number} Color code
   */
  function getNextRainbowColor() {
    const color = rainbowColors.value[rainbowIdx.value]
    rainbowIdx.value = (rainbowIdx.value + 1) % rainbowColors.value.length
    return color
  }

  /**
   * Send text once (no scrolling)
   * @param {string} text - Text to send
   * @param {number|null} colorCodeOverride - Optional color code override
   */
  async function sendTextOnce(text, colorCodeOverride = null) {
    const sanitized = sanitizeText(text)
    const colorCode = colorCodeOverride !== null
      ? colorCodeOverride
      : getColorCode(textColor.value)

    const colorOverhead = 12
    const maxLength = 64 - colorOverhead
    const truncated = sanitized.length > maxLength
      ? sanitized.slice(0, maxLength)
      : sanitized

    const payload = `^cs ${colorCode}^${truncated}^cs 0^`
    await sendFrame(line.value, brightness.value, payload)
    previewText.value = truncated
  }

  /**
   * Scroll step callback - matches displayold/index.html implementation
   */
  async function scrollStep() {
    if (!scrollBuf.value) return

    // Rotate buffer (move first char to end)
    scrollBuf.value = scrollBuf.value.slice(1) + scrollBuf.value[0]

    // Get chunk to display (as much as fits with color overhead)
    const colorOverhead = 12
    const maxLength = 64 - colorOverhead
    const chunk = scrollBuf.value.slice(0, maxLength)

    // Update rainbow color if needed
    scrollIdx.value = (scrollIdx.value + 1) % scrollLen.value
    if (scrollRainbow.value && scrollIdx.value === 0) {
      scrollColor.value = getNextRainbowColor()
    }

    // Send to display
    await sendTextOnce(chunk, scrollColor.value)

    // Schedule next step
    console.log('scrollStep: using delay =', scrollDelay.value, 'ms')
    scrollJob.value = setTimeout(() => scrollStep(), scrollDelay.value)
  }

  /**
   * Start scrolling text
   * @param {string} text - Text to scroll
   * @param {number|null} colorCodeOverride - Optional color code override
   * @param {boolean} rainbowCycle - Use rainbow color cycling
   */
  async function startScroll(text, colorCodeOverride = null, rainbowCycle = false) {
    stopScroll()

    const sanitized = sanitizeText(text)
    const colorCode = colorCodeOverride !== null
      ? colorCodeOverride
      : getColorCode(textColor.value)

    const colorOverhead = 12
    const maxLength = 64 - colorOverhead
    const truncated = sanitized.length > maxLength
      ? sanitized.slice(0, maxLength)
      : sanitized

    scrollBuf.value = truncated + '   ' // Add spacing

    const speed = parseInt(scrollSpeed.value)
    const delays = { 1: 550, 2: 350, 3: 220 }
    scrollDelay.value = delays[speed] || 550

    console.log('startScroll: scrollSpeed.value =', scrollSpeed.value, ', parsed speed =', speed, ', delay =', scrollDelay.value, 'ms')

    scrollColor.value = colorCode
    scrollLen.value = scrollBuf.value.length
    scrollIdx.value = 0
    scrollRainbow.value = rainbowCycle

    // If speed 0, just send once without scrolling
    if (speed === 0) {
      console.log('startScroll: speed is 0, sending text once without scrolling')
      await sendTextOnce(truncated, colorCode)
      return
    }

    console.log('startScroll: starting scroll animation')
    activeLabel.value = 'Scrolling'
    scrollStep()
  }

  /**
   * Stop scrolling text
   */
  function stopScroll() {
    if (scrollJob.value) {
      clearTimeout(scrollJob.value)
      scrollJob.value = null
    }
    scrollBuf.value = '' // Clear buffer to stop scrollStep guard check
  }

  /**
   * Send text to MLED display
   */
  async function sendText() {
    if (!isConnected.value) {
      throw new Error('MLED not connected')
    }

    if (!textEnabled.value) {
      throw new Error('MLED Text module is disabled')
    }

    let text = textInput.value
    if (!text) {
      throw new Error('Empty text')
    }

    stopScroll()
    stopCountUp()
    stopCountDown()

    // Cancel Timer LINK auto-clear
    if (linkClearTimer.value) {
      clearTimeout(linkClearTimer.value)
      linkClearTimer.value = null
    }

    // Rainbow mode
    if (rainbow.value) {
      const nextColor = getNextRainbowColor()
      if (text.length >= 9) {
        // Long text: start scrolling with rainbow
        await startScroll(text, nextColor, true)
      } else {
        // Short text: send once with next rainbow color
        await sendTextOnce(text, nextColor)
        activeLabel.value = 'Text'
      }
      return
    }

    // Normal mode (no rainbow)
    const speed = parseInt(scrollSpeed.value)
    if (speed > 0) {
      // Scrolling enabled
      await startScroll(text)
    } else {
      // No scrolling
      await sendTextOnce(text)
      activeLabel.value = 'Text'
    }
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
   * Create dual color payload
   * @param {string} leftText - Left text
   * @param {number} leftCode - Left color code
   * @param {string} rightText - Right text
   * @param {number} rightCode - Right color code
   * @returns {string} Payload
   */
  function cwDualColor(leftText, leftCode, rightText, rightCode) {
    return `^cs ${leftCode}^${leftText}^cs 0^ ^cs ${rightCode}^${rightText}^cs 0^`
  }

  /**
   * Create mixed color payload
   * @param {string} label - Label text
   * @param {string} num - Number text
   * @param {number} labelCode - Label color code
   * @param {number} numCode - Number color code
   * @returns {string} Payload
   */
  function cwMixColor(label, num, labelCode, numCode) {
    return `^cs ${labelCode}^${label}^cs 0^ ^cs ${numCode}^${num}^cs 0^`
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
    const soonPayload = cwDualColor(label, 3, 'soon', 2)
    await sendFrame(line.value, brightness.value, soonPayload)
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
      const payload = cwMixColor(label, disp, 3, 9)
      await sendFrame(line.value, brightness.value, payload)
      previewText.value = `${label} ${disp}`
      await cwSleep(1000)
    }

    if (cwCancel.value) return

    // Show "END" message
    const endPayload = cwDualColor(label, 3, 'END', 1)
    await sendFrame(line.value, brightness.value, endPayload)
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
    stopScroll()
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
    if (!isConnected.value) {
      throw new Error('MLED not connected')
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
    if (!upTimer.value) return

    const now = performance.now()
    const elapsed = Math.max(0, (now - upStartTs.value) / 1000)
    const mm = Math.floor(elapsed / 60)
    const ss = Math.floor(elapsed % 60)
    const cc = Math.floor((elapsed - Math.floor(elapsed)) * 100)

    const text = mm === 0
      ? `${String(ss).padStart(2, '0')}.${String(cc).padStart(2, '0')}`
      : `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(cc).padStart(2, '0')}`

    const colorCode = getColorCode(upColor.value)
    const payload = `^cs ${colorCode}^${text}^cs 0^`

    try {
      await sendFrame(line.value, brightness.value, payload)
      previewText.value = text
      activeLabel.value = 'Timer Up'
    } catch (error) {
      console.error('Count up tick error:', error)
      stopCountUp()
      return
    }

    upTimer.value = setTimeout(() => tickUp(), 100)
  }

  /**
   * Stop count up timer
   */
  function stopCountUp() {
    if (upTimer.value) {
      clearTimeout(upTimer.value)
      upTimer.value = null

      // Auto-clear after 30 seconds
      setTimeout(async () => {
        if (!upTimer.value) { // Only if still stopped
          try {
            await sendFrame(line.value, brightness.value, ' ')
            previewText.value = ''
            activeLabel.value = 'Idle'
          } catch (error) {
            console.error('Auto-clear error:', error)
          }
        }
      }, 30000)
    }
  }

  /**
   * Start count up timer
   */
  async function startCountUp() {
    if (!isConnected.value) {
      throw new Error('MLED not connected')
    }

    if (!timerEnabled.value) {
      throw new Error('Countdown Timer module is disabled')
    }

    stopCountUp()
    stopCountDown()
    stopScroll()
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
    if (!downTimer.value) return

    const now = performance.now()
    const remainSec = Math.max(0, Math.floor((downEndTs.value - now) / 1000))
    const h = Math.floor(remainSec / 3600)
    const m = Math.floor((remainSec % 3600) / 60)
    const s = remainSec % 60

    const fmt = h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`

    const payload = `^cs ${downColorCode.value}^${fmt}^cs 0^`

    try {
      await sendFrame(line.value, brightness.value, payload)
      previewText.value = fmt
      activeLabel.value = 'Timer Down'
    } catch (error) {
      console.error('Count down tick error:', error)
      stopCountDown()
      return
    }

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
    if (!isConnected.value) {
      throw new Error('MLED not connected')
    }

    if (!timerEnabled.value) {
      throw new Error('Countdown Timer module is disabled')
    }

    stopCountUp()
    stopCountDown()
    stopScroll()
    stopCoursewalks()

    // Cancel Timer LINK auto-clear
    if (linkClearTimer.value) {
      clearTimeout(linkClearTimer.value)
      linkClearTimer.value = null
    }

    const totalSeconds = downHH.value * 3600 + downMM.value * 60 + downSS.value
    downEndTs.value = performance.now() + totalSeconds * 1000
    downColorCode.value = getColorCode(downColor.value)
    downTimer.value = setTimeout(() => tickDown(), 10)
  }

  // ============================================================================
  // ACTIONS - Timer LINK Module
  // ============================================================================

  /**
   * Route timer data to MLED display
   * @param {string} timeStr - Time string
   * @param {string} state - Timer state ('running' or 'finished')
   */
  async function routeTimerToDisplay(timeStr, state) {
    if (!linkEnabled.value || !linkToMled.value) return
    if (!isConnected.value) return

    const colorCode = getColorCode(linkColor.value)
    const payload = `^cs ${colorCode}^${timeStr}^cs 0^`

    try {
      await sendFrame(linkLine.value, brightness.value, payload)
      previewText.value = timeStr

      if (state === 'running') {
        activeLabel.value = 'Timer Link (Running)'
        linkStatus.value = `Routing: ${timeStr} (Running)`
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
    } catch (error) {
      console.error('Timer LINK routing error:', error)
    }
  }

  // ============================================================================
  // ACTIONS - Data Integrator Module
  // ============================================================================

  /**
   * Transform external URLs to use proxy
   * @param {string} url - Original URL
   * @returns {string} Proxied URL
   */
  function transformToProxiedUrl(url) {
    if (url.includes('smarteragilitysecretary.com/api/ring-jumbotron')) {
      const urlObj = new URL(url)
      const queryString = urlObj.search
      return `/api/ring-jumbotron${queryString}`
    }
    return url
  }

  /**
   * Fetch JSON data from URL
   */
  async function fetchJsonData() {
    if (!dataUrl.value) {
      dataStatus.value = 'No URL provided'
      return
    }

    try {
      const fetchUrl = transformToProxiedUrl(dataUrl.value)
      console.log('Fetching from:', fetchUrl)

      const response = await fetch(fetchUrl)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const json = await response.json()
      console.log('Fetched raw JSON:', json)

      // The API returns currentRunResult and currentRun (SAS_reader.py lines 74-96)
      const currentRunResult = (json && json.currentRunResult) ? json.currentRunResult : {}
      const currentRun = (json && json.currentRun) ? json.currentRun : {}

      // Check running flag - determines which object to use
      const runningFlag = String(currentRunResult.running || '0').trim() === '1' ||
                          currentRunResult.running === true ||
                          currentRunResult.running === 1

      console.log('Running flag:', runningFlag)

      let obj
      if (runningFlag && currentRunResult && Object.keys(currentRunResult).length > 0) {
        // RUNNING - use currentRunResult (SAS_reader.py lines 80-87)
        obj = currentRunResult
        console.log('Using currentRunResult (running):', obj)

        dataDorsal.value = (obj.dorsal || '').toString()
        dataHandler.value = (obj.handler || '').toString()
        dataDog.value = (obj.dog_call_name || obj.dog || '').toString()
        dataCountry.value = (obj.country || '').toString()

        // Use 'faults' or 'course_faults' from API
        dataFaults.value = Number.isFinite(obj.faults) ? obj.faults :
                           Number.isFinite(obj.course_faults) ? obj.course_faults :
                           (obj.faults == null ? 0 : Number(obj.faults) || 0)
        dataRefusals.value = Number.isFinite(obj.refusals) ? obj.refusals : (obj.refusals == null ? 0 : Number(obj.refusals) || 0)

        // Use 'is_eliminated' from API
        dataElim.value = !!(obj.is_eliminated === true || obj.is_eliminated === 1 || String(obj.is_eliminated).trim() === '1')
      } else if (currentRun && Object.keys(currentRun).length > 0) {
        // NOT RUNNING - use currentRun (SAS_reader.py lines 89-96)
        obj = currentRun
        console.log('Using currentRun (not running):', obj)

        dataDorsal.value = (obj.dorsal || '').toString()
        dataHandler.value = (obj.handler || '').toString()
        dataDog.value = (obj.dog || '').toString()
        dataCountry.value = (obj.country_name || obj.country || '').toString()

        // No faults/refusals/elimination when not running
        dataFaults.value = 0
        dataRefusals.value = 0
        dataElim.value = false
      } else {
        dataStatus.value = 'No currentRunResult or currentRun found in JSON'
        console.warn('No valid data found in JSON:', json)
        return
      }

      console.log('Parsed data:', {
        source: runningFlag ? 'currentRunResult' : 'currentRun',
        dorsal: dataDorsal.value,
        handler: dataHandler.value,
        dog: dataDog.value,
        country: dataCountry.value,
        faults: dataFaults.value,
        refusals: dataRefusals.value,
        elim: dataElim.value
      })

      // Auto-send if changed
      await autoSendDataIfChanged()

      const ts = new Date().toLocaleTimeString()
      const source = runningFlag ? 'Running' : 'Waiting'
      dataStatus.value = `OK ${ts} [${source}] - ${dataHandler.value} / ${dataDog.value} - F:${dataFaults.value} R:${dataRefusals.value}`
    } catch (error) {
      console.error('JSON fetch error:', error)
      dataStatus.value = `Error: ${error.message}`
    }
  }

  /**
   * Auto-send data to display if it has changed
   */
  async function autoSendDataIfChanged() {
    if (!dataEnabled.value || !isConnected.value) return

    // Build current zone strings
    const z1 = dataDorsal.value ? dataDorsal.value.replace(/\D/g, '').slice(0, 3).padStart(3, '0') : ''

    // Z2: handler + dog with exact format matching displayold/index.html
    const z2Handler = sanitizeText(dataHandler.value)
    const z2Dog = sanitizeText(dataDog.value)
    let z2 = ''
    if (z2Handler || z2Dog) {
      const hl = z2Handler.length + 1
      const dl = z2Dog.length
      z2 = `^cp 1 ${hl} 7^${z2Handler} ^cp ${hl} ${hl + dl} 8^${z2Dog}`
      if (z2.length > 64) {
        z2 = `^cs 7^${z2Handler.slice(0, 58)}`
      }
    }

    // Z3: faults/refusals/elimination with exact format matching displayold/index.html
    const f = dataFaults.value
    let r = dataRefusals.value
    if (!Number.isInteger(r) || r < 0) r = 0
    if (r > 3) r = 3

    let z3 = ''
    if (dataElim.value) {
      z3 = '^fd 5 1^^cp 1 10 1^  DIS^ic 3 1 2^^ic 3 1 11^'
    } else {
      const fd = (!f) ? '^cp 1 2 2^ F^ic 3 2^^cp 3 5 2^' : `^cp 1 3 1^ F${f} `
      const rd = (!r) ? '^cp 4 5 2^R^ic 3 2^' : `^cp 5 9 1^R${r}`
      z3 = fd + rd
    }

    // Z4: country with exact format matching displayold/index.html
    const z4Country = sanitizeText(dataCountry.value)
    const z4 = z4Country ? `^cp 1 3 7^${z4Country}` : '^cp 1 3 7^'

    // Check if changed
    const changed = z1 !== dataLast.value.z1 ||
                    z2 !== dataLast.value.z2 ||
                    z3 !== dataLast.value.z3 ||
                    z4 !== dataLast.value.z4

    if (!changed) return

    console.log('Data changed, sending to MLED...')

    // Send to display
    if (z1 && dataDorsal.value) {
      const dorsal = dataDorsal.value.replace(/\D/g, '').slice(0, 3).padStart(3, '0')
      const payload1 = `^cp 1 4 7^${dorsal}`
      await sendFrame(dataLine1.value, brightness.value, payload1)
    }

    if (z2 && (dataHandler.value || dataDog.value)) {
      const handler = sanitizeText(dataHandler.value)
      const dog = sanitizeText(dataDog.value)

      let payload2 = ''
      if (handler || dog) {
        const hl = handler.length + 1
        const dl = dog.length
        // Format: handler in color 7 (white), dog in color 8 (orange)
        payload2 = `^cp 1 ${hl} 7^${handler} ^cp ${hl} ${hl + dl} 8^${dog}`

        // If too long, just show handler truncated
        if (payload2.length > 64) {
          payload2 = `^cs 7^${handler.slice(0, 58)}`
        }
      }

      // Clear line first, then send payload
      await sendFrame(dataLine2.value, brightness.value, '')
      if (payload2) {
        await sendFrame(dataLine2.value, brightness.value, payload2)
      }
    }

    if (z3) {
      let payload3 = ''
      const f = dataFaults.value
      let r = dataRefusals.value

      if (!Number.isInteger(r) || r < 0) r = 0
      if (r > 3) {
        r = 3
        dataRefusals.value = 3
      }

      if (dataElim.value) {
        // When eliminated, show "DIS" with special formatting
        payload3 = '^fd 5 1^^cp 1 10 1^  DIS^ic 3 1 2^^ic 3 1 11^'
      } else {
        // Format: F in color 2 (green) if 0, color 1 (red) if faults
        //         R in color 2 (green) if 0, color 1 (red) if refusals
        const fd = (!f) ? '^cp 1 2 2^ F^ic 3 2^^cp 3 5 2^' : `^cp 1 3 1^ F${f} `
        const rd = (!r) ? '^cp 4 5 2^R^ic 3 2^' : `^cp 5 9 1^R${r}`
        payload3 = fd + rd
      }

      await sendFrame(dataLine3.value, brightness.value, payload3)
    }

    if (z4 && dataCountry.value) {
      const country = sanitizeText(dataCountry.value)

      // Clear line first, then send payload (matches displayold/index.html)
      await sendFrame(dataLine4.value, brightness.value, '')
      const payload4 = country ? `^cp 1 3 7^${country}` : '^cp 1 3 7^'
      await sendFrame(dataLine4.value, brightness.value, payload4)
    }

    // Update last sent
    dataLast.value = { z1, z2, z3, z4 }
  }

  /**
   * Toggle auto-update for Data Integrator
   */
  function toggleDataAutoUpdate() {
    if (dataAutoUpdate.value) {
      // Stop auto-update
      dataAutoUpdate.value = false
      if (dataUpdateInterval.value) {
        clearInterval(dataUpdateInterval.value)
        dataUpdateInterval.value = null
      }
      dataStatus.value = 'Auto-update stopped'
    } else {
      // Start auto-update
      dataAutoUpdate.value = true
      fetchJsonData() // Fetch immediately
      dataUpdateInterval.value = setInterval(() => {
        fetchJsonData()
      }, 1000) // Update every 1 second
      dataStatus.value = 'Auto-update started (1s interval)'
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
      dataEnabled.value = false

      // Stop any active timers/scrolling
      stopCoursewalks()
      stopCountUp()
      stopCountDown()
    }

    if (oldVal === true && newVal === false && isConnected.value) {
      stopScroll()
    }
  })

  watch(cwEnabled, (newVal, oldVal) => {
    if (isInitializing.value) return

    if (newVal === true && oldVal === false) {
      // Enabling - disable other modules
      textEnabled.value = false
      timerEnabled.value = false
      linkEnabled.value = false
      dataEnabled.value = false

      // Stop any active timers/scrolling
      stopScroll()
      stopCountUp()
      stopCountDown()
    }

    if (oldVal === true && newVal === false && isConnected.value) {
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
      dataEnabled.value = false

      // Stop any active timers/scrolling
      stopScroll()
      stopCoursewalks()
    }

    if (oldVal === true && newVal === false && isConnected.value) {
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
      dataEnabled.value = false

      // Stop any active timers/scrolling
      stopScroll()
      stopCoursewalks()
      stopCountUp()
      stopCountDown()
    }

    if (oldVal === true && newVal === false && isConnected.value) {
      console.log('Timer LINK module disabled - clearing status')
      linkStatus.value = 'Waiting for timer data...'
    }
  })

  watch(dataEnabled, (newVal, oldVal) => {
    if (isInitializing.value) return

    if (newVal === true && oldVal === false) {
      // Enabling - disable other modules
      textEnabled.value = false
      cwEnabled.value = false
      timerEnabled.value = false
      linkEnabled.value = false

      // Stop any active timers/scrolling
      stopScroll()
      stopCoursewalks()
      stopCountUp()
      stopCountDown()
    }

    // Save settings
    persistSettings()

    if (oldVal === true && newVal === false) {
      // Stop auto-update
      if (dataAutoUpdate.value) {
        toggleDataAutoUpdate()
      }
      if (isConnected.value) {
        console.log('Data Integrator module disabled - clearing display')
        clear()
      }
    }
  })

  // Auto-save settings watchers
  watch([brightness, scrollSpeed, textColor, dataUrl], () => {
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
    stopScroll()
    stopCoursewalks()
    stopCountUp()
    stopCountDown()

    if (linkClearTimer.value) {
      clearTimeout(linkClearTimer.value)
    }

    if (dataUpdateInterval.value) {
      clearInterval(dataUpdateInterval.value)
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
    line,
    brightness,
    previewText,
    activeLabel,
    lastPayload,

    // Text module
    textEnabled,
    textInput,
    textColor,
    scrollSpeed,
    rainbow,
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
    linkToMled,
    linkLine,
    linkColor,
    linkHold,
    linkStatus,

    // Data Integrator module
    dataEnabled,
    dataSource,
    dataFileHandle,
    dataUrl,
    dataAutoUpdate,
    dataStatus,
    dataDorsal,
    dataHandler,
    dataDog,
    dataCountry,
    dataFaults,
    dataRefusals,
    dataElim,
    dataLine1,
    dataLine2,
    dataLine3,
    dataLine4,

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
    sendFrame,
    setBrightness,
    clear,

    // Actions - Text Module
    updateCharCounter,
    sendText,
    stopScroll,

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

    // Actions - Data Integrator Module
    fetchJsonData,
    toggleDataAutoUpdate,

    // Cleanup
    cleanup,
  }
})

export default useMledStore
