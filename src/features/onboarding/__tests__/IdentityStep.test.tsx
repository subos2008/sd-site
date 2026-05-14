import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { IdentityStep } from '../components/IdentityStep'
import { createQueryClient } from '@/lib/query-client'
import { initI18n } from '@/lib/i18n'
import type { ReactNode } from 'react'

await initI18n()

function wrap(ui: ReactNode) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('IdentityStep', () => {
  it('disables Continue when DOB indicates under 18', async () => {
    render(wrap(<IdentityStep />))
    await userEvent.type(screen.getByLabelText(/display name/i), 'Lex')
    const dob = new Date()
    dob.setFullYear(dob.getFullYear() - 17)
    const iso = dob.toISOString().slice(0, 10)
    const dobInput = screen.getByLabelText(/date of birth/i) as HTMLInputElement
    await userEvent.clear(dobInput)
    await userEvent.type(dobInput, iso)
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })
})
