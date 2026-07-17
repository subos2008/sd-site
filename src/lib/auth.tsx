import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { AuthContext, type AuthState } from './auth-context'

/**
 * A session restored from localStorage can be dead: its user no longer
 * exists server-side (e.g. after a local `supabase db reset`) even though
 * the stored JWT still parses. Validate once against the auth server and
 * wipe the local session when the server rejects it — otherwise every
 * guard sees "authenticated" and the app misbehaves until the user
 * manually clears site data.
 *
 * Only 401/403 mean the session is dead; network failures must NOT sign
 * out an offline-but-valid session.
 */
async function sessionIsDead(): Promise<boolean> {
  const { error } = await supabase.auth.getUser()
  return error != null && (error.status === 401 || error.status === 403)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', session: null })

  useEffect(() => {
    let cancelled = false
    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      if (data.session && (await sessionIsDead())) {
        await supabase.auth.signOut({ scope: 'local' })
        if (!cancelled) setState({ status: 'anonymous', session: null })
        return
      }
      if (cancelled) return
      setState({
        status: data.session ? 'authenticated' : 'anonymous',
        session: data.session,
      })
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({
        status: session ? 'authenticated' : 'anonymous',
        session,
      })
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
