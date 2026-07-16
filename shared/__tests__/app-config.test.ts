import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

  // Client gates (APP_CONFIG) and the server invariant (complete_onboarding
  // reading app_config) must use the SAME thresholds. The DB values are seeded
  // from APP_CONFIG by `pnpm gen:config`. This asserts the committed seed
  // migration is in sync with APP_CONFIG.onboarding — if it fails, someone
  // edited app-config.ts without re-running `pnpm gen:config`, which would let
  // the client and server thresholds drift.
  it('is in sync with the generated app_config seed migration', () => {
    const seed = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260509000001_app_config_seed.sql'),
      'utf8',
    )
    const expected = JSON.stringify(APP_CONFIG.onboarding)
    expect(seed).toContain(`'onboarding', $cfg_onboarding$${expected}$cfg_onboarding$`)
  })
})
