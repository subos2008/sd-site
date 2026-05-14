import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useSession } from '../auth'

function Probe() {
  const { session, status } = useSession()
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="email">{session?.user.email ?? 'none'}</span>
    </div>
  )
}

describe('AuthProvider', () => {
  it('starts in loading then resolves to anonymous when no session', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'))
    expect(screen.getByTestId('email')).toHaveTextContent('none')
  })
})
