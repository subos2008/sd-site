import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import App from '../App'
import { initI18n } from '../lib/i18n'

describe('App', () => {
  it('renders the bootstrap heading', async () => {
    initI18n()
    const router = createMemoryRouter([{ path: '/', element: <App /> }], { initialEntries: ['/'] })
    render(<RouterProvider router={router} />)
    expect(await screen.findByText(/SD Site — foundations bootstrap/i)).toBeInTheDocument()
  })
})
