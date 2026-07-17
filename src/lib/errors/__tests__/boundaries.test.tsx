import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { initI18n } from '@/lib/i18n'

vi.mock('../sentry', () => ({ captureError: vi.fn(), initSentry: vi.fn() }))
import { captureError } from '../sentry'
import { RootErrorBoundary } from '../RootErrorBoundary'
import { AppErrorBoundary } from '../AppErrorBoundary'

await initI18n()

function Boom(): never {
  throw new Error('kaboom')
}

describe('error boundaries', () => {
  beforeEach(() => vi.clearAllMocks())

  it('RootErrorBoundary shows a recoverable screen and captures the error', async () => {
    const router = createMemoryRouter([
      { path: '/', element: <Boom />, errorElement: <RootErrorBoundary /> },
    ])
    render(<RouterProvider router={router} />)
    expect(await screen.findByRole('heading', { name: /something went wrong/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument()
    expect(captureError).toHaveBeenCalled()
  })

  it('AppErrorBoundary catches a render crash and captures it', () => {
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    )
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    expect(captureError).toHaveBeenCalled()
  })
})
