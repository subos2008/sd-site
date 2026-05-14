import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated'

export interface AuthState {
  status: AuthStatus
  session: Session | null
}

export const AuthContext = createContext<AuthState>({
  status: 'loading',
  session: null,
})

export function useSession(): AuthState {
  return useContext(AuthContext)
}
