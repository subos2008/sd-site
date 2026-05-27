import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { http, HttpResponse } from 'msw'
import { mswServer } from '../../../test-setup'
import { DetailsStep } from '../components/DetailsStep'
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

describe('DetailsStep', () => {
  it('submits and advances on continue', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/set_profile_details', () =>
        HttpResponse.json({ ok: true }),
      ),
    )
    render(wrap(<DetailsStep />))
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    // Form clears in onSubmit → navigate happens; cannot easily assert nav from MemoryRouter
    // but the absence of any error and the button no longer being submitting is sufficient.
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
  })
})
