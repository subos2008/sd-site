import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { http, HttpResponse } from 'msw'
import { mswServer } from '../../../test-setup'
import { IdentityStep } from '../components/IdentityStep'
import { createQueryClient } from '@/lib/query-client'
import { initI18n } from '@/lib/i18n'
import type { ReactNode } from 'react'

await initI18n()

function wrap(ui: ReactNode) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('IdentityStep', () => {
  it('disables Continue when DOB indicates under 18', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/view_my_profile', () =>
        HttpResponse.json({
          ok: true,
          profile: {
            profile_id: '00000000-0000-4000-8000-000000000001',
            role: 'benefactor', status: 'pending_onboarding',
            display_name: null, age: null, date_of_birth: null,
            gender: null, looking_for: null, city_display_name: null,
            tagline: null, about: null, wants: null,
            height_cm: null, body_type: null, hair_color: null, eye_color: null,
            has_piercings: null, has_tattoos: null, smoking: null, drinking: null,
            education: null, yearly_income_band: null, net_worth_band: null,
            token_balance: 0, photos: [], interests: [],
          },
        }),
      ),
    )
    render(wrap(<IdentityStep />))
    await userEvent.type(screen.getByLabelText(/display name/i), 'Lex')
    const dob = new Date()
    dob.setFullYear(dob.getFullYear() - 17)
    const iso = dob.toISOString().slice(0, 10)
    const dobInput = screen.getByLabelText(/date of birth/i) as HTMLInputElement
    await userEvent.clear(dobInput)
    await userEvent.type(dobInput, iso)
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })
})
