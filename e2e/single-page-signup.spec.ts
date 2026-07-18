import { test, expect } from '@playwright/test'

// Photo fixture — see the note in likes-and-filters.spec.ts: prepareMediaUpload
// dedupes by sha256(file), so every photo needs distinct bytes.
function photoFixture(seed: number) {
  return {
    name: `sps-${seed}.jpg`,
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9, seed]),
  }
}

test('single-page signup: landing fork → captured metadata pre-fills the shrunk wizard → search', async ({
  page,
}) => {
  const suffix = Math.random().toString(36).slice(2)
  const email = `sps-${suffix}@local.test`
  const username = `Signup${suffix}`
  const password = 'devpass1x'
  const city = 'London'
  const age = '24'

  // Step 1: landing fork — "I'm a Sugar Baby" is the hero fork link's title;
  // "Join as a Sugar Baby" (its CTA span, and the lower section's CTA link)
  // is ambiguous, so target by the unique fork title text instead.
  await page.goto('/')
  await page.getByRole('link', { name: /i'm a sugar baby/i }).click()
  await page.waitForURL(/\/signup\?role=baby/)

  // Step 2: fill the single-page signup form.
  await page.getByLabel(/^email$/i).fill(email)
  await page.getByLabel(/username/i).fill(username)
  await page.getByLabel(/^password$/i).fill(password)
  await page.getByLabel(/location/i).fill(city)
  await page.getByRole('option', { name: /^London,/ }).first().click()
  await page.getByLabel(/age/i).fill(age)
  await page.getByRole('button', { name: 'Fit' }).click()
  await page.getByRole('button', { name: 'Asian' }).click()
  await page.getByRole('button', { name: /^sign up$/i }).click()

  // Step 3: confirmation — determined empirically (no Mailpit round trip
  // needed). supabase/config.toml sets auth.email enable_confirmations =
  // false for the local stack, so signUp() resolves with a session
  // immediately. That flips useSession() to "authenticated" via
  // onAuthStateChange, and RequireAnonymous (wrapping /signup) reacts by
  // itself: it unmounts the form and <Navigate>s to "/", which RootRedirect
  // then sends on to /onboarding/role for a pending-onboarding profile —
  // all client-side, no click or page.goto needed. This happens fast enough
  // that SignupForm's "check your email" success copy never gets a chance
  // to paint, so it isn't asserted here.
  await page.waitForURL(/onboarding\/identity/)
  await expect(page.getByLabel(/username/i)).toHaveValue(username)
  await page.getByLabel(/date of birth/i).fill('2000-01-01')
  await page.getByRole('button', { name: /continue/i }).click()

  // Step 5: location — committed by the signup bootstrap from the place
  // picked at signup; the wizard has no location step.

  // Step 6: photo — baby needs 3.
  await page.waitForURL(/onboarding\/photo/)
  for (let i = 0; i < 3; i++) {
    await page.locator('input[type="file"]').nth(i).setInputFiles(photoFixture(i))
    await expect(page.getByText(`${i + 1} of 3`)).toBeVisible()
  }
  await page.getByRole('button', { name: /continue/i }).click()

  // Step 7: bio.
  await page.waitForURL(/onboarding\/bio/)
  await page.getByLabel(/your tagline/i).fill('Curious and kind')
  await page
    .getByLabel(/what do you have to offer/i)
    .fill('Genuine company, real conversation and a warm, easy presence for a generous partner.')
  await page
    .getByLabel(/what are you looking for/i)
    .fill('A respectful, established partner who values discretion, kindness and time together.')
  await page.getByRole('button', { name: /continue/i }).click()

  // Step 8: details — body-type and ethnicity chosen at signup pre-selected.
  await page.waitForURL(/onboarding\/details/)
  await expect(page.getByLabel('Body type')).toHaveValue('athletic')
  await expect(page.getByLabel('Ethnicity')).toHaveValue('asian')
  await page.getByRole('button', { name: /skip for now/i }).click()

  // Step 9: interests (skip).
  await page.waitForURL(/onboarding\/interests/)
  await page.getByRole('button', { name: /skip for now/i }).click()

  // /onboarding/complete auto-navigates to /search on success.
  await page.waitForURL(/\/search/)
})
