import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { mswServer } from '../../../test-setup'
import { LoginForm } from '../components/LoginForm'
import { initI18n } from '@/lib/i18n'

await initI18n()

describe('LoginForm', () => {
  it('logs in successfully and calls onSuccess', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/auth/v1/token', () =>
        HttpResponse.json({
          access_token: 't',
          refresh_token: 'r',
          expires_in: 3600,
          token_type: 'bearer',
          user: { id: 'u', email: 'a@b.test' },
        }),
      ),
    )
    const onSuccess = vi.fn()
    render(<LoginForm onSuccess={onSuccess} />)
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.test')
    await userEvent.type(screen.getByLabelText(/password/i), 'pw123456')
    await userEvent.click(screen.getByRole('button', { name: /log in/i }))
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled())
  })
})
