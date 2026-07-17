import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { mswServer } from '../../../test-setup'
import { createQueryClient } from '@/lib/query-client'
import { initI18n } from '@/lib/i18n'
import { DetailsSection } from '../components/DetailsSection'

await initI18n()

const baseProps = {
  height_cm: 180,
  body_type: 'athletic',
  ethnicity: 'asian' as string | null,
  hair_color: 'black',
  eye_color: 'brown',
  has_piercings: false,
  has_tattoos: false,
  smoking: 'never',
  drinking: 'never',
  education: 'bachelors',
  yearly_income_band: 'under_50k',
  net_worth_band: 'under_250k',
}

function renderSection(props = baseProps) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <DetailsSection {...props} />
    </QueryClientProvider>,
  )
}

describe('DetailsSection', () => {
  it('pre-selects the incoming profile ethnicity when editing', async () => {
    renderSection()
    await userEvent.click(screen.getByRole('button', { name: /edit/i }))
    expect(screen.getByLabelText(/ethnicity/i)).toHaveValue('asian')
  })

  it('sends p_ethnicity in the set_profile_details request body on save', async () => {
    let body: unknown = null
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/set_profile_details', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ ok: true })
      }),
    )
    renderSection()
    await userEvent.click(screen.getByRole('button', { name: /edit/i }))
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(body).toMatchObject({ p_ethnicity: 'asian' })
  })
})
