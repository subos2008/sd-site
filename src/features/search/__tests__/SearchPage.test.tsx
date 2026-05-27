import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { mswServer } from '../../../test-setup'
import { createQueryClient } from '@/lib/query-client'
import { SearchPage } from '../pages/SearchPage'
import { initI18n } from '@/lib/i18n'

await initI18n()

describe('SearchPage', () => {
  it('renders profile cards from view_search', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/view_search', () =>
        HttpResponse.json({
          ok: true,
          next_cursor: null,
          cards: [
            {
              profile_id: '11111111-1111-4111-8111-111111111111',
              display_name: 'Lex',
              age: 26,
              city_display_name: 'London',
              distance_miles: 5.2,
              primary_photo_path: 'users/11111111-1111-4111-8111-111111111111/p.jpg',
              tagline: null,
              my_like_state: false,
            },
          ],
        }),
      ),
    )
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter>
          <SearchPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByText(/Lex, 26/)).toBeInTheDocument()
  })
})
