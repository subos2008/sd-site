import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useSession } from './auth-context'
import { viewMyProfile } from '@/features/onboarding/api'
import { useMyProfile } from '@/features/profile/hooks'
import { LandingPage } from '@/features/landing/pages/LandingPage'

/**
 * useSignOutDeadSession: an authenticated session whose profile is gone
 * (e.g. after a local db reset) or suspended cannot use the app. Navigating
 * it to /login loops — RequireAnonymous bounces authenticated sessions back
 * to '/' — so sign it out; the auth state change re-renders the guard as
 * anonymous.
 */
function useSignOutDeadSession(dead: boolean) {
  useEffect(() => {
    // scope: 'local' — clearing storage must not depend on the auth server
    // accepting a token it already considers invalid.
    if (dead) void supabase.auth.signOut({ scope: 'local' })
  }, [dead])
}

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
  const meData = me.data
  const dead =
    status === 'authenticated' &&
    meData != null &&
    (!meData.ok || meData.profile.status === 'suspended')
  useSignOutDeadSession(dead)
  if (status === 'loading') return null
  if (status === 'anonymous') return <Navigate to="/login" replace />
  if (!me.data) return null
  if (dead || !me.data.ok) return null
  if (me.data.profile.status === 'pending_onboarding')
    return <Navigate to="/onboarding/role" replace />
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
  const dead = status === 'authenticated' && me.data != null && !me.data.ok
  useSignOutDeadSession(dead)
  if (status === 'loading') return null
  if (status === 'anonymous') return <Navigate to="/login" replace />
  if (!me.data) return null
  if (dead || !me.data.ok) return null
  if (me.data.profile.status === 'active') return <Navigate to="/search" replace />
  return <Outlet />
}

/**
 * RequireRoleChosen: blocks post-role onboarding steps until a role is set,
 * sends users without a role back to /onboarding/role.
 */
export function RequireRoleChosen() {
  const { data, isLoading } = useMyProfile()
  if (isLoading) return null
  if (!data?.ok || data.profile.role == null) {
    return <Navigate to="/onboarding/role" replace />
  }
  return <Outlet />
}

/**
 * RootRedirect: index '/' — anonymous visitors get the marketing landing page,
 * signed-in users are redirected by onboarding state.
 */
export function RootRedirect() {
  const { status } = useSession()
  const me = useQuery({
    queryKey: ['my-profile'],
    queryFn: viewMyProfile,
    enabled: status === 'authenticated',
  })

  const meData = me.data
  const deadSession =
    status === 'authenticated' &&
    meData != null &&
    (!meData.ok || meData.profile.status === 'suspended')
  useSignOutDeadSession(deadSession)

  if (status === 'loading') return null
  if (status === 'anonymous') return <LandingPage />
  if (!me.data) return null
  if (deadSession || !me.data.ok) return null
  if (me.data.profile.status === 'pending_onboarding')
    return <Navigate to="/onboarding/role" replace />
  return <Navigate to="/search" replace />
}
