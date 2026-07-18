import { describe, expect, it } from 'vitest'
import { formatDistance } from '../format'

describe('formatDistance', () => {
  it('uses approx miles for en-GB', () => { expect(formatDistance(10, 'en-GB')).toBe('~10 mi') })
  it('uses approx km elsewhere',    () => { expect(formatDistance(10, 'fr-FR')).toBe('~16 km') })
  it('blank for null',              () => { expect(formatDistance(null, 'en-GB')).toBe('') })
  it('blank for overlapping (0)',   () => { expect(formatDistance(0, 'en-GB')).toBe('') })
  it('never rounds below ~1',       () => { expect(formatDistance(0.4, 'en-GB')).toBe('~1 mi') })
})
