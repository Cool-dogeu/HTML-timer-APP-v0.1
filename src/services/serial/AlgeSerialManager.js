/**
 * Alge Serial Manager - Handles communication with Alge GAZ display hardware
 * Protocol: 2400 baud, 8N1, ASCII frames terminated with CR
 * Based on fdstoalge.py and cwalge.py Python implementations
 */

export class AlgeSerialManager {
  constructor() {
    this.port = null
    this.writer = null
    this.onConnectionChange = null
  }

  /**
   * Connect to Alge display via serial port
   * @param {SerialPort} port - Web Serial API port object
   */
  async connect(port) {
    try {
      this.port = port
      await this.port.open({
        baudRate: 2400,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
      })

      this.writer = this.port.writable.getWriter()
      this.onConnectionChange?.(true)
    } catch (error) {
      console.error('Alge connection error:', error)
      this.onConnectionChange?.(false)
      throw error
    }
  }

  /**
   * Build frame header for time < 100 seconds
   * @returns {string} Header string (14 characters)
   */
  _headLt100() {
    return '  0   .       ' // 14 chars
  }

  /**
   * Build frame header for time >= 100 seconds
   * @returns {string} Header string (12 characters)
   */
  _headGe100() {
    return '  0   .     ' // 12 chars
  }

  /**
   * Build frame header for coursewalk (different format)
   * @returns {string} Header string (12 characters)
   */
  _headCoursewalk() {
    return '  0   .     ' // 12 chars - same as >= 100s format
  }

  /**
   * Build time frame WITH decimals (hundredths)
   * Format: "  0   .       S.DD 00" (<100s) or "  0   .     H SS.DD 00" (>=100s)
   * Matches Python fdstoalge.py implementation exactly
   * @param {number} sec - Seconds (integer part)
   * @param {number} dd - Hundredths/centiseconds (0-99)
   * @returns {string} Complete frame
   */
  buildTimeWithDecimals(sec, dd) {
    if (sec >= 100) {
      const H = Math.floor(sec / 100)
      const SS = (sec % 100).toString().padStart(2, '0')
      const DD = dd.toString().padStart(2, '0')
      return this._headGe100() + `${H} ${SS}.${DD} 00`
    } else {
      const S = sec < 10 ? ` ${sec}` : sec.toString()
      const DD = dd.toString().padStart(2, '0')
      return this._headLt100() + `${S}.${DD} 00`
    }
  }

  /**
   * Build time frame WITHOUT decimals (running timer)
   * Format: "  0   .       S.   00" (<100s) or "  0   .     H SS.   00" (>=100s)
   * Matches Python fdstoalge.py implementation exactly
   * @param {number} sec - Seconds (integer)
   * @returns {string} Complete frame
   */
  buildTimeWithoutDecimals(sec) {
    if (sec >= 100) {
      const H = Math.floor(sec / 100)
      const SS = (sec % 100).toString().padStart(2, '0')
      return this._headGe100() + `${H} ${SS}.   00`
    } else {
      const S = sec < 10 ? ` ${sec}` : sec.toString()
      return this._headLt100() + `${S}.   00`
    }
  }

  /**
   * Build coursewalk running frame
   * Format: "  0   .     N  M.SS 00" (N=index, M=minutes, SS=seconds)
   * @param {number} nIdx - Coursewalk index (1-4)
   * @param {number} totalSeconds - Total time remaining in seconds
   * @returns {string} Complete frame
   */
  buildCoursewalkRunning(nIdx, totalSeconds) {
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60
    const SS = s.toString().padStart(2, '0')
    return this._headCoursewalk() + `${nIdx}  ${m}.${SS} 00`
  }

  /**
   * Build coursewalk break frame (shows dashes)
   * Format: "  0   .     N  - - - 00"
   * @param {number} nIdx - Coursewalk index (1-4)
   * @returns {string} Complete frame
   */
  buildCoursewalkBreak(nIdx) {
    return this._headCoursewalk() + `${nIdx}  - - - 00`
  }

  /**
   * Build clear/zero frame
   * Format: "  0   .            0.00 00"
   * @returns {string} Complete frame
   */
  buildClear() {
    return this._headLt100() + '   0.00 00'
  }

  /**
   * Send frame to Alge display
   * @param {string} frame - Complete frame (header + content)
   */
  async sendFrame(frame) {
    if (!this.writer) {
      throw new Error('Alge not connected')
    }

    // Append CR and encode as ASCII using TextEncoder
    const encoder = new TextEncoder()
    const bytes = encoder.encode(frame + '\r')

    try {
      await this.writer.write(bytes)
    } catch (error) {
      console.error('Alge write error:', error)
      // Handle device disconnection errors
      if (
        error.message.includes('device has been lost') ||
        error.message.includes('NetworkError') ||
        error.name === 'NetworkError'
      ) {
        console.log('Alge device lost during write')
        await this.handleDisconnection()
      }
      throw error
    }
  }

  /**
   * Send time WITH decimals to display
   * @param {number} sec - Seconds
   * @param {number} dd - Hundredths/centiseconds
   */
  async sendTimeWithDecimals(sec, dd) {
    const frame = this.buildTimeWithDecimals(sec, dd)
    await this.sendFrame(frame)
  }

  /**
   * Send time WITHOUT decimals to display
   * @param {number} sec - Seconds
   */
  async sendTimeWithoutDecimals(sec) {
    const frame = this.buildTimeWithoutDecimals(sec)
    await this.sendFrame(frame)
  }

  /**
   * Send coursewalk running frame
   * @param {number} nIdx - Coursewalk index
   * @param {number} totalSeconds - Time remaining
   */
  async sendCoursewalkRunning(nIdx, totalSeconds) {
    const frame = this.buildCoursewalkRunning(nIdx, totalSeconds)
    await this.sendFrame(frame)
  }

  /**
   * Send coursewalk break frame
   * @param {number} nIdx - Coursewalk index
   */
  async sendCoursewalkBreak(nIdx) {
    const frame = this.buildCoursewalkBreak(nIdx)
    await this.sendFrame(frame)
  }

  /**
   * Clear display (send 0.00)
   */
  async clear() {
    const frame = this.buildClear()
    await this.sendFrame(frame)
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
        console.log('Alge port streams are no longer available')
        await this.handleDisconnection()
        return false
      }

      return true
    } catch (error) {
      console.log('Alge connection check failed:', error)
      await this.handleDisconnection()
      return false
    }
  }

  /**
   * Gracefully disconnect from Alge display
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

export default AlgeSerialManager
