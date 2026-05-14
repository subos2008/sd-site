import { describe, expect, it } from 'vitest'
import { ageFromDob, isAdult } from '../dob'

describe('dob', () => {
  const now = new Date('2026-05-12T00:00:00Z')

  it('computes age', () => {
    expect(ageFromDob(new Date('1990-01-01'), now)).toBe(36)
  })

  it('treats today-of-birthday as that age (not yet)', () => {
    expect(ageFromDob(new Date('2008-05-12'), now)).toBe(18)
  })

  it('treats day-before-birthday as still previous age', () => {
    expect(ageFromDob(new Date('2008-05-13'), now)).toBe(17)
  })

  it('isAdult is true at 18, false at 17', () => {
    expect(isAdult(new Date('2008-05-12'), 18, now)).toBe(true)
    expect(isAdult(new Date('2008-05-13'), 18, now)).toBe(false)
  })
})
