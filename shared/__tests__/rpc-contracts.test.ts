import { describe, expect, it } from 'vitest'
import {
  SetProfileRoleResult,
  ViewSearchResult,
  ProfileCard,
  ListInterestsResult,
  ViewLikesTabResult,
  ViewSearchResultV2,
  ViewNotificationsResult,
  ProfileCardV2,
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

describe('rpc-contracts plan 03', () => {
  it('parses a ProfileCardV2 with my_like_state', () => {
    const parsed = ProfileCardV2.parse({
      profile_id: '11111111-1111-4111-8111-111111111111',
      display_name: 'Lex', age: 26, city_display_name: 'London',
      distance_miles: 5.2, primary_photo_path: 'users/x/p.jpg',
      tagline: 'Adventurer',
      my_like_state: false,
    })
    expect(parsed.my_like_state).toBe(false)
  })

  it('parses a view_likes_tab response', () => {
    const parsed = ViewLikesTabResult.parse({
      ok: true,
      liked_me: [],
      favourites: [],
    })
    expect(parsed.ok).toBe(true)
  })

  it('parses a view_search v2 response with filters', () => {
    const parsed = ViewSearchResultV2.parse({
      ok: true,
      cards: [],
      next_cursor: null,
    })
    expect(parsed.ok).toBe(true)
  })

  it('parses an interest', () => {
    const parsed = ListInterestsResult.parse({
      ok: true,
      interests: [{ id: '22222222-2222-4222-8222-222222222222', label_key: 'interest.hiking', category: 'activities', ordinal: 10 }],
    })
    expect(parsed.ok).toBe(true)
  })

  it('parses a notification', () => {
    const parsed = ViewNotificationsResult.parse({
      ok: true,
      notifications: [{
        id: '33333333-3333-4333-8333-333333333333',
        kind: 'like',
        payload: { actor_id: '44444444-4444-4444-8444-444444444444' },
        created_at: '2026-05-14T12:00:00Z',
        read_at: null,
      }],
      next_cursor: null,
    })
    expect(parsed.ok).toBe(true)
  })
})
