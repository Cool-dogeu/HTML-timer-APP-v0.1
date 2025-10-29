/**
 * CSV Exporter Service
 * Handles exporting results to CSV format
 */

import { formatResultForExport, getCurrentTimestamp } from './TimeFormatter.js'

/**
 * Export results to CSV file
 * @param {Array} results - Array of result objects
 * @param {boolean} highPrecision - Use high precision formatting
 */
export function exportResultsToCSV(results, highPrecision = false) {
  if (!results || results.length === 0) {
    console.warn('No results to export')
    return
  }

  // Create CSV header
  const headers = ['Number', 'Result', 'Status', 'Timestamp']
  const csvRows = [headers.join(',')]

  // Add data rows (reverse to show oldest first in CSV)
  results
    .slice()
    .reverse()
    .forEach((result, index) => {
      const number = index + 1
      const time = formatResultForExport(result.time, result.status)
      const status = result.status || 'clean'
      const timestamp = result.timestamp || ''

      csvRows.push(`${number},"${time}","${status}","${timestamp}"`)
    })

  // Create CSV content
  const csvContent = csvRows.join('\n')

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute(
      'download',
      `agility_results_${getCurrentTimestamp().replace(/[: ]/g, '_')}.csv`
    )
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}

/**
 * Convert results to CSV string
 * @param {Array} results - Array of result objects
 * @returns {string} CSV formatted string
 */
export function resultsToCSVString(results) {
  if (!results || results.length === 0) {
    return ''
  }

  const headers = ['Number', 'Result', 'Status', 'Timestamp']
  const csvRows = [headers.join(',')]

  results
    .slice()
    .reverse()
    .forEach((result, index) => {
      const number = index + 1
      const time = formatResultForExport(result.time, result.status)
      const status = result.status || 'clean'
      const timestamp = result.timestamp || ''

      csvRows.push(`${number},"${time}","${status}","${timestamp}"`)
    })

  return csvRows.join('\n')
}

export default {
  exportResultsToCSV,
  resultsToCSVString,
}
