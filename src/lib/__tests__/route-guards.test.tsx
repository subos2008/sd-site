import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { http, HttpResponse } from 'msw'
import type { Session } from '@supabase/supabase-js'
import { mswServer } from '../../test-setup'
import { RootRedirect } from '../route-guards'
import { AuthContext } from '../auth-context'
import { supabase } from '../supabase'
import { createQueryClient } from '../query-client'
import { initI18n } from '../i18n'

await initI18n()

const session = { user: { id: 'u1', user_metadata: {} } } as unknown as Session

function renderRoot(status: 'authenticated' | 'anonymous') {
  const router = createMemoryRouter([{ path: '/', element: <RootRedirect /> }], {
    initialEntries: ['/'],
  })
  render(
    <QueryClientProvider client={createQueryClient()}>
      <AuthContext.Provider
        value={{ status, session: status === 'authenticated' ? session : null }}
      >
        <RouterProvider router={router} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('RootRedirect', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the landing page for anonymous visitors', async () => {
    renderRoot('anonymous')
    expect(
      await screen.findByRole('heading', { level: 1, name: /sugar daddy/i }),
    ).toBeInTheDocument()
  })

  it('signs out a session whose profile no longer exists instead of looping to /login', async () => {
    const signOut = vi.spyOn(supabase.auth, 'signOut').mockResolvedValue({ error: null })
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/view_my_profile', () =>
        HttpResponse.json({ ok: false, error: 'not_found' }),
      ),
    )
    renderRoot('authenticated')
    await waitFor(() => expect(signOut).toHaveBeenCalled())
  })
})
