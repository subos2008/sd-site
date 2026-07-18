import { test, expect, type Page, type Browser } from '@playwright/test'
import { createConfirmedUser } from './helpers/admin-signup'

async function login(page: Page) {
  const { email, password } = await createConfirmedUser()
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /log in/i }).click()
}

// Walks a fresh confirmed user through baby onboarding, in its own browser
// context, so there is a deterministically-named active baby card for this
// spec to target in search. Runs concurrently with other spec files
// (onboarding.spec.ts, single-page-signup.spec.ts) that also create active
// profiles; view_search orders by last_active_at DESC, so "first card in
// search" is not a stable way to identify this fixture — only its unique
// display_name is.
async function seedTargetBaby(browser: Browser, name: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await login(page)

  await page.waitForURL(/onboarding\/role/)
  await page.getByRole('button', { name: /baby/i }).click()

  await page.waitForURL(/onboarding\/identity/)
  await page.getByLabel(/username/i).fill(name)
  await page.getByLabel(/date of birth/i).fill('1998-01-01')
  await page.getByRole('button', { name: /continue/i }).click()

  await page.waitForURL(/onboarding\/photo/)
  for (let i = 0; i < 3; i++) {
    await page.locator('input[type="file"]').nth(i).setInputFiles({
      name: `laf-${i}.jpg`,
      mimeType: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9, i]),
    })
    await expect(page.getByText(`${i + 1} of 3`)).toBeVisible()
  }
  await page.getByRole('button', { name: /continue/i }).click()

  await page.waitForURL(/onboarding\/bio/)
  await page.getByLabel(/your tagline/i).fill('Fixture for the likes-and-filters spec')
  await page
    .getByLabel(/what do you have to offer/i)
    .fill('Genuine company, real conversation and a warm, easy presence.')
  await page
    .getByLabel(/what are you looking for/i)
    .fill('A respectful partner who values discretion, kindness and time together.')
  await page.getByRole('button', { name: /continue/i }).click()

  await page.waitForURL(/onboarding\/details/)
  await page.getByRole('button', { name: /skip for now/i }).click()
  await page.waitForURL(/onboarding\/interests/)
  await page.getByRole('button', { name: /skip for now/i }).click()

  await page.waitForURL(/\/search/)
  await context.close()
}

test('like a fixture from search + see them in Likes tab', async ({ page, browser }) => {
  // Unique per run so concurrent spec files, which also create active
  // profiles, can never collide with this test's own target. Deliberately
  // avoids the substring "like" — the nav bar's Likes link is matched by
  // page.getByRole('link', { name: /likes/i }) below, and a fixture name
  // containing that substring would be an equally-valid (and ambiguous)
  // match for the same role query.
  const targetName = `SearchFixture${Math.random().toString(36).slice(2, 8)}`
  await seedTargetBaby(browser, targetName)

  await login(page)

  // Walk through the benefactor onboarding: role, identity, photo → search
  await page.waitForURL(/onboarding\/role/)
  await page.getByRole('button', { name: /benefactor/i }).click()

  await page.waitForURL(/onboarding\/identity/)
  await page.getByLabel(/username/i).fill('Tester')
  await page.getByLabel(/date of birth/i).fill('1990-01-01')
  await page.getByRole('button', { name: /continue/i }).click()

  await page.waitForURL(/onboarding\/photo/)
  await page.setInputFiles('input[type="file"]', {
    name: 'p.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  })
  await page.getByRole('button', { name: /continue/i }).click()

  // Benefactor path has no details/interests steps — completes straight to search.
  await page.waitForURL(/\/search/)

  // Locate the card for the profile seeded above by its unique display
  // name, not by position. Liking a card invalidates the search query and
  // triggers a refetch; since results are ordered by most-recently-active,
  // a concurrently-created profile from another spec file can become the
  // new "first card" between the click and the assertion. Scoping to the
  // fixture's own name keeps the test correct regardless of ordering.
  const targetCard = page.locator('a[href^="/profile/"]').filter({ hasText: targetName })
  await expect(targetCard).toBeVisible()
  const likeButton = targetCard.locator('button[aria-pressed="false"]')
  await likeButton.click()

  // After click, aria-pressed flips to true (button now reads "Unlike").
  await expect(targetCard.locator('button[aria-pressed="true"]')).toBeVisible()

  // Navigate to Likes tab and confirm the same fixture appears under Favourites.
  // Exact match: the just-liked card's own accessible name now includes the
  // LikeButton's "Unlike" label, which itself contains the substring "like"
  // and would ambiguously match a loose /likes/i query against this same
  // card as well as the nav tab.
  await page.getByRole('link', { name: 'Likes', exact: true }).click()
  await page.waitForURL(/\/likes/)
  await expect(page.getByRole('heading', { name: /^likes$/i })).toBeVisible()
  const favsSection = page.locator('section').filter({ hasText: /favourites/i })
  await expect(favsSection).toBeVisible()
  await expect(favsSection.locator('a[href^="/profile/"]').filter({ hasText: targetName })).toBeVisible()
})
