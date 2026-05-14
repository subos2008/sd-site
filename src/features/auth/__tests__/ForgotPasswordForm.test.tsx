import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { mswServer } from '../../../test-setup'
import { ForgotPasswordForm } from '../components/ForgotPasswordForm'
import { initI18n } from '@/lib/i18n'

await initI18n()

describe('ForgotPasswordForm', () => {
  it('always shows the generic "sent" message (no account enumeration)', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/auth/v1/recover', () => HttpResponse.json({})),
    )
    render(<ForgotPasswordForm />)
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.test')
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }))
    expect(await screen.findByText(/we've emailed you a link/i)).toBeInTheDocument()
  })
})
