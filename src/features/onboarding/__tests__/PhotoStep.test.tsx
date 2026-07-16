import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { mswServer } from '../../../test-setup'
import { createQueryClient } from '@/lib/query-client'
import { initI18n } from '@/lib/i18n'
import type { ReactNode } from 'react'
import { PhotoStep } from '../components/PhotoStep'

await initI18n()

function profile(overrides: Record<string, unknown>) {
  return {
    ok: true,
    profile: {
      profile_id: '00000000-0000-4000-8000-000000000002',
      role: 'baby', status: 'pending_onboarding',
      display_name: 'B', age: 25, date_of_birth: '1999-01-01',
      gender: 'female', looking_for: 'male', city_display_name: 'London',
      tagline: null, about: null, wants: null,
      height_cm: null, body_type: null, hair_color: null, eye_color: null,
      has_piercings: null, has_tattoos: null, smoking: null, drinking: null,
      education: null, yearly_income_band: null, net_worth_band: null,
      token_balance: 0, photos: [], interests: [],
      ...overrides,
    },
  }
}

function wrap(ui: ReactNode) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={['/onboarding/photo']}>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('PhotoStep (baby)', () => {
  it('gates Continue until the photo minimum is met', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/view_my_profile', () =>
        HttpResponse.json(profile({ photos: [] })),
      ),
    )
    render(wrap(<PhotoStep />))
    // Continue is disabled with zero photos (min is 3).
    expect(await screen.findByRole('button', { name: /continue/i })).toBeDisabled()
  })

  it('enables Continue when the minimum is met', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/view_my_profile', () =>
        HttpResponse.json(profile({
          photos: [
            { ordinal: 0, path: 'a', media_item_id: '00000000-0000-4000-8000-0000000000a1' },
            { ordinal: 1, path: 'b', media_item_id: '00000000-0000-4000-8000-0000000000a2' },
            { ordinal: 2, path: 'c', media_item_id: '00000000-0000-4000-8000-0000000000a3' },
          ],
        })),
      ),
    )
    render(wrap(<PhotoStep />))
    expect(await screen.findByRole('button', { name: /continue/i })).toBeEnabled()
  })
})

describe('PhotoStep (benefactor)', () => {
  it('shows a skip option', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/view_my_profile', () =>
        HttpResponse.json(profile({ role: 'benefactor', photos: [] })),
      ),
    )
    render(wrap(<PhotoStep />))
    expect(await screen.findByRole('button', { name: /skip for now/i })).toBeInTheDocument()
  })
})
