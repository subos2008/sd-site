import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { mswServer } from '../../../test-setup'
import { SignupForm } from '../components/SignupForm'
import { initI18n } from '@/lib/i18n'

await initI18n()

describe('SignupForm', () => {
  it('submits email + password and shows check-email message', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/auth/v1/signup', () =>
        HttpResponse.json({ user: { id: 'u', email: 'a@b.test' }, session: null }),
      ),
    )
    const onSuccess = vi.fn()
    render(<SignupForm onSuccess={onSuccess} />)

    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.test')
    await userEvent.type(screen.getByLabelText(/password/i), 'pw123456')
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }))

    expect(await screen.findByText(/check your email/i)).toBeInTheDocument()
    expect(onSuccess).toHaveBeenCalled()
  })

  it('shows a server error when signup fails', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/auth/v1/signup', () =>
        HttpResponse.json(
          { error: 'signup_disabled', error_description: 'no' },
          { status: 400 },
        ),
      ),
    )
    render(<SignupForm onSuccess={vi.fn()} />)
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.test')
    await userEvent.type(screen.getByLabelText(/password/i), 'pw123456')
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
