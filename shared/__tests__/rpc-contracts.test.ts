import { describe, expect, it } from 'vitest'
import {
  SetProfileRoleResult,
  ViewSearchResult,
  ProfileCard,
} from '../rpc-contracts'

describe('rpc-contracts', () => {
  it('parses an ok=true onboarding result', () => {
    const parsed = SetProfileRoleResult.parse({ ok: true })
    expect(parsed.ok).toBe(true)
  })

  it('parses an ok=false onboarding error', () => {
    const parsed = SetProfileRoleResult.parse({ ok: false, error: 'role_already_set' })
    expect(parsed.ok).toBe(false)
  })

  it('parses a view_search response with cards', () => {
    const parsed = ViewSearchResult.parse({
      ok: true,
      cards: [
        {
          profile_id: '11111111-1111-4111-8111-111111111111',
          display_name: 'Lex',
          age: 26,
          city_display_name: 'London',
          distance_miles: 12.3,
          primary_photo_path: 'users/11111111-1111-4111-8111-111111111111/p.jpg',
          my_like_state: null,
        },
      ],
      next_cursor: null,
    })
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.cards).toHaveLength(1)
    }
  })

  it('rejects a ProfileCard missing required fields', () => {
    expect(() => ProfileCard.parse({ profile_id: 'x' })).toThrow()
  })
})
