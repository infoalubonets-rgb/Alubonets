import { test, expect } from '@playwright/test'

const memberEmail = process.env.E2E_MEMBER_EMAIL || 'member@alubonets.com'
const memberPassword = process.env.E2E_MEMBER_PASSWORD || 'ChangeMe123!'
const adminEmail = process.env.E2E_ADMIN_EMAIL || 'admin@alubonets.com'
const adminPassword = process.env.E2E_ADMIN_PASSWORD || 'ChangeMe123!'

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('input[name="email"]').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/(dashboard|admin|pending)/, { timeout: 30_000 })
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
    test.skip(!process.env.E2E_RUN && process.env.CI === 'true', 'Set E2E_RUN=1 with seeded Auth users')
    await login(page, memberEmail, memberPassword)
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
    test.skip(!process.env.E2E_RUN && process.env.CI === 'true', 'Set E2E_RUN=1 with seeded Auth users')
    await login(page, adminEmail, adminPassword)
    await page.goto('/admin/approvals')
    await expect(page).toHaveURL(/approvals/)
    await page.goto('/admin/settings')
    await expect(page.getByText(/Feature flags|Settings/i).first()).toBeVisible({ timeout: 15_000 })
  })
})
