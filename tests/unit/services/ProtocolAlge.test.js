import { describe, it, expect } from 'vitest'
import { ProtocolAlge, TimeMode } from '@services/serial/ProtocolAlge'

describe('ProtocolAlge', () => {
  describe('parsePacket - Control Commands', () => {
    it('should parse control command n1', () => {
      const result = ProtocolAlge.parsePacket('n1')
      expect(result).toBeDefined()
      expect(result.type).toBe('control')
      expect(result.command).toBe('n1')
    })

    it('should parse control command n2', () => {
      const result = ProtocolAlge.parsePacket('n2')
      expect(result).toBeDefined()
      expect(result.type).toBe('control')
      expect(result.command).toBe('n2')
    })
  })

  describe('parsePacket - Absolute Time Format', () => {
    it('should parse absolute time HH:MM:SS.FFFF format', () => {
      const result = ProtocolAlge.parsePacket('0 C0M 12:34:56.7890 0')

      expect(result).toBeDefined()
      expect(result.type).toBe('timing')
      expect(result.mode).toBe(TimeMode.ABSOLUTE)
      expect(result.channelNumber).toBe(0)
      expect(result.isManual).toBe(true)
      expect(result.userId).toBe(0)
      expect(result.status).toBe(0)
      expect(result.absoluteTime).toBeInstanceOf(Date)
    })

    it('should parse absolute time HH:MM:SS.FF format', () => {
      const result = ProtocolAlge.parsePacket('0 C0M 12:34:56.85 0')

      expect(result).toBeDefined()
      expect(result.mode).toBe(TimeMode.ABSOLUTE)
      expect(result.absoluteTime).toBeInstanceOf(Date)
    })

    it('should parse absolute time HH:MM:SS:FFFF format (colon separator)', () => {
      const result = ProtocolAlge.parsePacket('0 C0M 12:01:32:1250 0')

      expect(result).toBeDefined()
      expect(result.mode).toBe(TimeMode.ABSOLUTE)
      expect(result.absoluteTime).toBeInstanceOf(Date)
    })
  })

  describe('parsePacket - Delta Time Format', () => {
    it('should parse delta time with decimals', () => {
      const result = ProtocolAlge.parsePacket('0 C1M 45.67 0')

      expect(result).toBeDefined()
      expect(result.type).toBe('timing')
      expect(result.mode).toBe(TimeMode.DELTA)
      expect(result.deltaTime).toBe(45.67)
      expect(result.channelNumber).toBe(1)
    })

    it('should parse delta time without decimals', () => {
      const result = ProtocolAlge.parsePacket('0 C1M 30 0')

      expect(result).toBeDefined()
      expect(result.mode).toBe(TimeMode.DELTA)
      expect(result.deltaTime).toBe(30)
    })

    it('should parse delta time with 4 decimal places', () => {
      const result = ProtocolAlge.parsePacket('0 C1M 12.3456 0')

      expect(result).toBeDefined()
      expect(result.mode).toBe(TimeMode.DELTA)
      expect(result.deltaTime).toBe(12.3456)
    })
  })

  describe('parsePacket - Channel Formats', () => {
    it('should parse C0M channel format', () => {
      const result = ProtocolAlge.parsePacket('0 C0M 12:34:56.7890 0')

      expect(result.channelNumber).toBe(0)
      expect(result.isManual).toBe(true)
    })

    it('should parse C1M channel format', () => {
      const result = ProtocolAlge.parsePacket('0 C1M 45.67 0')

      expect(result.channelNumber).toBe(1)
      expect(result.isManual).toBe(true)
    })

    it('should parse c0 lowercase channel format', () => {
      const result = ProtocolAlge.parsePacket('0 c0 12:34:56.7890 0')

      expect(result.channelNumber).toBe(0)
      expect(result.isManual).toBe(false)
    })

    it('should parse c1 lowercase channel format as manual', () => {
      const result = ProtocolAlge.parsePacket('0 c1 45.67 0')

      expect(result.channelNumber).toBe(1)
      expect(result.isManual).toBe(true) // c1 always treated as manual
    })

    it('should parse RT signal as channel 1', () => {
      const result = ProtocolAlge.parsePacket('0 RT 45.67 0')

      expect(result.channelNumber).toBe(1)
      expect(result.isManual).toBe(true)
    })

    it('should parse RTM signal as channel 1', () => {
      const result = ProtocolAlge.parsePacket('0 RTM 45.67 0')

      expect(result.channelNumber).toBe(1)
      expect(result.isManual).toBe(true)
    })

    it('should parse legacy M0 format', () => {
      const result = ProtocolAlge.parsePacket('0 M0 12:34:56.7890 0')

      expect(result.channelNumber).toBe(0)
      expect(result.isManual).toBe(true)
    })

    it('should parse legacy A0 format', () => {
      const result = ProtocolAlge.parsePacket('0 A0 12:34:56.7890 0')

      expect(result.channelNumber).toBe(0)
      expect(result.isManual).toBe(false)
    })
  })

  describe('parsePacket - Channel 1 Special Handling', () => {
    it('should convert channel 1 HH:MM:SS.FF format to delta time', () => {
      const result = ProtocolAlge.parsePacket('0 C1M 00:00:05.77 0')

      expect(result).toBeDefined()
      expect(result.mode).toBe(TimeMode.DELTA)
      expect(result.deltaTime).toBe(5.77)
      expect(result.absoluteTime).toBeNull()
    })

    it('should NOT convert channel 1 HH:MM:SS.FFFF format to delta', () => {
      const result = ProtocolAlge.parsePacket('0 C1M 00:00:05.7700 0')

      expect(result).toBeDefined()
      expect(result.mode).toBe(TimeMode.ABSOLUTE)
      expect(result.absoluteTime).toBeInstanceOf(Date)
    })
  })

  describe('parsePacket - Invalid Packets', () => {
    it('should return null for null packet', () => {
      const result = ProtocolAlge.parsePacket(null)
      expect(result).toBeNull()
    })

    it('should return null for undefined packet', () => {
      const result = ProtocolAlge.parsePacket(undefined)
      expect(result).toBeNull()
    })

    it('should return null for non-string packet', () => {
      const result = ProtocolAlge.parsePacket(12345)
      expect(result).toBeNull()
    })

    it('should return null for packet with wrong number of parts', () => {
      const result = ProtocolAlge.parsePacket('0 C0M')
      expect(result).toBeNull()
    })

    it('should return null for invalid channel format', () => {
      const result = ProtocolAlge.parsePacket('0 INVALID 12:34:56.7890 0')
      expect(result).toBeNull()
    })

    it('should return null for invalid time format', () => {
      const result = ProtocolAlge.parsePacket('0 C0M invalid_time 0')
      expect(result).toBeNull()
    })

    it('should return null for invalid userId', () => {
      const result = ProtocolAlge.parsePacket('abc C0M 12:34:56.7890 0')
      expect(result).toBeNull()
    })

    it('should return null for invalid status', () => {
      const result = ProtocolAlge.parsePacket('0 C0M 12:34:56.7890 abc')
      expect(result).toBeNull()
    })
  })

  describe('parsePacket - Edge Cases', () => {
    it('should handle packet with extra whitespace', () => {
      const result = ProtocolAlge.parsePacket('  0   C0M   12:34:56.7890   0  ')

      expect(result).toBeDefined()
      expect(result.type).toBe('timing')
    })

    it('should parse long elapsed time (over 1 minute)', () => {
      const result = ProtocolAlge.parsePacket('0 C1M 123.45 0')

      expect(result).toBeDefined()
      expect(result.deltaTime).toBe(123.45)
    })

    it('should parse very precise time (4 decimals)', () => {
      const result = ProtocolAlge.parsePacket('0 C1M 12.3456 0')

      expect(result).toBeDefined()
      expect(result.deltaTime).toBe(12.3456)
    })
  })
})
