import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { QueryClientProvider } from '@tanstack/react-query'
import { mswServer } from '../../../../test-setup'
import { createQueryClient } from '@/lib/query-client'
import { initI18n } from '@/lib/i18n'
import { LikeButton } from '../LikeButton'

await initI18n()

function wrap(ui: React.ReactNode) {
  return <QueryClientProvider client={createQueryClient()}>{ui}</QueryClientProvider>
}

describe('LikeButton', () => {
  it('renders Like with aria-pressed=false when not liked', () => {
    render(wrap(<LikeButton profileId="11111111-1111-4111-8111-111111111111" liked={false} />))
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(btn).toHaveTextContent(/like/i)
  })

  it('calls like_profile RPC on click when not liked', async () => {
    let called = false
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/like_profile', () => {
        called = true
        return HttpResponse.json({ ok: true })
      }),
    )
    render(wrap(<LikeButton profileId="11111111-1111-4111-8111-111111111111" liked={false} />))
    await userEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(called).toBe(true))
  })
})
