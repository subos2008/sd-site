import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { LegalPage } from '../pages/LegalPage'
import { initI18n } from '@/lib/i18n'

await initI18n()

describe('LegalPage', () => {
  it('renders the privacy heading', () => {
    const router = createMemoryRouter([{ path: '/', element: <LegalPage doc="privacy" /> }], {
      initialEntries: ['/'],
    })
    render(<RouterProvider router={router} />)
    expect(screen.getByRole('heading', { name: /privacy/i })).toBeInTheDocument()
  })
})
