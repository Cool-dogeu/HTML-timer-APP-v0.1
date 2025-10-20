/**
 * Serial Manager - Handles Web Serial API communication with timing hardware
 * Receives and parses timing data packets from ALGE/FDS timers
 */

import { ProtocolAlge } from './ProtocolAlge.js'

export class SerialManager {
  constructor() {
    this.port = null
    this.reader = null
    this.writer = null
    this.readableStreamClosed = null
    this.writableStreamClosed = null
    this.onPacketReceived = null
    this.onConnectionChange = null
    this.onRawDataReceived = null
    this.buffer = ''
  }

  /**
   * Connect to timing device via serial port
   * @param {SerialPort} port - Web Serial API port object
   */
  async connect(port) {
    try {
      this.port = port

      // Open port with fixed settings (matching original app)
      await this.port.open({
        baudRate: 9600,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        bufferSize: 255,
      })

      this.onConnectionChange?.(true)

      const textDecoder = new TextDecoderStream()
      this.readableStreamClosed = this.port.readable.pipeTo(
        textDecoder.writable
      )
      this.reader = textDecoder.readable.getReader()

      // Start reading
      this.readLoop()
    } catch (error) {
      console.error('Connection error:', error)
      this.onConnectionChange?.(false)
      throw error
    }
  }

  /**
   * Continuous read loop for serial data
   */
  async readLoop() {
    try {
      while (this.reader) {
        const { value, done } = await this.reader.read()
        if (done) {
          break
        }
        this.processData(value)
      }
    } catch (error) {
      console.error('Read error:', error)
      // Handle device disconnection errors
      if (
        error.message.includes('device has been lost') ||
        error.message.includes('NetworkError') ||
        error.name === 'NetworkError'
      ) {
        console.log('Device lost, triggering disconnection handling')
        await this.handleDisconnection()
      }
    } finally {
      if (this.reader) {
        try {
          this.reader.releaseLock()
        } catch (e) {
          console.log('Reader already released')
        }
      }
    }
  }

  /**
   * Process incoming serial data
   * @param {string} data - Raw serial data
   */
  processData(data) {
    this.buffer += data

    // Debug log raw data
    if (this.onRawDataReceived) {
      this.onRawDataReceived(data)
    }

    const lines = this.buffer.split('\r')

    // Keep the last incomplete line in buffer
    this.buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.trim()) {
        console.log('Processing line:', line)
        const packet = ProtocolAlge.parsePacket(line)
        if (packet) {
          this.onPacketReceived?.(packet)
        } else {
          console.log('Failed to parse packet:', line)
        }
      }
    }
  }

  /**
   * Gracefully disconnect from device
   */
  async disconnect() {
    if (this.reader) {
      try {
        await this.reader.cancel()
        await this.readableStreamClosed?.catch(() => {})
      } catch (error) {
        console.error('Reader cancel error:', error)
      }
      this.reader = null
    }

    if (this.port) {
      try {
        await this.port.close()
      } catch (error) {
        console.error('Port close error:', error)
      }
      this.port = null
    }

    this.onConnectionChange?.(false)
  }

  /**
   * Check if currently connected
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.port !== null && this.port.readable
  }

  /**
   * Check if connection is still active
   * @returns {boolean} Connection status
   */
  async checkConnection() {
    if (!this.port) {
      return false
    }

    try {
      // Simple check if port object still exists and has streams
      if (!this.port.readable || !this.port.writable) {
        console.log('Port streams are no longer available')
        await this.handleDisconnection()
        return false
      }

      return true
    } catch (error) {
      console.log('Connection check failed:', error)
      await this.handleDisconnection()
      return false
    }
  }

  /**
   * Handle unexpected disconnection
   */
  async handleDisconnection() {
    if (this.port) {
      this.port = null
      this.reader = null
      this.onConnectionChange?.(false)
    }
  }
}

export default SerialManager
