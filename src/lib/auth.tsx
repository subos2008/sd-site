import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

type AuthStatus = 'loading' | 'anonymous' | 'authenticated'

interface AuthState {
  status: AuthStatus
  session: Session | null
}

const AuthContext = createContext<AuthState>({ status: 'loading', session: null })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', session: null })

  useEffect(() => {
    let cancelled = false
    void supabase.auth.getSession().then(({ data }) => {
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

export function useSession(): AuthState {
  return useContext(AuthContext)
}
