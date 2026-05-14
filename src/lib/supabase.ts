import { createClient } from '@supabase/supabase-js'
import type { Database } from '@shared/db-types'

const url = import.meta.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'test-anon-key'

export const supabase = createClient<Database>(url, anonKey, {
  auth: { persistSession: false },
})
