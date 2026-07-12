import { describe, expect, it } from 'vitest'
import { APP_CONFIG } from '../app-config'

describe('APP_CONFIG', () => {
  it('declares standard token costs as 10', () => {
    expect(APP_CONFIG.tokens.firstMessageCost).toBe(10)
    expect(APP_CONFIG.tokens.unlockAlbumCost).toBe(10)
    expect(APP_CONFIG.tokens.unlockReadReceiptsCost).toBe(10)
  })

  it('exposes three token packages', () => {
    expect(APP_CONFIG.payments.packages).toHaveLength(3)
  })

  it('uses faux payment provider by default', () => {
    expect(APP_CONFIG.payments.provider).toBe('faux')
  })
})

describe('APP_CONFIG.onboarding', () => {
  it('defines positive baby onboarding minimums', () => {
    expect(APP_CONFIG.onboarding.babyMinPhotos).toBeGreaterThan(0)
    expect(Number.isInteger(APP_CONFIG.onboarding.babyMinPhotos)).toBe(true)
    expect(APP_CONFIG.onboarding.babyMinBioChars).toBeGreaterThan(0)
    expect(Number.isInteger(APP_CONFIG.onboarding.babyMinBioChars)).toBe(true)
  })
})
