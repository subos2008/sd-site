import { describe, expect, it, vi } from 'vitest'
import { render as rtlRender, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { http, HttpResponse } from 'msw'
import type { ReactElement } from 'react'
import { mswServer } from '../../../test-setup'
import { SignupForm } from '../components/SignupForm'
import { initI18n } from '@/lib/i18n'

await initI18n()

// SignupForm renders <Link> to the legal pages, so it needs a router context.
function render(ui: ReactElement) {
  const utils = rtlRender(<MemoryRouter>{ui}</MemoryRouter>)
  return {
    ...utils,
    rerender: (next: ReactElement) => utils.rerender(<MemoryRouter>{next}</MemoryRouter>),
  }
}

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

  it('sends the landing-page role hint as signup metadata', async () => {
    let body: unknown = null
    mswServer.use(
      http.post('http://127.0.0.1:54321/auth/v1/signup', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ user: { id: 'u', email: 'a@b.test' }, session: null })
      }),
    )
    render(<SignupForm onSuccess={vi.fn()} roleHint="baby" />)
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.test')
    await userEvent.type(screen.getByLabelText(/password/i), 'pw123456')
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }))

    await screen.findByText(/check your email/i)
    expect(body).toMatchObject({ data: { role_hint: 'baby' } })
  })

  it('shows body-type chips for baby and not for benefactor', async () => {
    const { rerender } = render(<SignupForm roleHint="baby" />)
    expect(screen.getByRole('button', { name: /full figured/i })).toBeInTheDocument()
    rerender(<SignupForm roleHint="benefactor" />)
    expect(screen.queryByRole('button', { name: /full figured/i })).not.toBeInTheDocument()
    // ethnicity chips on both
    expect(screen.getByRole('button', { name: /^asian$/i })).toBeInTheDocument()
  })

  it('sends captured fields as signup metadata and records the attempt', async () => {
    let body: Record<string, unknown> | null = null
    mswServer.use(
      http.post('http://127.0.0.1:54321/auth/v1/signup', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ user: { id: 'u', email: 'a@b.test' }, session: null })
      }),
    )
    render(<SignupForm roleHint="baby" acquisitionSource="uni-flyer" />)
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.test')
    await userEvent.type(screen.getByLabelText(/username/i), 'Lex')
    await userEvent.type(screen.getByLabelText(/password/i), 'pw123456')
    await userEvent.type(screen.getByLabelText(/location/i), 'London')
    await userEvent.type(screen.getByLabelText(/age/i), '22')
    await userEvent.click(screen.getByRole('button', { name: /curvy/i }))
    await userEvent.click(screen.getByRole('button', { name: /^asian$/i }))
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }))
    await screen.findByText(/check your email/i)
    expect(body).toMatchObject({
      data: { role_hint: 'baby', username: 'Lex', city: 'London', age: 22, body_type: 'curvy', ethnicity: 'asian' },
    })
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
