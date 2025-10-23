/**
 * Time Formatter Service
 * Provides utilities for formatting time values with various precision levels
 */

/**
 * Format seconds to SS.FF or SS.FFF format (always in seconds, even above 60s)
 * @param {number} seconds - Time in seconds
 * @param {boolean} highPrecision - Use 3 decimal places (true) or 2 (false)
 * @returns {string} Formatted time string
 */
export function formatTime(seconds, highPrecision = false) {
  if (seconds === null || seconds === undefined || isNaN(seconds)) {
    return highPrecision ? '0.000' : '0.00'
  }

  const totalSeconds = Math.abs(seconds)

  if (highPrecision) {
    // Format with 3 decimal places - always in seconds
    return totalSeconds.toFixed(3)
  } else {
    // Format with 2 decimal places - always in seconds
    return totalSeconds.toFixed(2)
  }
}

/**
 * Format time for display with automatic precision
 * @param {number} seconds - Time in seconds
 * @param {boolean} highPrecision - Use high precision mode
 * @returns {string} Formatted time string
 */
export function formatDisplayTime(seconds, highPrecision = false) {
  return formatTime(seconds, highPrecision)
}

/**
 * Format time for CSV export (always includes timestamp)
 * @param {number} seconds - Time in seconds
 * @param {string} status - Result status (clean/fault)
 * @returns {string} Formatted result string
 */
export function formatResultForExport(seconds, status = 'clean') {
  const time = formatTime(seconds, true) // Always use high precision for export
  return status === 'fault' ? `${time} (F)` : time
}

/**
 * Format result object for display
 * @param {Object} result - Result object with time and status
 * @param {boolean} highPrecision - Use high precision mode
 * @returns {string} Formatted result string
 */
export function formatResultDisplay(result, highPrecision = false) {
  if (!result || result.time === null || result.time === undefined) {
    return highPrecision ? '0.000' : '0.00'
  }

  const time = formatTime(result.time, highPrecision)
  return result.status === 'fault' ? `${time} (F)` : time
}

/**
 * Get current timestamp in YYYY-MM-DD HH:MM:SS format
 * @returns {string} Formatted timestamp
 */
export function getCurrentTimestamp() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

/**
 * Parse time string to seconds
 * @param {string} timeString - Time in format MM:SS.FF or SS.FF
 * @returns {number} Time in seconds
 */
export function parseTimeToSeconds(timeString) {
  if (!timeString) return 0

  const parts = timeString.split(':')
  if (parts.length === 2) {
    // MM:SS.FF format
    const minutes = parseFloat(parts[0])
    const seconds = parseFloat(parts[1])
    return minutes * 60 + seconds
  } else {
    // SS.FF format
    return parseFloat(timeString)
  }
}

export default {
  formatTime,
  formatDisplayTime,
  formatResultForExport,
  formatResultDisplay,
  getCurrentTimestamp,
  parseTimeToSeconds,
}
