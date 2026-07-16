import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { mswServer } from '../../../test-setup'
import { createQueryClient } from '@/lib/query-client'
import { initI18n } from '@/lib/i18n'
import type { ReactNode } from 'react'
import { BioStep } from '../components/BioStep'

await initI18n()

function wrap(ui: ReactNode) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={['/onboarding/bio']}>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('BioStep', () => {
  it('keeps Continue disabled until tagline and both bio fields meet the minimum', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/view_my_profile', () =>
        HttpResponse.json({
          ok: true,
          profile: {
            profile_id: '00000000-0000-4000-8000-000000000003',
            role: 'baby', status: 'pending_onboarding',
            display_name: 'B', age: 25, date_of_birth: '1999-01-01',
            gender: 'female', looking_for: 'male', city_display_name: 'London',
            tagline: null, about: null, wants: null,
            height_cm: null, body_type: null, hair_color: null, eye_color: null,
            has_piercings: null, has_tattoos: null, smoking: null, drinking: null,
            education: null, yearly_income_band: null, net_worth_band: null,
            token_balance: 0, photos: [], interests: [],
          },
        }),
      ),
    )
    render(wrap(<BioStep />))
    const continueBtn = await screen.findByRole('button', { name: /continue/i })
    expect(continueBtn).toBeDisabled()

    await userEvent.type(screen.getByLabelText(/your tagline/i), 'Curious and kind')
    await userEvent.type(
      screen.getByLabelText(/what do you have to offer/i),
      'Genuine company, real conversation and a warm, easy presence for a generous partner.',
    )
    // Still disabled: wants is empty.
    expect(continueBtn).toBeDisabled()

    await userEvent.type(
      screen.getByLabelText(/what are you looking for/i),
      'A respectful, established partner who values discretion, kindness and time together.',
    )
    expect(continueBtn).toBeEnabled()
  })
})
