import { test, expect } from '@playwright/test'
import { createConfirmedUser } from './helpers/admin-signup'

test('signup → onboarding → search → view someone else', async ({ page }) => {
  // Bypass email confirmation by creating an already-confirmed user.
  const { email, password } = await createConfirmedUser()

  // Log in
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /log in/i }).click()

  // Step 1: role
  await page.waitForURL(/onboarding\/role/)
  await page.getByRole('button', { name: /benefactor/i }).click()

  // Step 2: identity
  await page.waitForURL(/onboarding\/identity/)
  await page.getByLabel(/display name/i).fill('Tester')
  await page.getByLabel(/date of birth/i).fill('1990-01-01')
  await page.getByRole('combobox', { name: 'Gender' }).selectOption('male')
  await page.getByRole('combobox', { name: 'Looking for' }).selectOption('female')
  await page.getByRole('button', { name: /continue/i }).click()

  // Step 3: location
  await page.waitForURL(/onboarding\/location/)
  await page.getByLabel(/city or town/i).fill('Manchester')
  await page.getByRole('button', { name: /look up/i }).click()
  await page.getByRole('button', { name: /continue/i }).click()

  // Step 4: photo (upload a tiny dummy file)
  await page.waitForURL(/onboarding\/photo/)
  await page.setInputFiles('input[type="file"]', {
    name: 'p.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  })
  // The continue button only appears after upload succeeds.
  await page.getByRole('button', { name: /continue/i }).click()

  // /onboarding/complete auto-navigates to /search on success.
  await page.waitForURL(/\/search/)

  // Seeded fixtures from seed:dev should appear; pick one and click it.
  const firstCard = page.locator('a[href^="/profile/"]').first()
  await expect(firstCard).toBeVisible()
  await firstCard.click()
  await page.waitForURL(/\/profile\//)
  await expect(page.getByRole('heading')).toBeVisible()
})
