import { createClient } from '@supabase/supabase-js'
import type { Database } from '@shared/db-types'

const url = import.meta.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
// Fallback matches the fixed local Supabase CLI demo anon key (same JWT_SECRET
// every `supabase init` project ships with), not a real secret. The previous
// placeholder ('test-anon-key') isn't a well-formed JWT, so PostgREST rejects
// it with "Expected 3 parts in JWT; got 1" on any call made before a session
// exists (i.e. every genuinely anonymous RPC, like search_places pre-login) —
// authenticated calls masked this because supabase-js swaps in the real
// session access_token once one exists.
const anonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

export const supabase = createClient<Database>(url, anonKey, {
  auth: { persistSession: false },
})
