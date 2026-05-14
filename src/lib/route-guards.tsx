import { Navigate, Outlet } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useSession } from './auth-context'
import { viewMyProfile } from '@/features/onboarding/api'

/**
 * RequireAnonymous: blocks signed-in users from /signup, /login, /forgot-password.
 */
export function RequireAnonymous() {
  const { status } = useSession()
  if (status === 'loading') return null
  if (status === 'authenticated') return <Navigate to="/" replace />
  return <Outlet />
}

/**
 * RequireOnboarded: blocks pending users from search/profile, sends them to /onboarding.
 * Blocks anonymous users to /login.
 */
export function RequireOnboarded() {
  const { status } = useSession()
  const me = useQuery({
    queryKey: ['my-profile'],
    queryFn: viewMyProfile,
    enabled: status === 'authenticated',
  })
  if (status === 'loading') return null
  if (status === 'anonymous') return <Navigate to="/login" replace />
  if (!me.data) return null
  if (!me.data.ok) return null
  if (me.data.profile.status === 'pending_onboarding')
    return <Navigate to="/onboarding/role" replace />
  if (me.data.profile.status === 'suspended') return <Navigate to="/login" replace />
  return <Outlet />
}

/**
 * RequirePendingOnboarding: blocks already-active users from the onboarding wizard.
 */
export function RequirePendingOnboarding() {
  const { status } = useSession()
  const me = useQuery({
    queryKey: ['my-profile'],
    queryFn: viewMyProfile,
    enabled: status === 'authenticated',
  })
  if (status === 'loading') return null
  if (status === 'anonymous') return <Navigate to="/login" replace />
  if (!me.data) return null
  if (!me.data.ok) return null
  if (me.data.profile.status === 'active') return <Navigate to="/search" replace />
  return <Outlet />
}

/**
 * RootRedirect: index '/' redirects by state.
 */
export function RootRedirect() {
  const { status } = useSession()
  const me = useQuery({
    queryKey: ['my-profile'],
    queryFn: viewMyProfile,
    enabled: status === 'authenticated',
  })
  if (status === 'loading') return null
  if (status === 'anonymous') return <Navigate to="/login" replace />
  if (!me.data) return null
  if (!me.data.ok) return <Navigate to="/login" replace />
  if (me.data.profile.status === 'pending_onboarding')
    return <Navigate to="/onboarding/role" replace />
  return <Navigate to="/search" replace />
}
