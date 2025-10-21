/**
 * Serial Store - Manages serial/USB connections to timing hardware
 * Handles Web Serial API and WebUSB API connections
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { SerialManager } from '@services/serial/SerialManager'
import { USBManager } from '@services/serial/USBManager'
import { getDeviceInfo } from '@services/serial/deviceHelpers'
import { useTimerStore } from './timer'

export const useSerialStore = defineStore('serial', () => {
  // ============================================================================
  // STATE
  // ============================================================================

  // Connection state
  const isConnected = ref(false)
  const connectionType = ref('serial') // 'serial' or 'usb'
  const selectedPort = ref(null)
  const selectedDevice = ref(null)
  const manualDisconnect = ref(false)
  const lastConnectedPort = ref(null)

  // Manager instances
  const serialManager = ref(null)
  const usbManager = ref(null)

  // Device tracking
  const timerPort = ref(null)
  const timerDeviceInfo = ref(null)

  // Connection monitoring
  const connectionCheckInterval = ref(null)
  const showConnectionLostModal = ref(false)

  // Debug state
  const rawDataBuffer = ref('')
  const debugMessages = ref([])
  const showDebugConsole = ref(false)

  // Test runner state
  const testRunning = ref(false)
  const testTimeout = ref(null)
  const testRunCount = ref(0)

  // ============================================================================
  // COMPUTED / GETTERS
  // ============================================================================

  const connectionStatus = computed(() => {
    return isConnected.value ? 'Connected' : 'Disconnected'
  })

  const statusLedClass = computed(() => {
    return isConnected.value ? 'status-ok' : 'status-error'
  })

  const currentManager = computed(() => {
    return connectionType.value === 'serial' ? serialManager.value : usbManager.value
  })

  // ============================================================================
  // ACTIONS
  // ============================================================================

  /**
   * Initialize serial store
   */
  function initialize() {
    // Load any persisted connection preferences if needed
    console.log('Serial store initialized')
  }

  /**
   * Connect to timing device
   */
  async function connect() {
    try {
      if (connectionType.value === 'serial') {
        await connectSerial()
      } else {
        await connectUSB()
      }
    } catch (error) {
      console.error('Connection error:', error)
      throw error
    }
  }

  /**
   * Connect via Web Serial API
   */
  async function connectSerial() {
    if (!('serial' in navigator)) {
      throw new Error('Web Serial API not supported in this browser')
    }

    try {
      // Request port from user
      const port = await navigator.serial.requestPort()
      selectedPort.value = port
      lastConnectedPort.value = port

      // Get device info
      timerDeviceInfo.value = getDeviceInfo(port)
      timerPort.value = port

      // Save device info to localStorage for auto-reconnect
      localStorage.setItem('timerDeviceInfo', JSON.stringify(timerDeviceInfo.value))
      console.log('Saved timer device info:', timerDeviceInfo.value)

      // Create manager instance
      serialManager.value = new SerialManager()

      // Set up callbacks
      serialManager.value.onConnectionChange = handleConnectionChange
      serialManager.value.onPacketReceived = handlePacketReceived
      serialManager.value.onRawDataReceived = handleRawDataReceived

      // Connect
      await serialManager.value.connect(port)

      isConnected.value = true
      manualDisconnect.value = false

      // Start connection monitoring
      startConnectionMonitoring()

      console.log('Serial connected successfully')
    } catch (error) {
      console.error('Serial connection failed:', error)
      isConnected.value = false
      throw error
    }
  }

  /**
   * Connect via WebUSB API
   */
  async function connectUSB() {
    if (!('usb' in navigator)) {
      throw new Error('WebUSB API not supported in this browser')
    }

    try {
      // Request device from user (empty filters shows all USB devices)
      const device = await navigator.usb.requestDevice({
        filters: []
      })

      selectedDevice.value = device

      // Get device info
      timerDeviceInfo.value = {
        vendorId: device.vendorId,
        productId: device.productId
      }

      // Create manager instance
      usbManager.value = new USBManager()

      // Set up callbacks
      usbManager.value.onConnectionChange = handleConnectionChange
      usbManager.value.onPacketReceived = handlePacketReceived
      usbManager.value.onRawDataReceived = handleRawDataReceived

      // Connect
      await usbManager.value.connect(device)

      isConnected.value = true
      manualDisconnect.value = false

      // Start connection monitoring
      startConnectionMonitoring()

      console.log('USB connected successfully')
    } catch (error) {
      console.error('USB connection failed:', error)
      isConnected.value = false
      throw error
    }
  }

  /**
   * Disconnect from device
   */
  async function disconnect() {
    manualDisconnect.value = true
    stopConnectionMonitoring()

    const manager = currentManager.value
    if (manager) {
      try {
        await manager.disconnect()
      } catch (error) {
        console.error('Disconnect error:', error)
      }
    }

    isConnected.value = false
    selectedPort.value = null
    selectedDevice.value = null
    timerPort.value = null
    timerDeviceInfo.value = null
    serialManager.value = null
    usbManager.value = null

    // Remove saved device info
    localStorage.removeItem('timerDeviceInfo')

    console.log('Disconnected')
  }

  /**
   * Attempt to reconnect to last device
   */
  async function reconnect() {
    if (connectionType.value === 'serial' && lastConnectedPort.value) {
      try {
        serialManager.value = new SerialManager()
        serialManager.value.onConnectionChange = handleConnectionChange
        serialManager.value.onPacketReceived = handlePacketReceived
        serialManager.value.onRawDataReceived = handleRawDataReceived

        await serialManager.value.connect(lastConnectedPort.value)
        isConnected.value = true
        manualDisconnect.value = false
        startConnectionMonitoring()

        console.log('Reconnected successfully')
        return true
      } catch (error) {
        console.error('Reconnection failed:', error)
        return false
      }
    }
    return false
  }

  /**
   * Auto-reconnect to previously authorized port on app start
   */
  async function autoReconnect() {
    if (connectionType.value !== 'serial' || !('serial' in navigator)) {
      return false
    }

    try {
      // Get previously authorized ports
      const ports = await navigator.serial.getPorts()
      if (ports.length === 0) {
        return false
      }

      // Load saved device info
      const savedDeviceInfo = localStorage.getItem('timerDeviceInfo')
      if (!savedDeviceInfo) {
        console.log('No saved timer device info found')
        return false
      }

      const savedInfo = JSON.parse(savedDeviceInfo)
      console.log('Looking for timer device:', savedInfo)

      // Find matching port
      for (const p of ports) {
        const info = getDeviceInfo(p)
        if (info.vendorId === savedInfo.vendorId && info.productId === savedInfo.productId) {
          console.log('Found timer device, attempting auto-reconnect...')

          serialManager.value = new SerialManager()
          serialManager.value.onConnectionChange = handleConnectionChange
          serialManager.value.onPacketReceived = handlePacketReceived
          serialManager.value.onRawDataReceived = handleRawDataReceived

          await serialManager.value.connect(p)

          selectedPort.value = p
          lastConnectedPort.value = p
          timerPort.value = p
          timerDeviceInfo.value = info
          isConnected.value = true
          manualDisconnect.value = false

          startConnectionMonitoring()

          console.log('Timer auto-reconnected successfully')
          return true
        }
      }

      console.log('Timer device not found among authorized ports')
    } catch (error) {
      console.error('Timer auto-reconnect failed:', error)
    }

    return false
  }

  // ============================================================================
  // CALLBACKS
  // ============================================================================

  /**
   * Handle connection state changes
   * @param {boolean} connected - Connection status
   */
  function handleConnectionChange(connected) {
    isConnected.value = connected

    if (!connected && !manualDisconnect.value) {
      // Unexpected disconnection
      console.log('Connection lost unexpectedly')
      showConnectionLostModal.value = true
      stopConnectionMonitoring()
    }
  }

  /**
   * Handle received timing packet
   * @param {Object} packet - Parsed timing packet
   */
  function handlePacketReceived(packet) {
    console.log('Packet received:', packet)

    // Get timer store
    const timerStore = useTimerStore()

    if (packet.type === 'timing') {
      // Channel 0 with absolute time = start signal
      if (packet.channelNumber === 0 && packet.mode === 'absolute') {
        timerStore.startTimer(packet.absoluteTime, packet.userId)
      }
      // Channel 1 with delta time = finish signal
      else if (packet.channelNumber === 1 && packet.mode === 'delta') {
        const status = packet.deltaTime > 0 ? 'clean' : 'fault'
        timerStore.stopTimer(packet.deltaTime, status, packet.userId)
      }
    }
    else if (packet.type === 'control') {
      console.log('Control command:', packet.command)
      // Handle control commands if needed
    }
  }

  /**
   * Handle raw data for debugging
   * @param {string} data - Raw data string
   */
  function handleRawDataReceived(data) {
    // Append to debug buffer (keep last 1000 chars)
    rawDataBuffer.value = (rawDataBuffer.value + data).slice(-1000)

    // Add debug message with timestamp
    const timestamp = new Date().toLocaleTimeString()
    debugMessages.value.push(`[${timestamp}] ${data}`)

    // Keep only last 100 messages
    if (debugMessages.value.length > 100) {
      debugMessages.value = debugMessages.value.slice(-100)
    }
  }

  // ============================================================================
  // CONNECTION MONITORING
  // ============================================================================

  /**
   * Start periodic connection check
   */
  function startConnectionMonitoring() {
    if (connectionCheckInterval.value) {
      clearInterval(connectionCheckInterval.value)
    }

    connectionCheckInterval.value = setInterval(async () => {
      const manager = currentManager.value
      if (manager) {
        const stillConnected = await manager.checkConnection()
        if (!stillConnected && !manualDisconnect.value) {
          console.log('Connection check failed')
          isConnected.value = false
          showConnectionLostModal.value = true
          stopConnectionMonitoring()
        }
      }
    }, 2000) // Check every 2 seconds
  }

  /**
   * Stop connection monitoring
   */
  function stopConnectionMonitoring() {
    if (connectionCheckInterval.value) {
      clearInterval(connectionCheckInterval.value)
      connectionCheckInterval.value = null
    }
  }

  // ============================================================================
  // DEBUG HELPERS
  // ============================================================================

  /**
   * Toggle debug console visibility
   */
  function toggleDebugConsole() {
    showDebugConsole.value = !showDebugConsole.value
  }

  /**
   * Clear debug console
   */
  function clearDebugConsole() {
    rawDataBuffer.value = ''
    debugMessages.value = []
  }

  /**
   * Add debug message
   * @param {string} message - Debug message
   */
  function addDebugMessage(message) {
    const timestamp = new Date().toLocaleTimeString()
    debugMessages.value.push(`[${timestamp}] ${message}`)

    if (debugMessages.value.length > 100) {
      debugMessages.value = debugMessages.value.slice(-100)
    }
  }

  // ============================================================================
  // TEST RUNNER
  // ============================================================================

  /**
   * Start automated test runs
   */
  function startTestRuns() {
    testRunning.value = true
    testRunCount.value = 0
    addDebugMessage('Starting automated test runs...')
    scheduleNextTestRun()
  }

  /**
   * Stop automated test runs
   */
  function stopTestRuns() {
    testRunning.value = false
    if (testTimeout.value) {
      clearTimeout(testTimeout.value)
      testTimeout.value = null
    }
    addDebugMessage('Stopped automated test runs')
  }

  /**
   * Schedule next test run with random delay
   */
  function scheduleNextTestRun() {
    if (!testRunning.value) return

    // Random delay between runs (2-5 seconds)
    const delay = Math.random() * 3000 + 2000
    testTimeout.value = setTimeout(() => {
      simulateTestRun()
    }, delay)
  }

  /**
   * Simulate a single test run
   */
  function simulateTestRun() {
    if (!testRunning.value) return

    testRunCount.value++
    const runTime = Math.random() * 30 + 25 // 25-55 seconds

    addDebugMessage(`Test run #${testRunCount.value}: ${runTime.toFixed(3)}s`)

    // Get timer store
    const timerStore = useTimerStore()

    // Simulate start packet (channel 0, absolute time)
    const now = new Date()
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now
      .getMilliseconds()
      .toString()
      .padStart(4, '0')}`

    const startPacket = {
      type: 'timing',
      userId: testRunCount.value,
      mode: 'absolute',
      channelNumber: 0,
      isManual: false,
      absoluteTime: timeString,
      deltaTime: null,
      status: 0,
      originalTimeString: timeString,
      originalChannelString: 'C0',
    }

    handlePacketReceived(startPacket)

    // Schedule finish packet
    setTimeout(() => {
      if (!testRunning.value) return

      const finishPacket = {
        type: 'timing',
        userId: testRunCount.value,
        mode: 'delta',
        channelNumber: 1,
        isManual: false,
        absoluteTime: null,
        deltaTime: runTime,
        status: 0,
        originalTimeString: runTime.toFixed(4).padStart(10, '0'),
        originalChannelString: 'C1',
      }

      handlePacketReceived(finishPacket)

      // Schedule next run
      scheduleNextTestRun()
    }, runTime * 1000) // Use actual run time duration
  }

  /**
   * Simulate a single RT test run
   */
  function simulateRTTestRun() {
    const timerStore = useTimerStore()

    if (timerStore.isRunning) {
      addDebugMessage('Cannot start RT test - timer is already running')
      return
    }

    const runTime = Math.random() * 5 + 10 // 10-15 seconds
    addDebugMessage(`Simulating RT test run - ${runTime.toFixed(3)} seconds`)
    performTestRun(runTime)
  }

  /**
   * Simulate a long time test (over 1 minute)
   */
  function simulateLongTimeTest() {
    const timerStore = useTimerStore()

    if (timerStore.isRunning) {
      addDebugMessage('Cannot start long time test - timer is already running')
      return
    }

    const runTime = Math.random() * 30 + 70 // 70-100 seconds (over 1 minute)
    addDebugMessage(`Simulating long time test run - ${runTime.toFixed(3)} seconds`)
    performTestRun(runTime)
  }

  /**
   * Perform a test run with given duration
   * @param {number} runTime - Run time in seconds
   */
  function performTestRun(runTime) {
    // Simulate start packet (channel 0, absolute time)
    const now = new Date()
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now
      .getMilliseconds()
      .toString()
      .padStart(4, '0')}`

    const startPacket = {
      type: 'timing',
      userId: 999,
      mode: 'absolute',
      channelNumber: 0,
      isManual: false,
      absoluteTime: timeString,
      deltaTime: null,
      status: 0,
      originalTimeString: timeString,
      originalChannelString: 'C0M',
    }

    handlePacketReceived(startPacket)

    // Schedule finish packet
    setTimeout(() => {
      const finishPacket = {
        type: 'timing',
        userId: 999,
        mode: 'delta',
        channelNumber: 1,
        isManual: Math.random() > 0.5,
        absoluteTime: null,
        deltaTime: runTime,
        status: 0,
        originalTimeString: runTime.toFixed(4),
        originalChannelString: Math.random() > 0.5 ? 'RTM' : 'RT',
      }

      handlePacketReceived(finishPacket)
    }, Math.min(runTime * 100, 3000)) // Speed up for testing (max 3 seconds wait)
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Cleanup function for when store is destroyed
   */
  function cleanup() {
    stopConnectionMonitoring()
    if (currentManager.value) {
      currentManager.value.disconnect()
    }
  }

  // ============================================================================
  // RETURN PUBLIC API
  // ============================================================================

  return {
    // State
    isConnected,
    connectionType,
    selectedPort,
    selectedDevice,
    manualDisconnect,
    lastConnectedPort,
    timerPort,
    timerDeviceInfo,
    showConnectionLostModal,
    rawDataBuffer,
    debugMessages,
    showDebugConsole,
    testRunning,
    testTimeout,
    testRunCount,

    // Computed
    connectionStatus,
    statusLedClass,
    currentManager,

    // Actions
    initialize,
    connect,
    connectSerial,
    connectUSB,
    disconnect,
    reconnect,
    autoReconnect,
    toggleDebugConsole,
    clearDebugConsole,
    addDebugMessage,
    startTestRuns,
    stopTestRuns,
    simulateRTTestRun,
    simulateLongTimeTest,
    cleanup,
  }
})

export default useSerialStore
