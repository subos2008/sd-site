import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { initI18n } from '@/lib/i18n'
import { CompleteProfileNudge } from '../components/CompleteProfileNudge'

await initI18n()
beforeEach(() => localStorage.clear())

describe('CompleteProfileNudge', () => {
  it('renders for a benefactor with empty details/interests', () => {
    render(<CompleteProfileNudge role="benefactor" hasDetails={false} hasInterests={false} />)
    expect(screen.getByText(/finish your profile/i)).toBeInTheDocument()
  })

  it('does not render for a baby', () => {
    render(<CompleteProfileNudge role="baby" hasDetails={false} hasInterests={false} />)
    expect(screen.queryByText(/finish your profile/i)).not.toBeInTheDocument()
  })

  it('does not render once details and interests are present', () => {
    render(<CompleteProfileNudge role="benefactor" hasDetails hasInterests />)
    expect(screen.queryByText(/finish your profile/i)).not.toBeInTheDocument()
  })

  it('stays dismissed after clicking Dismiss', async () => {
    const { unmount } = render(
      <CompleteProfileNudge role="benefactor" hasDetails={false} hasInterests={false} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByText(/finish your profile/i)).not.toBeInTheDocument()
    unmount()
    render(<CompleteProfileNudge role="benefactor" hasDetails={false} hasInterests={false} />)
    expect(screen.queryByText(/finish your profile/i)).not.toBeInTheDocument()
  })
})
