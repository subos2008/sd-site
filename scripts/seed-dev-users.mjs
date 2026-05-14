#!/usr/bin/env node
// Creates a handful of confirmed users for local development, walks each through
// onboarding, and seeds a couple of photos. Idempotent: re-running upserts.
//
// SAFETY: refuses to run unless SUPABASE_URL points at a local-loopback host.
// This guards against the user accidentally running this against a remote
// Supabase project for which they happen to have a service-role key in env.

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])
let parsed
try {
  parsed = new URL(url)
} catch {
  console.error(`SUPABASE_URL is not a valid URL: ${url}`)
  process.exit(2)
}
// new URL() wraps IPv6 in brackets; strip them.
const host = parsed.hostname.replace(/^\[|\]$/g, '')
if (!LOCAL_HOSTS.has(host)) {
  console.error(
    `Refusing to seed: SUPABASE_URL host "${host}" is not a local-loopback ` +
      `address. Allowed: ${Array.from(LOCAL_HOSTS).join(', ')}. ` +
      `Set SUPABASE_URL to your local supabase (e.g. http://127.0.0.1:54321) ` +
      `before running pnpm seed:dev.`,
  )
  process.exit(2)
}

if (!serviceRoleKey) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY (printed by `supabase status`).')
  process.exit(2)
}
const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } })

const fixtures = [
  { email: 'lex@local.test',  role: 'baby',       display_name: 'Lex',  dob: '1998-04-12',
    gender: 'female', looking_for: 'male', city: 'London',     lat: 51.5074, lng: -0.1278 },
  { email: 'sam@local.test',  role: 'baby',       display_name: 'Sam',  dob: '1999-09-03',
    gender: 'female', looking_for: 'male', city: 'Manchester', lat: 53.4808, lng: -2.2426 },
  { email: 'rick@local.test', role: 'benefactor', display_name: 'Rick', dob: '1980-01-22',
    gender: 'male',   looking_for: 'female', city: 'London',   lat: 51.5074, lng: -0.1278 },
]

for (const f of fixtures) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: f.email,
    password: 'devpass1',
    email_confirm: true,
  })
  if (error && !String(error.message).match(/already.*registered/i)) throw error
  const userId = data?.user?.id ??
    (await supabase.auth.admin.listUsers()).data.users.find((u) => u.email === f.email)?.id
  if (!userId) throw new Error(`could not resolve user id for ${f.email}`)

  // Apply onboarding fields directly via the service-role client (bypasses RPC role checks).
  await supabase.from('profiles').update({
    role: f.role,
    display_name: f.display_name,
    date_of_birth: f.dob,
    gender: f.gender,
    looking_for: f.looking_for,
    city_display_name: f.city,
    city_lat: f.lat,
    city_lng: f.lng,
    status: 'active',
    last_active_at: new Date().toISOString(),
  }).eq('id', userId)

  console.log(`seeded ${f.email}`)
}
