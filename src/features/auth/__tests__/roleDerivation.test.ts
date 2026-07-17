import { describe, expect, it } from 'vitest'
import { identityForRole } from '../roleDerivation'

describe('identityForRole', () => {
  it('maps baby to a woman seeking men', () => {
    expect(identityForRole('baby')).toEqual({ gender: 'female', looking_for: 'male' })
  })
  it('maps benefactor to a man seeking women', () => {
    expect(identityForRole('benefactor')).toEqual({ gender: 'male', looking_for: 'female' })
  })
})
