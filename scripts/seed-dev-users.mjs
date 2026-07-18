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
    gender: 'female', looking_for: 'male', city: 'London',
    tagline: 'London-based, curious and warm',
    about: 'I offer genuine company, good conversation and an easy, warm presence.',
    wants: 'A respectful, established partner who values discretion and kindness.' },
  { email: 'sam@local.test',  role: 'baby',       display_name: 'Sam',  dob: '1999-09-03',
    gender: 'female', looking_for: 'male', city: 'Manchester',
    tagline: 'Manchester student, bright and easy-going',
    about: 'Fun, grounded company and real conversation for the right person.',
    wants: 'Someone generous, respectful and discreet who enjoys good company.' },
  { email: 'rick@local.test', role: 'benefactor', display_name: 'Rick', dob: '1980-01-22',
    gender: 'male',   looking_for: 'female', city: 'London' },
]

// Resolve seeded GeoNames places by name (largest population wins).
const placeIds = new Map()
for (const cityName of new Set(fixtures.map((f) => f.city))) {
  const { data: places, error } = await supabase
    .from('places')
    .select('id, population')
    .eq('name', cityName)
    .eq('country_code', 'GB')
    .order('population', { ascending: false })
    .limit(1)
  if (error) throw new Error(`place lookup failed for ${cityName}: ${error.message}`)
  if (!places?.length) throw new Error(`no seeded place named ${cityName} — run migrations first`)
  placeIds.set(cityName, places[0].id)
}

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
  const { error: updateError } = await supabase.from('profiles').update({
    role: f.role,
    display_name: f.display_name,
    date_of_birth: f.dob,
    gender: f.gender,
    looking_for: f.looking_for,
    place_id: placeIds.get(f.city),
    tagline: f.tagline ?? null,
    about: f.about ?? null,
    wants: f.wants ?? null,
    status: 'active',
    last_active_at: new Date().toISOString(),
  }).eq('id', userId)
  if (updateError) {
    throw new Error(`failed to update profile for ${f.email}: ${updateError.message}`)
  }

  console.log(`seeded ${f.email}`)
}
