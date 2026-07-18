import { supabase } from '@/lib/supabase'
import type { z } from 'zod'
import type { BodyType, Ethnicity } from '@shared/rpc-contracts'

export interface SignupMeta {
  role?: 'benefactor' | 'baby'
  username?: string
  city?: string
  place_id?: number
  age?: number
  body_type?: z.infer<typeof BodyType>
  ethnicity?: z.infer<typeof Ethnicity>
}

export async function signUp(email: string, password: string, meta: SignupMeta = {}) {
  // Rides on auth.users.raw_user_meta_data so it survives the email
  // confirmation round trip even on a different device. `role_hint` name is
  // kept for the already-shipped RoleStep auto-commit.
  const data: Record<string, unknown> = {}
  if (meta.role) data.role_hint = meta.role
  if (meta.username) data.username = meta.username
  if (meta.city) data.city = meta.city
  if (meta.place_id != null) data.place_id = meta.place_id
  if (meta.age != null) data.age = meta.age
  if (meta.body_type) data.body_type = meta.body_type
  if (meta.ethnicity) data.ethnicity = meta.ethnicity

  const { data: res, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/confirm`,
      ...(Object.keys(data).length ? { data } : {}),
    },
  })
  if (error) throw error
  return res
}

export async function logIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/login`,
  })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
