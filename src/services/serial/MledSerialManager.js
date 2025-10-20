/**
 * MLED Serial Manager - Handles communication with LED display hardware
 * Implements protocol for sending text/data to MLED displays
 */

export class MledSerialManager {
  constructor() {
    this.port = null
    this.writer = null
    this.onConnectionChange = null
  }

  /**
   * Connect to MLED device via serial port
   * @param {SerialPort} port - Web Serial API port object
   */
  async connect(port) {
    try {
      this.port = port
      await this.port.open({
        baudRate: 9600,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
      })

      this.writer = this.port.writable.getWriter()
      this.onConnectionChange?.(true)
    } catch (error) {
      console.error('MLED connection error:', error)
      this.onConnectionChange?.(false)
      throw error
    }
  }

  /**
   * Send frame to MLED display
   * @param {number} line - Display line number
   * @param {number} brightness - Brightness level (1-3)
   * @param {string} payload - Text payload to display
   */
  async sendFrame(line, brightness, payload) {
    if (!this.writer) {
      throw new Error('MLED not connected')
    }

    const STX = 0x02
    const LF = 0x0a

    // Build frame: [STX][LINE][BRIGHTNESS][PAYLOAD][LF]
    const bytes = [STX]
    bytes.push(String(line).charCodeAt(0) & 0xff)
    bytes.push(String(brightness).charCodeAt(0) & 0xff)

    // Encode payload as Latin-1
    for (let i = 0; i < payload.length; i++) {
      bytes.push(payload.charCodeAt(i) & 0xff)
    }

    bytes.push(LF)

    const frame = new Uint8Array(bytes)

    try {
      await this.writer.write(frame)
    } catch (error) {
      console.error('MLED write error:', error)
      // Handle device disconnection errors
      if (
        error.message.includes('device has been lost') ||
        error.message.includes('NetworkError') ||
        error.name === 'NetworkError'
      ) {
        console.log('MLED device lost during write')
        await this.handleDisconnection()
      }
      throw error
    }
  }

  /**
   * Handle unexpected disconnection
   */
  async handleDisconnection() {
    if (this.port) {
      this.port = null
      this.writer = null
      this.onConnectionChange?.(false)
    }
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
      // Check if port streams are still available
      if (!this.port.readable || !this.port.writable) {
        console.log('MLED port streams are no longer available')
        await this.handleDisconnection()
        return false
      }

      return true
    } catch (error) {
      console.log('MLED connection check failed:', error)
      await this.handleDisconnection()
      return false
    }
  }

  /**
   * Gracefully disconnect from MLED device
   */
  async disconnect() {
    if (this.writer) {
      try {
        await this.writer.releaseLock()
      } catch (error) {
        console.error('Writer release error:', error)
      }
      this.writer = null
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
    return this.port !== null && this.writer !== null
  }
}

export default MledSerialManager
