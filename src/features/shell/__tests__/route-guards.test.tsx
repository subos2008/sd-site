// Approach: shallow-render the RequireOnboarded guard in isolation inside a
// MemoryRouter with stub target routes, and mock the two dependencies it
// touches: `useSession` from @/lib/auth and `viewMyProfile` from
// @/features/onboarding/api. This sidesteps having to mock the Supabase auth
// endpoint or set up MSW; we only assert the redirect *behavior*.
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@/lib/auth-context', async () => {
  return { useSession: vi.fn() }
})

vi.mock('@/features/onboarding/api', async () => {
  return { viewMyProfile: vi.fn() }
})

import { useSession } from '@/lib/auth-context'
import { viewMyProfile } from '@/features/onboarding/api'
import { RequireOnboarded } from '@/lib/route-guards'

const useSessionMock = vi.mocked(useSession)
const viewMyProfileMock = vi.mocked(viewMyProfile)

function renderInRouter(initial: string, ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route element={ui}>
            <Route path="/search" element={<div>Search Page</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/onboarding/role" element={<div>Onboarding Role</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('RequireOnboarded', () => {
  it('redirects anonymous to /login', async () => {
    useSessionMock.mockReturnValue({ status: 'anonymous', session: null })
    renderInRouter('/search', <RequireOnboarded />)
    expect(await screen.findByText('Login Page')).toBeInTheDocument()
  })

  it('redirects pending_onboarding users to /onboarding/role', async () => {
    useSessionMock.mockReturnValue({
      status: 'authenticated',
      session: { user: { id: 'x' } } as never,
    })
    viewMyProfileMock.mockResolvedValue({
      ok: true,
      profile: {
        profile_id: '00000000-0000-0000-0000-000000000001',
        role: null,
        status: 'pending_onboarding',
        display_name: null,
        age: null,
        date_of_birth: null,
        gender: null,
        looking_for: null,
        city_display_name: null,
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
        token_balance: 0,
        photos: [],
        interests: [],
      },
    })
    renderInRouter('/search', <RequireOnboarded />)
    expect(await screen.findByText('Onboarding Role')).toBeInTheDocument()
  })
})
