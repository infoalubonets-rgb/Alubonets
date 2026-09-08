import { test, expect } from '@playwright/test'

const memberEmail = process.env.E2E_MEMBER_EMAIL
const memberPassword = process.env.E2E_MEMBER_PASSWORD
const adminEmail = process.env.E2E_ADMIN_EMAIL
const adminPassword = process.env.E2E_ADMIN_PASSWORD

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('input[name="email"]').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/(dashboard|admin|pending|verify-login)/, { timeout: 30_000 })
}

test.describe('auth gates', () => {
  test('unauthenticated /admin redirects to login', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/login/)
  })

  test('unauthenticated treasurer dashboard redirects to login', async ({ page }) => {
    await page.goto('/dashboard/treasurer')
    await expect(page).toHaveURL(/login/)
  })
})

test.describe('member happy path', () => {
  test('member can open contributions and submit welfare', async ({ page }) => {
    test.skip(!memberEmail || !memberPassword, 'Set E2E_MEMBER_EMAIL and E2E_MEMBER_PASSWORD')
    test.skip(!process.env.E2E_RUN && process.env.CI === 'true', 'Set E2E_RUN=1 with real Auth users')
    await login(page, memberEmail!, memberPassword!)
    // Login verification step may intervene in production-like envs
    if (page.url().includes('verify-login')) {
      test.skip(true, 'Complete email verification is interactive; skip automated path')
    }
    await page.goto('/contributions')
    await expect(page.getByText(/contribution/i).first()).toBeVisible({ timeout: 15_000 })

    await page.goto('/dashboard/member/welfare')
    await page.locator('textarea[name="description"]').fill('E2E welfare smoke request')
    await page.locator('input[name="amount"]').fill('100')
    await page.locator('button[type="submit"]').click()
    await expect(page.getByText(/E2E welfare smoke request|PENDING|welfare/i).first()).toBeVisible({
      timeout: 15_000,
    })
  })
})

test.describe('admin smoke', () => {
  test('admin can open approvals and settings', async ({ page }) => {
    test.skip(!adminEmail || !adminPassword, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD')
    test.skip(!process.env.E2E_RUN && process.env.CI === 'true', 'Set E2E_RUN=1 with real Auth users')
    await login(page, adminEmail!, adminPassword!)
    if (page.url().includes('verify-login')) {
      test.skip(true, 'Complete email verification is interactive; skip automated path')
    }
    await page.goto('/admin/approvals')
    await expect(page).toHaveURL(/approvals/)
    await page.goto('/admin/settings')
    await expect(page.getByText(/Feature flags|Settings/i).first()).toBeVisible({ timeout: 15_000 })
  })
})
