import { test, expect } from '@playwright/test'
import { createConfirmedUser } from './helpers/admin-signup'

test('like a fixture from search + see them in Likes tab', async ({ page }) => {
  // Use a fresh confirmed user; assume seed:dev has already run so fixture profiles exist.
  const { email, password } = await createConfirmedUser()

  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /log in/i }).click()

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

  // Find the first profile card and click its like button.
  // LikeButton renders with aria-pressed reflecting the liked state.
  const firstCard = page.locator('a[href^="/profile/"]').first()
  await expect(firstCard).toBeVisible()
  const likeButton = firstCard.locator('button[aria-pressed="false"]')
  await likeButton.click()

  // After click, aria-pressed flips to true (button now reads "Unlike").
  await expect(firstCard.locator('button[aria-pressed="true"]')).toBeVisible()

  // Navigate to Likes tab and confirm the liked profile appears under Favourites.
  await page.getByRole('link', { name: /likes/i }).click()
  await page.waitForURL(/\/likes/)
  await expect(page.getByRole('heading', { name: /^likes$/i })).toBeVisible()
  const favsSection = page.locator('section').filter({ hasText: /favourites/i })
  await expect(favsSection).toBeVisible()
  await expect(favsSection.locator('a[href^="/profile/"]').first()).toBeVisible()
})
