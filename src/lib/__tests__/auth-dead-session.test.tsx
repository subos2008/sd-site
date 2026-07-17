import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Session, User } from '@supabase/supabase-js'
import { AuthError } from '@supabase/supabase-js'
import { AuthProvider } from '../auth'
import { useSession } from '../auth-context'
import { supabase } from '../supabase'

const session = { user: { id: 'u1' } } as unknown as Session
const user = { id: 'u1' } as User

function Probe() {
  const { status } = useSession()
  return <p>status:{status}</p>
}

function mockGetSession(s: Session | null) {
  vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
    data: { session: s },
    error: null,
  } as never)
  // The real listener would fire INITIAL_SESSION from the unmocked client
  // state and stomp the state under test.
  vi.spyOn(supabase.auth, 'onAuthStateChange').mockReturnValue({
    data: { subscription: { id: 'test', callback: vi.fn(), unsubscribe: vi.fn() } },
  } as never)
}

describe('AuthProvider dead-session healing', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('signs out locally when the auth server rejects the stored session', async () => {
    mockGetSession(session)
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: null },
      error: new AuthError('user not found', 403),
    } as never)
    const signOut = vi.spyOn(supabase.auth, 'signOut').mockResolvedValue({ error: null })

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    expect(await screen.findByText('status:anonymous')).toBeInTheDocument()
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('keeps the session when validation fails for non-auth reasons (offline)', async () => {
    mockGetSession(session)
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: null },
      error: new AuthError('fetch failed', undefined),
    } as never)
    const signOut = vi.spyOn(supabase.auth, 'signOut')

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    expect(await screen.findByText('status:authenticated')).toBeInTheDocument()
    expect(signOut).not.toHaveBeenCalled()
  })

  it('keeps a valid session', async () => {
    mockGetSession(session)
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user },
      error: null,
    })
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    expect(await screen.findByText('status:authenticated')).toBeInTheDocument()
  })

  it('stays anonymous with no stored session', async () => {
    mockGetSession(null)
    const getUser = vi.spyOn(supabase.auth, 'getUser')
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    expect(await screen.findByText('status:anonymous')).toBeInTheDocument()
    expect(getUser).not.toHaveBeenCalled()
  })
})
