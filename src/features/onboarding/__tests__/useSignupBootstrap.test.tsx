import { describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { Session } from '@supabase/supabase-js'
import { mswServer } from '../../../test-setup'
import { useSignupBootstrap } from '../useSignupBootstrap'
import { AuthContext } from '@/lib/auth-context'
import { createQueryClient } from '@/lib/query-client'
import type { ReactNode } from 'react'

function baseProfile(overrides: {
  body_type: string | null
  ethnicity: string | null
  city_display_name?: string | null
}) {
  return {
    profile_id: '00000000-0000-4000-8000-000000000003',
    role: 'baby', status: 'pending_onboarding',
    display_name: 'B', age: 25, date_of_birth: '1999-01-01',
    gender: 'female', looking_for: 'male',
    city_display_name: overrides.city_display_name === undefined ? 'London' : overrides.city_display_name,
    tagline: null, about: null, wants: null,
    height_cm: null, body_type: overrides.body_type, ethnicity: overrides.ethnicity,
    hair_color: null, eye_color: null,
    has_piercings: null, has_tattoos: null, smoking: null, drinking: null,
    education: null, yearly_income_band: null, net_worth_band: null,
    token_balance: 0, photos: [], interests: [],
  }
}

function mockViewMyProfile(overrides: {
  body_type: string | null
  ethnicity: string | null
  city_display_name?: string | null
}) {
  mswServer.use(
    http.post('http://127.0.0.1:54321/rest/v1/rpc/view_my_profile', () =>
      HttpResponse.json({ ok: true, profile: baseProfile(overrides) }),
    ),
  )
}

function wrap(meta: Record<string, unknown>) {
  const session = { user: { id: 'u1', user_metadata: meta } } as unknown as Session
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={createQueryClient()}>
        <AuthContext.Provider value={{ status: 'authenticated', session }}>
          {children}
        </AuthContext.Provider>
      </QueryClientProvider>
    )
  }
  return Wrapper
}

describe('useSignupBootstrap', () => {
  it('commits body_type + ethnicity from metadata via set_profile_details', async () => {
    let body: unknown = null
    mockViewMyProfile({ body_type: null, ethnicity: null })
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/set_profile_details', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ ok: true })
      }),
    )
    renderHook(() => useSignupBootstrap(), { wrapper: wrap({ body_type: 'curvy', ethnicity: 'asian' }) })
    await waitFor(() => expect(body).not.toBeNull())
    expect(body).toMatchObject({ p_body_type: 'curvy', p_ethnicity: 'asian' })
  })

  it('does nothing when metadata has no captured fields', async () => {
    let called = false
    mockViewMyProfile({ body_type: null, ethnicity: null })
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/set_profile_details', () => {
        called = true
        return HttpResponse.json({ ok: true })
      }),
    )
    renderHook(() => useSignupBootstrap(), { wrapper: wrap({}) })
    await new Promise((r) => setTimeout(r, 50))
    expect(called).toBe(false)
  })

  it('skips the commit when the profile already has body_type/ethnicity set', async () => {
    let called = false
    mockViewMyProfile({ body_type: 'athletic', ethnicity: 'white' })
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/set_profile_details', () => {
        called = true
        return HttpResponse.json({ ok: true })
      }),
    )
    renderHook(() => useSignupBootstrap(), { wrapper: wrap({ body_type: 'curvy', ethnicity: 'asian' }) })
    await new Promise((r) => setTimeout(r, 50))
    expect(called).toBe(false)
  })

  it('commits the signup place_id via set_profile_location when the profile has no location', async () => {
    let body: unknown = null
    mockViewMyProfile({ body_type: null, ethnicity: null, city_display_name: null })
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/set_profile_location', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ ok: true })
      }),
    )
    renderHook(() => useSignupBootstrap(), { wrapper: wrap({ place_id: 2643743, city: 'London' }) })
    await waitFor(() => expect(body).not.toBeNull())
    expect(body).toEqual({ p_place_id: 2643743 })
  })

  it('skips the location commit when the profile already has a location', async () => {
    let called = false
    mockViewMyProfile({ body_type: null, ethnicity: null, city_display_name: 'Manchester' })
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/set_profile_location', () => {
        called = true
        return HttpResponse.json({ ok: true })
      }),
    )
    renderHook(() => useSignupBootstrap(), { wrapper: wrap({ place_id: 2643743, city: 'London' }) })
    await new Promise((r) => setTimeout(r, 50))
    expect(called).toBe(false)
  })
})
