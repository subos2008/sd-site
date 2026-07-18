import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { mswServer } from '../../../test-setup'
import { PlaceCombobox } from '../components/PlaceCombobox'
import { createQueryClient } from '@/lib/query-client'
import { initI18n } from '@/lib/i18n'
import type { ReactNode } from 'react'

await initI18n()

const RPC = 'http://127.0.0.1:54321/rest/v1/rpc'

function wrap(ui: ReactNode) {
  return <QueryClientProvider client={createQueryClient()}>{ui}</QueryClientProvider>
}

const LONDON = { id: 2643743, name: 'London', display_name: 'London, Greater London' }

describe('PlaceCombobox', () => {
  it('suggests places while typing and reports the picked place', async () => {
    mswServer.use(
      http.post(`${RPC}/search_places`, () =>
        HttpResponse.json({ ok: true, places: [LONDON] }),
      ),
    )
    const onChange = vi.fn()
    render(wrap(<PlaceCombobox label="City" value={null} onChange={onChange} />))
    await userEvent.type(screen.getByRole('combobox'), 'Lond')
    await userEvent.click(
      await screen.findByRole('option', { name: /London, Greater London/i }),
    )
    expect(onChange).toHaveBeenCalledWith(LONDON)
  })

  it('clears the selection when the user types again', async () => {
    mswServer.use(
      http.post(`${RPC}/search_places`, () =>
        HttpResponse.json({ ok: true, places: [LONDON] }),
      ),
    )
    const onChange = vi.fn()
    render(wrap(<PlaceCombobox label="City" value={LONDON} onChange={onChange} />))
    await userEvent.type(screen.getByRole('combobox'), 'x')
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('shows a no-results row', async () => {
    mswServer.use(
      http.post(`${RPC}/search_places`, () =>
        HttpResponse.json({ ok: true, places: [] }),
      ),
    )
    render(wrap(<PlaceCombobox label="City" value={null} onChange={vi.fn()} />))
    await userEvent.type(screen.getByRole('combobox'), 'Xy')
    expect(await screen.findByText(/no places found/i)).toBeInTheDocument()
  })

  it('shows an inline error when the search RPC fails', async () => {
    mswServer.use(
      http.post(`${RPC}/search_places`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )
    render(wrap(<PlaceCombobox label="City" value={null} onChange={vi.fn()} />))
    await userEvent.type(screen.getByRole('combobox'), 'Lond')
    // The query client retries queries once (retry: 1, ~1s backoff) before
    // surfacing isError — allow for that.
    expect(await screen.findByRole('alert', {}, { timeout: 4000 })).toBeInTheDocument()
  })
})
