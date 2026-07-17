import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { LandingPage } from '../pages/LandingPage'
import { initI18n } from '@/lib/i18n'

await initI18n()

function renderLanding() {
  const router = createMemoryRouter([{ path: '/', element: <LandingPage /> }], {
    initialEntries: ['/'],
  })
  return render(<RouterProvider router={router} />)
}

describe('LandingPage', () => {
  it('renders the keyword headline', () => {
    renderLanding()
    expect(
      screen.getByRole('heading', { level: 1, name: /sugar daddy & sugar baby dating/i }),
    ).toBeInTheDocument()
  })

  it('forks signup by role', () => {
    renderLanding()
    expect(screen.getByRole('link', { name: /i'm a sugar baby/i })).toHaveAttribute(
      'href',
      '/signup?role=baby',
    )
    expect(screen.getByRole('link', { name: /i'm a sugar daddy/i })).toHaveAttribute(
      'href',
      '/signup?role=benefactor',
    )
  })

  it('links returning users to login', () => {
    renderLanding()
    expect(screen.getAllByRole('link', { name: /log in/i })[0]).toHaveAttribute('href', '/login')
  })
})
