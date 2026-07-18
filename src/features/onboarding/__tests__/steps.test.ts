import { describe, it, expect } from 'vitest'
import { stepsForRole, nextStepPath } from '../steps'

describe('onboarding step sequences', () => {
  it('benefactor path skips bio/details/interests', () => {
    expect(stepsForRole('benefactor')).toEqual([
      'role', 'identity', 'photo', 'complete',
    ])
  })

  it('baby path includes bio/details/interests', () => {
    expect(stepsForRole('baby')).toEqual([
      'role', 'identity', 'photo', 'bio', 'details', 'interests', 'complete',
    ])
  })

  it('routes identity straight to photo (location is captured at signup)', () => {
    expect(nextStepPath('baby', 'identity')).toBe('/onboarding/photo')
  })

  it('routes benefactor from photo straight to complete', () => {
    expect(nextStepPath('benefactor', 'photo')).toBe('/onboarding/complete')
  })

  it('routes baby from photo to bio', () => {
    expect(nextStepPath('baby', 'photo')).toBe('/onboarding/bio')
  })

  it('routes baby from bio to details', () => {
    expect(nextStepPath('baby', 'bio')).toBe('/onboarding/details')
  })

  it('falls back to complete for an out-of-sequence step', () => {
    // A benefactor never has a bio step; if they land there, push forward.
    expect(nextStepPath('benefactor', 'bio')).toBe('/onboarding/complete')
  })
})
