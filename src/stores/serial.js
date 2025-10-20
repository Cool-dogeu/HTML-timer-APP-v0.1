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
      // Request device from user
      const device = await navigator.usb.requestDevice({
        filters: [
          { vendorId: 0x10c4 }, // Silicon Labs (ALGE/FDS)
          { vendorId: 0x0403 }, // FTDI (TIMY)
        ]
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
      if (ports.length > 0) {
        console.log('Found authorized ports, attempting auto-reconnect...')
        const port = ports[0]

        serialManager.value = new SerialManager()
        serialManager.value.onConnectionChange = handleConnectionChange
        serialManager.value.onPacketReceived = handlePacketReceived
        serialManager.value.onRawDataReceived = handleRawDataReceived

        await serialManager.value.connect(port)

        selectedPort.value = port
        lastConnectedPort.value = port
        timerPort.value = port
        timerDeviceInfo.value = getDeviceInfo(port)
        isConnected.value = true
        manualDisconnect.value = false

        startConnectionMonitoring()

        console.log('Auto-reconnected successfully')
        return true
      }
    } catch (error) {
      console.error('Auto-reconnect failed:', error)
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
        const status = packet.status === 0 ? 'clean' : 'fault'
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
    cleanup,
  }
})

export default useSerialStore
