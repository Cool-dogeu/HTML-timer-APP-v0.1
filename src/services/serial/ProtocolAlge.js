/**
 * Protocol parser for ALGE timing system
 * Handles packet parsing for timing data from ALGE hardware
 */

export const TimeMode = {
  ABSOLUTE: 'absolute',
  DELTA: 'delta',
}

export class ProtocolAlge {
  /**
   * Parse a timing packet from ALGE device
   * @param {string} packet - Raw packet string
   * @returns {Object|null} Parsed packet data or null if invalid
   */
  static parsePacket(packet) {
    if (!packet || typeof packet !== 'string') {
      console.debug('ParsePacket: Input packet is null or not a string.')
      return null
    }

    const parts = packet.trim().split(/\s+/)

    // Handle 'n' commands (control/status messages)
    if (parts.length === 1 && parts[0].match(/^n\d+$/i)) {
      console.debug(`ParsePacket: Control command detected: '${packet}'`)
      return {
        type: 'control',
        command: parts[0],
        originalPacket: packet,
      }
    }

    if (parts.length !== 4) {
      console.debug(
        `ParsePacket: Packet split into ${parts.length} parts instead of 4. Packet: '${packet}'`
      )
      return null
    }

    const [userString, channelString, timeStringRaw, statusString] = parts
    const timeString = timeStringRaw.trim() // Remove leading/trailing spaces

    // Extract numeric userId, handling prefixes like 't0010' or '0003'
    const userIdMatch = userString.match(/\d+/)
    const userId = userIdMatch ? parseInt(userIdMatch[0]) : NaN
    const status = parseInt(statusString)

    if (isNaN(userId) || isNaN(status) || userId < 0 || status < 0) {
      console.debug(
        `ParsePacket: Failed to parse userId ('${userString}') or status ('${statusString}').`
      )
      return null
    }

    // Parse channel: 'C0M', 'C1M', 'c0', 'c1', 'RT', 'RTM', lub legacy 'M0', 'A0'
    let isManual = false
    let channelNumber = -1

    const normalizedChannel = channelString.toUpperCase()

    if (normalizedChannel === 'RT' || normalizedChannel === 'RTM') {
      // RT i RTM traktujemy jak c1
      channelNumber = 1
      isManual = true // RT = RTM = c1 = c1M
    } else if (/^[Cc]\d+[Mm]?$/.test(channelString)) {
      // C0, C0M, C1, C1M, c0, c1, c1M
      channelNumber = parseInt(channelString.match(/\d+/)[0])
      if (channelNumber === 1) {
        // c1 ma działać jak c1M
        isManual = true
      } else {
        isManual = channelString.toUpperCase().endsWith('M')
      }
    } else if (/^[MA]\d+$/.test(channelString)) {
      // Legacy M0, A0
      const channelMatch = channelString.match(/^([MA])(\d+)$/)
      isManual = channelMatch[1] === 'M'
      channelNumber = parseInt(channelMatch[2])
    } else {
      console.debug(`ParsePacket: Invalid channel format: '${channelString}'`)
      return null
    }

    // Parse time (absolute format: HH:MM:SS.FFFF or HH:MM:SS.FF or HH:MM:SS:FFFF, delta format: seconds.FFFF)
    const absoluteTimeRegex1 = /^\d{2}:\d{2}:\d{2}\.\d{2,4}$/ // 12:01:24.2050 or 12:01:24.85
    const absoluteTimeRegex2 = /^\d{2}:\d{2}:\d{2}:\d{4}$/ // 12:01:32:1250
    const deltaTimeRegex = /^\d{1,9}(\.\d{1,4})?$/

    let mode,
      absoluteTime = null,
      deltaTime = 0

    if (absoluteTimeRegex1.test(timeString)) {
      mode = TimeMode.ABSOLUTE
      const [time, ms] = timeString.split('.')
      const [hours, minutes, seconds] = time.split(':').map(Number)
      absoluteTime = new Date()
      // Pad ms to 4 digits if needed (e.g., "85" -> "8500", "8500" stays "8500")
      const msPadded = ms.padEnd(4, '0')
      absoluteTime.setHours(hours, minutes, seconds, parseInt(msPadded) / 10)
    } else if (absoluteTimeRegex2.test(timeString)) {
      mode = TimeMode.ABSOLUTE
      const parts = timeString.split(':')
      const hours = parseInt(parts[0])
      const minutes = parseInt(parts[1])
      const seconds = parseInt(parts[2])
      const ms = parseInt(parts[3])
      absoluteTime = new Date()
      absoluteTime.setHours(hours, minutes, seconds, ms / 10)
    } else if (deltaTimeRegex.test(timeString)) {
      mode = TimeMode.DELTA
      deltaTime = parseFloat(timeString)
      console.debug(
        `ParsePacket: Delta time parsing - raw: '${timeStringRaw}', trimmed: '${timeString}', parsed deltaTime: ${deltaTime}`
      )
    } else {
      console.debug(`ParsePacket: Invalid time format: '${timeString}'`)
      return null
    }

    console.log('ABSO', absoluteTime)
    console.log('DELT', deltaTime)

    // Special handling: Convert channel 1 ABSOLUTE time (HH:MM:SS.FF with 2 decimals) to DELTA time
    // This allows "c1M 00:00:05.77" to work as a finish signal with 5.77 seconds elapsed
    if (channelNumber === 1 && mode === TimeMode.ABSOLUTE) {
      // Check if it's in HH:MM:SS.FF format (2 decimals) by checking the original timeString
      const twoDecimalFormat = /^\d{2}:\d{2}:\d{2}\.\d{2}$/
      if (twoDecimalFormat.test(timeString)) {
        // Convert HH:MM:SS.FF to delta seconds
        const [time, ms] = timeString.split('.')
        const [hours, minutes, seconds] = time.split(':').map(Number)
        deltaTime = hours * 3600 + minutes * 60 + seconds + parseInt(ms) / 100
        mode = TimeMode.DELTA
        absoluteTime = null
        console.debug(
          `ParsePacket: Channel 1 with HH:MM:SS.FF format converted to DELTA time: ${deltaTime}s`
        )
      }
    }

    return {
      type: 'timing',
      userId,
      mode,
      channelNumber,
      isManual,
      absoluteTime,
      deltaTime,
      status,
      originalTimeString: timeString,
      originalChannelString: channelString,
    }
  }
}

export default ProtocolAlge
