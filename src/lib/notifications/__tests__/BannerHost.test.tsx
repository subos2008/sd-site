import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { mswServer } from '../../../test-setup'
import { BannerHost } from '../BannerHost'
import { initI18n } from '@/lib/i18n'

await initI18n()

describe('BannerHost', () => {
  it('renders a banner when a like notification arrives', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/view_notifications', () =>
        HttpResponse.json({
          ok: true,
          notifications: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              kind: 'like',
              payload: {
                actor_id: '22222222-2222-4222-8222-222222222222',
                actor_name: 'Alex',
              },
              created_at: '2026-05-14T12:00:00Z',
              read_at: null,
            },
          ],
          next_cursor: null,
        }),
      ),
    )
    render(
      <QueryClientProvider client={new QueryClient()}>
        <BannerHost />
      </QueryClientProvider>,
    )
    expect(await screen.findByText(/Alex liked your profile/i)).toBeInTheDocument()
  })
})
