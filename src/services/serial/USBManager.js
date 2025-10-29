/**
 * USB Manager - Handles WebUSB API communication with timing hardware
 * Alternative connection method for ALGE/TIMY timers via WebUSB
 */

import { ProtocolAlge } from './ProtocolAlge.js'

export class USBManager {
  constructor() {
    this.device = null
    this.interfaceNumber = null
    this.endpointIn = null
    this.endpointOut = null
    this.onPacketReceived = null
    this.onConnectionChange = null
    this.onRawDataReceived = null
    this.buffer = [] // Change to array for byte-by-byte processing
    this.reading = false

    // ALGE Timer constants (from timy.html)
    this.READ_SIZE = 16
    this.CR = 0x0d
  }

  /**
   * Connect to timing device via WebUSB
   * @param {USBDevice} device - WebUSB device object
   */
  async connect(device) {
    try {
      this.device = device

      console.log('USBManager: Attempting to connect to device:', {
        vendorId: '0x' + this.device.vendorId.toString(16).padStart(4, '0'),
        productId: '0x' + this.device.productId.toString(16).padStart(4, '0'),
        productName: this.device.productName,
        opened: this.device.opened,
      })

      // Open device (skip if already opened)
      if (!this.device.opened) {
        console.log('USBManager: Opening device...')
        try {
          await this.device.open()
          console.log('USBManager: Device opened successfully')
        } catch (error) {
          console.error('USBManager: Failed to open device:', error)
          if (error.name === 'SecurityError') {
            throw new Error(
              'SecurityError: Access denied. Device may be in use by another application or needs WinUSB driver on Windows.'
            )
          } else if (error.name === 'NetworkError') {
            throw new Error(
              'NetworkError: Device disconnected or not accessible.'
            )
          }
          throw error
        }
      } else {
        console.log('USBManager: Device already opened')
      }

      // Select configuration (usually 1)
      if (this.device.configuration === null) {
        console.log('USBManager: Selecting configuration 1...')
        await this.device.selectConfiguration(1)
        console.log('USBManager: Configuration selected')
      } else {
        console.log(
          'USBManager: Configuration already selected:',
          this.device.configuration.configurationValue
        )
      }

      // Try to detach kernel driver if available (Linux)
      if (this.device.detachKernelDriver) {
        try {
          console.log('USBManager: Attempting to detach kernel driver...')
          await this.device.detachKernelDriver(0)
          console.log('USBManager: Kernel driver detached')
        } catch (e) {
          console.log(
            'USBManager: Kernel driver detach not needed or failed:',
            e.message
          )
        }
      }

      // Log available interfaces
      console.log(
        'USBManager: Available interfaces:',
        this.device.configuration.interfaces.length
      )
      for (const iface of this.device.configuration.interfaces) {
        console.log(`  Interface ${iface.interfaceNumber}:`, {
          claimed: iface.claimed,
          alternates: iface.alternates.length,
        })
      }

      // Claim interface 0
      this.interfaceNumber = 0
      console.log(
        `USBManager: Attempting to claim interface ${this.interfaceNumber}...`
      )

      try {
        await this.device.claimInterface(this.interfaceNumber)
        console.log(
          `USBManager: Interface ${this.interfaceNumber} claimed successfully`
        )
      } catch (error) {
        console.error(
          `USBManager: Failed to claim interface ${this.interfaceNumber}:`,
          error
        )

        if (error.name === 'SecurityError') {
          throw new Error(
            `SecurityError: Cannot claim interface ${this.interfaceNumber}. The interface may be in use by the operating system or another application. On Windows, you may need to install the WinUSB driver using Zadig.`
          )
        } else if (error.name === 'InvalidStateError') {
          throw new Error(
            `InvalidStateError: Interface ${this.interfaceNumber} is already claimed. Close other applications using this device.`
          )
        } else if (error.name === 'NotFoundError') {
          throw new Error(
            `NotFoundError: Interface ${this.interfaceNumber} not found on this device.`
          )
        }
        throw error
      }

      // Use hardcoded endpoint for ALGE timers (0x81 masked to 0x01)
      this.endpointIn = 0x81 & 0x7f // Results in endpoint 1
      this.endpointOut = 0x01 & 0x7f

      console.log('USBManager: USB connected successfully!')
      console.log('  Endpoint IN:', this.endpointIn)
      console.log('  Endpoint OUT:', this.endpointOut)

      this.onConnectionChange?.(true)

      // Start reading
      this.reading = true
      this.readLoop()
    } catch (error) {
      console.error('USB connection error:', error)
      this.onConnectionChange?.(false)
      throw error
    }
  }

  /**
   * Continuous read loop for USB data
   */
  async readLoop() {
    try {
      while (this.reading && this.device) {
        // Read data from USB device using ALGE-specific READ_SIZE
        const result = await this.device.transferIn(
          this.endpointIn,
          this.READ_SIZE
        )

        if (result.status === 'ok' && result.data && result.data.byteLength > 0) {
          // Process byte-by-byte like timy.html
          const bytes = new Uint8Array(result.data.buffer)

          // Debug log raw data
          if (this.onRawDataReceived) {
            const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
            this.onRawDataReceived(text)
          }

          for (let i = 0; i < bytes.length; i++) {
            const b = bytes[i]

            if (b === this.CR) {
              // End of line - decode buffer and process
              const line = new TextDecoder('utf-8', { fatal: false })
                .decode(new Uint8Array(this.buffer))
                .trim()

              this.buffer = [] // Reset buffer

              // Filter out TIMY status messages
              if (line && !/^TIMY:\s*\d+\s*$/.test(line)) {
                console.log('Processing USB line:', line)
                const packet = ProtocolAlge.parsePacket(line)
                if (packet) {
                  this.onPacketReceived?.(packet)
                } else {
                  console.log('Failed to parse USB packet:', line)
                }
              }
            } else {
              // Add byte to buffer
              this.buffer.push(b)
            }
          }
        }
      }
    } catch (error) {
      console.error('USB read error:', error)
      // Handle device disconnection errors
      if (
        error.message.includes('device has been lost') ||
        error.message.includes('NetworkError') ||
        error.name === 'NetworkError'
      ) {
        console.log('USB device lost, triggering disconnection handling')
        await this.handleDisconnection()
      }
    }
  }

  /**
   * Gracefully disconnect from USB device
   */
  async disconnect() {
    this.reading = false

    if (this.device) {
      try {
        if (this.interfaceNumber !== null) {
          await this.device.releaseInterface(this.interfaceNumber)
        }
        await this.device.close()
      } catch (error) {
        console.error('USB disconnect error:', error)
      }
      this.device = null
    }

    this.onConnectionChange?.(false)
  }

  /**
   * Check if currently connected
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.device !== null && this.device.opened
  }

  /**
   * Check if connection is still active
   * @returns {boolean} Connection status
   */
  async checkConnection() {
    if (!this.device) {
      return false
    }

    try {
      // Check if device is still opened
      if (!this.device.opened) {
        console.log('USB device is no longer opened')
        await this.handleDisconnection()
        return false
      }

      return true
    } catch (error) {
      console.log('USB connection check failed:', error)
      await this.handleDisconnection()
      return false
    }
  }

  /**
   * Handle unexpected disconnection
   */
  async handleDisconnection() {
    if (this.device) {
      this.device = null
      this.reading = false
      this.onConnectionChange?.(false)
    }
  }
}

export default USBManager
