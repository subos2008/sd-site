import { test, expect, type Page, type Browser } from '@playwright/test'
import { createConfirmedUser } from './helpers/admin-signup'

async function login(page: Page) {
  const { email, password } = await createConfirmedUser()
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /log in/i }).click()
}

// prepareMediaUpload dedupes uploads by sha256(file) — identical bytes across
// calls collide on the same storage path ("The resource already exists"), so
// every photo needs distinct content.
function photoFixture(seed: number) {
  return {
    name: `p${seed}.jpg`,
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9, seed]),
  }
}

async function uploadBabyPhotos(page: Page) {
  await page.waitForURL(/onboarding\/photo/)
  for (let i = 0; i < 3; i++) {
    await page.locator('input[type="file"]').nth(i).setInputFiles(photoFixture(i))
    await expect(page.getByText(`${i + 1} of 3`)).toBeVisible()
  }
  await page.getByRole('button', { name: /continue/i }).click()
}

// Walks a fresh confirmed user through the *counterpart* role's onboarding so
// there is an active card of the opposite role for the primary test's /search
// assertion. Runs in its own browser context (separate session/cookies) so it
// never touches the primary page under test. Not itself under test, so it
// skips per-step assertions beyond the URL waits needed to stay in lock-step
// with the wizard.
async function seedActiveCounterpart(browser: Browser, role: 'benefactor' | 'baby', name: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await login(page)

  await page.waitForURL(/onboarding\/role/)
  await page.getByRole('button', { name: new RegExp(role, 'i') }).click()

  await page.waitForURL(/onboarding\/identity/)
  await page.getByLabel(/display name/i).fill(name)
  await page.getByLabel(/date of birth/i).fill('1990-01-01')
  await page.getByRole('combobox', { name: 'Gender' }).selectOption(role === 'baby' ? 'female' : 'male')
  await page.getByRole('combobox', { name: 'Looking for' }).selectOption(role === 'baby' ? 'male' : 'female')
  await page.getByRole('button', { name: /continue/i }).click()

  await page.waitForURL(/onboarding\/location/)
  await page.getByLabel(/city or town/i).fill('Manchester')
  await page.getByRole('button', { name: /look up/i }).click()
  await page.getByRole('button', { name: /continue/i }).click()

  if (role === 'benefactor') {
    await page.waitForURL(/onboarding\/photo/)
    await page.getByRole('button', { name: /skip for now/i }).click()
  } else {
    await uploadBabyPhotos(page)
    await page.waitForURL(/onboarding\/bio/)
    await page.getByLabel(/your tagline/i).fill('Counterpart tagline')
    await page
      .getByLabel(/what do you have to offer/i)
      .fill('Genuine company, real conversation and a warm, easy presence for anyone.')
    await page
      .getByLabel(/what are you looking for/i)
      .fill('A respectful partner who values discretion, kindness and time together.')
    await page.getByRole('button', { name: /continue/i }).click()
    await page.waitForURL(/onboarding\/details/)
    await page.getByRole('button', { name: /skip for now/i }).click()
    await page.waitForURL(/onboarding\/interests/)
    await page.getByRole('button', { name: /skip for now/i }).click()
  }

  await page.waitForURL(/\/search/)
  await context.close()
}

test('benefactor onboarding: role → identity → location → skip photo → search (no details/interests)', async ({
  page,
  browser,
}) => {
  // Seed an active baby profile so the benefactor's /search has a card to click.
  await seedActiveCounterpart(browser, 'baby', 'Counterpart Baby')

  await login(page)

  // Step 1: role
  await page.waitForURL(/onboarding\/role/)
  await page.getByRole('button', { name: /benefactor/i }).click()

  // Step 2: identity
  await page.waitForURL(/onboarding\/identity/)
  await page.getByLabel(/display name/i).fill('Rich')
  await page.getByLabel(/date of birth/i).fill('1980-01-01')
  await page.getByRole('combobox', { name: 'Gender' }).selectOption('male')
  await page.getByRole('combobox', { name: 'Looking for' }).selectOption('female')
  await page.getByRole('button', { name: /continue/i }).click()

  // Step 3: location
  await page.waitForURL(/onboarding\/location/)
  await page.getByLabel(/city or town/i).fill('Manchester')
  await page.getByRole('button', { name: /look up/i }).click()
  await page.getByRole('button', { name: /continue/i }).click()

  // Step 4: photo — benefactor skips entirely
  await page.waitForURL(/onboarding\/photo/)
  await page.getByRole('button', { name: /skip for now/i }).click()

  // Benefactor path has no details/interests steps — completes straight to search.
  await page.waitForURL(/\/search/)

  // Benefactor should see the seeded baby card; pick it and view the profile.
  const firstCard = page.locator('a[href^="/profile/"]').first()
  await expect(firstCard).toBeVisible()
  await firstCard.click()
  await page.waitForURL(/\/profile\//)
  await expect(page.getByRole('heading')).toBeVisible()
})

test('baby onboarding: role → identity → location → 3 photos → bio → skip details/interests → search', async ({
  page,
  browser,
}) => {
  // Seed an active benefactor profile so the baby's /search has a card to click.
  await seedActiveCounterpart(browser, 'benefactor', 'Counterpart Benefactor')

  await login(page)

  // Step 1: role
  await page.waitForURL(/onboarding\/role/)
  await page.getByRole('button', { name: /baby/i }).click()

  // Step 2: identity
  await page.waitForURL(/onboarding\/identity/)
  await page.getByLabel(/display name/i).fill('Lex')
  await page.getByLabel(/date of birth/i).fill('1999-01-01')
  await page.getByRole('combobox', { name: 'Gender' }).selectOption('female')
  await page.getByRole('combobox', { name: 'Looking for' }).selectOption('male')
  await page.getByRole('button', { name: /continue/i }).click()

  // Step 3: location
  await page.waitForURL(/onboarding\/location/)
  await page.getByLabel(/city or town/i).fill('Manchester')
  await page.getByRole('button', { name: /look up/i }).click()
  await page.getByRole('button', { name: /continue/i }).click()

  // Step 4: photo — baby must reach babyMinPhotos (3) before Continue enables.
  await uploadBabyPhotos(page)

  // Step 5: bio — tagline + about + wants, the latter two need >= babyMinBioChars (40).
  await page.waitForURL(/onboarding\/bio/)
  await page.getByLabel(/your tagline/i).fill('Curious and kind')
  await page
    .getByLabel(/what do you have to offer/i)
    .fill('Genuine company, real conversation and a warm, easy presence for a generous partner.')
  await page
    .getByLabel(/what are you looking for/i)
    .fill('A respectful, established partner who values discretion, kindness and time together.')
  await page.getByRole('button', { name: /continue/i }).click()

  // Step 6: details (skip)
  await page.waitForURL(/onboarding\/details/)
  await page.getByRole('button', { name: /skip for now/i }).click()

  // Step 7: interests (skip)
  await page.waitForURL(/onboarding\/interests/)
  await page.getByRole('button', { name: /skip for now/i }).click()

  // /onboarding/complete auto-navigates to /search on success.
  await page.waitForURL(/\/search/)

  // Baby should see the seeded benefactor card; pick it and view the profile.
  const firstCard = page.locator('a[href^="/profile/"]').first()
  await expect(firstCard).toBeVisible()
  await firstCard.click()
  await page.waitForURL(/\/profile\//)
  await expect(page.getByRole('heading')).toBeVisible()
})
