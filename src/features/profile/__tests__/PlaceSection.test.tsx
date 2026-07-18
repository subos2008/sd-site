import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { mswServer } from '../../../test-setup'
import { PlaceSection } from '../components/PlaceSection'
import { createQueryClient } from '@/lib/query-client'
import { initI18n } from '@/lib/i18n'
import type { ReactNode } from 'react'

await initI18n()

const RPC = 'http://127.0.0.1:54321/rest/v1/rpc'

function wrap(ui: ReactNode) {
  return <QueryClientProvider client={createQueryClient()}>{ui}</QueryClientProvider>
}

describe('PlaceSection', () => {
  it('shows the current city and saves a newly picked place', async () => {
    let calledWith: unknown = null
    mswServer.use(
      http.post(`${RPC}/search_places`, () =>
        HttpResponse.json({
          ok: true,
          places: [{ id: 2643123, name: 'Manchester', display_name: 'Manchester, Greater Manchester' }],
        }),
      ),
      http.post(`${RPC}/set_profile_location`, async ({ request }) => {
        calledWith = await request.json()
        return HttpResponse.json({ ok: true })
      }),
    )
    render(wrap(<PlaceSection city="London" />))
    expect(screen.getByText('London')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /edit/i }))
    const box = screen.getByRole('combobox')
    await userEvent.clear(box)
    await userEvent.type(box, 'Manch')
    await userEvent.click(
      await screen.findByRole('option', { name: /Manchester, Greater Manchester/i }),
    )
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByText('London')).toBeInTheDocument() // back to view mode
    expect(calledWith).toEqual({ p_place_id: 2643123 })
  })

  it('shows the error inline when saving fails', async () => {
    mswServer.use(
      http.post(`${RPC}/search_places`, () =>
        HttpResponse.json({
          ok: true,
          places: [{ id: 2643123, name: 'Manchester', display_name: 'Manchester, Greater Manchester' }],
        }),
      ),
      http.post(`${RPC}/set_profile_location`, () =>
        HttpResponse.json({ ok: false, error: 'place_not_found' }),
      ),
    )
    render(wrap(<PlaceSection city={null} />))
    await userEvent.click(screen.getByRole('button', { name: /edit/i }))
    await userEvent.type(screen.getByRole('combobox'), 'Manch')
    await userEvent.click(
      await screen.findByRole('option', { name: /Manchester, Greater Manchester/i }),
    )
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/place_not_found/)
  })
})
