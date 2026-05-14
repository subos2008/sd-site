import { test, expect } from '@playwright/test'

test('login page renders the login form', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: /log in/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /log in/i })).toBeVisible()
})

test('login page exposes email and password inputs', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
})

test('PWA manifest is reachable in dev', async ({ page }) => {
  const res = await page.request.get('/manifest.webmanifest')
  expect(res.ok()).toBe(true)
  const body = await res.json()
  expect(body.name).toBe('SD Site')
})
