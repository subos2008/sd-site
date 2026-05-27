import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { mswServer } from '../../../test-setup'
import { createQueryClient } from '@/lib/query-client'
import { ProfilePage } from '../pages/ProfilePage'
import { initI18n } from '@/lib/i18n'

await initI18n()

describe('ProfilePage', () => {
  it('renders a profile from view_profile', async () => {
    const id = '22222222-2222-4222-8222-222222222222'
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/view_profile', () =>
        HttpResponse.json({
          ok: true,
          profile: {
            profile_id: id,
            display_name: 'Casey',
            age: 28,
            city_display_name: 'Bristol',
            gender: 'female',
            looking_for: 'male',
            tagline: null,
            about: null,
            wants: null,
            height_cm: null,
            body_type: null,
            hair_color: null,
            eye_color: null,
            has_piercings: null,
            has_tattoos: null,
            smoking: null,
            drinking: null,
            education: null,
            yearly_income_band: null,
            net_worth_band: null,
            photos: [],
            interests: [],
            my_like_state: false,
            their_like_state: false,
          },
        }),
      ),
    )
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={[`/profile/${id}`]}>
          <Routes><Route path="/profile/:id" element={<ProfilePage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByText(/Casey/)).toBeInTheDocument()
  })
})
