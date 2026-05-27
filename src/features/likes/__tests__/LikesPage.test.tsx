import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { mswServer } from '../../../test-setup'
import { LikesPage } from '../pages/LikesPage'
import { createQueryClient } from '@/lib/query-client'
import { initI18n } from '@/lib/i18n'

await initI18n()

describe('LikesPage', () => {
  it('renders empty states when both lists are empty', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/view_likes_tab', () =>
        HttpResponse.json({ ok: true, liked_me: [], favourites: [] }),
      ),
    )
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter>
          <LikesPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByText(/nobody has liked you yet/i)).toBeInTheDocument()
    expect(screen.getByText(/you haven't liked anyone yet/i)).toBeInTheDocument()
  })
})
