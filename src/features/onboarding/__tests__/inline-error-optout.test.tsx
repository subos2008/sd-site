import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { http, HttpResponse } from 'msw'
import { mswServer } from '../../../test-setup'
import { createQueryClient } from '@/lib/query-client'
import { initI18n } from '@/lib/i18n'
import { clear } from '@/lib/errors/error-bus'
import { ErrorToastHost } from '@/lib/errors/ErrorToastHost'
import { RoleStep } from '../components/RoleStep'
import type { ReactNode } from 'react'

await initI18n()

function wrap(ui: ReactNode) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        {ui}
        <ErrorToastHost />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('inline-handled onboarding mutations opt out of the global toast', () => {
  beforeEach(() => clear())

  it('shows the inline error but no global toast when set_profile_role fails', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/set_profile_role', () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )
    render(wrap(<RoleStep />))
    await userEvent.click(screen.getByRole('button', { name: /benefactor/i }))
    // Inline error appears (RoleStep sets serverError from the thrown message).
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    // The global toast's distinctive transport line must NOT be present.
    expect(screen.queryByText(/\/rest\/v1\/rpc\/set_profile_role/)).toBeNull()
  })
})
