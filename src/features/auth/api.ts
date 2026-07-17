import { supabase } from '@/lib/supabase'

export async function signUp(
  email: string,
  password: string,
  roleHint?: 'benefactor' | 'baby',
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/confirm`,
      // Rides on auth.users.raw_user_meta_data so it survives the email
      // confirmation round trip even on a different device.
      ...(roleHint ? { data: { role_hint: roleHint } } : {}),
    },
  })
  if (error) throw error
  return data
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
