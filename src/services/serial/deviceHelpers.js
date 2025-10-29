/**
 * Device Helper Functions for Serial/USB device management
 * Provides utilities for identifying and comparing devices
 */

/**
 * Get human-readable device description from serial port
 * @param {SerialPort} port - Web Serial API port object
 * @returns {string} Device description string
 */
export function getDeviceDescription(port) {
  try {
    const info = port.getInfo()
    if (info.usbVendorId) {
      return `VID: 0x${info.usbVendorId.toString(16).toUpperCase()}, PID: 0x${(
        info.usbProductId || 0
      )
        .toString(16)
        .toUpperCase()}`
    }
    return 'Unknown Serial Device'
  } catch (error) {
    return 'Unknown Serial Device'
  }
}

/**
 * Check if two serial ports are the same device
 * @param {SerialPort} port1 - First port to compare
 * @param {SerialPort} port2 - Second port to compare
 * @returns {boolean} True if same device
 */
export function isSamePort(port1, port2) {
  if (!port1 || !port2) return false
  try {
    const info1 = port1.getInfo()
    const info2 = port2.getInfo()
    // Compare vendor ID and product ID
    return (
      info1.usbVendorId === info2.usbVendorId &&
      info1.usbProductId === info2.usbProductId
    )
  } catch (error) {
    // If we can't get info, assume they're different
    return false
  }
}

/**
 * Get device info (VID/PID) from serial port
 * @param {SerialPort} port - Web Serial API port object
 * @returns {Object|null} Device info object with vendorId and productId
 */
export function getDeviceInfo(port) {
  if (!port) return null
  try {
    const info = port.getInfo()
    return {
      vendorId: info.usbVendorId,
      productId: info.usbProductId,
    }
  } catch (error) {
    return null
  }
}

/**
 * Get device info from USB device
 * @param {USBDevice} device - WebUSB device object
 * @returns {Object|null} Device info object with vendorId and productId
 */
export function getUSBDeviceInfo(device) {
  if (!device) return null
  try {
    return {
      vendorId: device.vendorId,
      productId: device.productId,
    }
  } catch (error) {
    return null
  }
}

/**
 * Check if device is a known timer device
 * @param {Object} deviceInfo - Device info with vendorId and productId
 * @returns {boolean} True if known timer device
 */
export function isKnownTimerDevice(deviceInfo) {
  if (!deviceInfo) return false

  // Known timer vendor/product IDs (add more as needed)
  const knownDevices = [
    { vendorId: 0x10c4, name: 'Silicon Labs (ALGE/FDS)' },
    { vendorId: 0x0403, name: 'FTDI (TIMY)' },
  ]

  return knownDevices.some((device) => device.vendorId === deviceInfo.vendorId)
}

export default {
  getDeviceDescription,
  isSamePort,
  getDeviceInfo,
  getUSBDeviceInfo,
  isKnownTimerDevice,
}
