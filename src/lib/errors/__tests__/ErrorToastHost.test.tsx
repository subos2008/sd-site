import { describe, it, expect, beforeEach } from 'vitest'
import { act } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { initI18n } from '@/lib/i18n'
import type { AppError } from '../app-error'
import { reportError, clear } from '../error-bus'
import { ErrorToastHost } from '../ErrorToastHost'

await initI18n()

const transport: AppError = {
  kind: 'transport', name: 'RpcTransportError', message: 'boom',
  rpc: 'set_profile_role', method: 'POST', path: '/rest/v1/rpc/set_profile_role', status: 500,
}

describe('ErrorToastHost', () => {
  beforeEach(() => clear())

  it('renders nothing when there are no errors', () => {
    render(<ErrorToastHost />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('renders a reported error with its transport detail line', () => {
    render(<ErrorToastHost />)
    act(() => reportError(transport))
    expect(screen.getByText('RpcTransportError')).toBeInTheDocument()
    expect(screen.getByText('boom')).toBeInTheDocument()
    expect(screen.getByText(/\/rest\/v1\/rpc\/set_profile_role/)).toBeInTheDocument()
  })

  it('dismisses an error on click', async () => {
    render(<ErrorToastHost />)
    act(() => reportError(transport))
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
