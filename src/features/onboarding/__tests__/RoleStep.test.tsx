import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { http, HttpResponse } from 'msw'
import type { Session } from '@supabase/supabase-js'
import { mswServer } from '../../../test-setup'
import { RoleStep } from '../components/RoleStep'
import { AuthContext } from '@/lib/auth-context'
import { createQueryClient } from '@/lib/query-client'
import { initI18n } from '@/lib/i18n'

await initI18n()

function sessionWith(meta: Record<string, unknown>): Session {
  return { user: { id: 'u1', user_metadata: meta } } as unknown as Session
}

function renderStep(meta: Record<string, unknown>) {
  const router = createMemoryRouter(
    [
      { path: '/onboarding/role', element: <RoleStep /> },
      { path: '/onboarding/identity', element: <p>identity step</p> },
    ],
    { initialEntries: ['/onboarding/role'] },
  )
  render(
    <QueryClientProvider client={createQueryClient()}>
      <AuthContext.Provider value={{ status: 'authenticated', session: sessionWith(meta) }}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('RoleStep', () => {
  it('auto-commits a signup role hint and skips to identity', async () => {
    let calledWith: unknown = null
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/set_profile_role', async ({ request }) => {
        calledWith = await request.json()
        return HttpResponse.json({ ok: true })
      }),
    )
    renderStep({ role_hint: 'baby' })
    expect(await screen.findByText(/identity step/i)).toBeInTheDocument()
    expect(calledWith).toEqual({ p_role: 'baby' })
  })

  it('falls back to the chooser when the hint cannot be committed', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/set_profile_role', () =>
        HttpResponse.json({ ok: false, error: 'role_already_set' }),
      ),
    )
    renderStep({ role_hint: 'benefactor' })
    expect(await screen.findByRole('button', { name: /benefactor/i })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/role_already_set/)
  })

  it('shows the chooser when no hint exists', async () => {
    renderStep({})
    expect(await screen.findByRole('button', { name: /baby/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /benefactor/i })).toBeInTheDocument()
  })

  it('ignores an invalid hint value', async () => {
    renderStep({ role_hint: 'admin' })
    expect(await screen.findByRole('button', { name: /benefactor/i })).toBeInTheDocument()
  })
})
