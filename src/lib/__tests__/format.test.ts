import { describe, expect, it } from 'vitest'
import { formatDistance } from '../format'

describe('formatDistance', () => {
  it('uses miles for en-GB', () => { expect(formatDistance(10, 'en-GB')).toBe('10 mi') })
  it('uses km elsewhere',     () => { expect(formatDistance(10, 'fr-FR')).toBe('16 km') })
  it('blank for null',        () => { expect(formatDistance(null, 'en-GB')).toBe('') })
})
