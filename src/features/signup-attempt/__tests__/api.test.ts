import { describe, expect, it } from 'vitest'
import { recordSignupAttempt } from '../api'

describe('recordSignupAttempt', () => {
  it('never throws (fire-and-forget)', () => {
    expect(() =>
      recordSignupAttempt({ role: 'baby', city: 'London', age: 22, acquisition_source: null }),
    ).not.toThrow()
  })
})
