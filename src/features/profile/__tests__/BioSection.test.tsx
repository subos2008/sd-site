import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from '@/lib/query-client'
import { initI18n } from '@/lib/i18n'
import { BioSection } from '../components/BioSection'

await initI18n()

describe('BioSection', () => {
  it('toggles into edit mode', async () => {
    render(
      <QueryClientProvider client={createQueryClient()}>
        <BioSection tagline="Hello" about="More" wants="A friend" />
      </QueryClientProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: /edit/i }))
    expect(screen.getByLabelText(/tagline/i)).toHaveValue('Hello')
  })
})
