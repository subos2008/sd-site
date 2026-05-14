import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

function assertLocalSupabase() {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`SUPABASE_URL is not a valid URL: ${url}`)
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, '')
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Refusing to run E2E admin helper: SUPABASE_URL host "${host}" is not a ` +
        `local-loopback address. Allowed: ${Array.from(LOCAL_HOSTS).join(', ')}.`,
    )
  }
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set.')
  }
}

export async function createConfirmedUser(): Promise<{ email: string; password: string }> {
  assertLocalSupabase()
  const supabase = createClient(url, serviceRoleKey!, { auth: { persistSession: false } })
  const email = `e2e-${crypto.randomUUID()}@local.test`
  const password = 'e2epass1'
  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error
  return { email, password }
}
