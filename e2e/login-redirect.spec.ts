import { expect, test } from '@playwright/test'
for (const account of [
  { role: 'MEMBER', isSuperAdmin: true, destination: '/admin' },
  { role: 'ADMIN', isSuperAdmin: false, destination: '/admin' },
  { role: 'MEMBER', isSuperAdmin: false, destination: '/dashboard/member' },
]) {
  test(`login redirects ${account.isSuperAdmin ? 'super admin' : account.role} after authentication`, async ({ page }) => {
    await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: { user: null } }))
    await page.route('**/api/auth/login', route => route.fulfill({ json: { user: { id: 'test-user', email: 'test@example.com', fullName: 'Test User', initials: 'T', ...account }, status: 'ACTIVE' } }))
    await page.route(`**${account.destination}`, route => route.fulfill({ contentType: 'text/html', body: '<h1>Signed in dashboard</h1>' }))
    await page.addInitScript(() => localStorage.setItem('alubonets-registration-draft-v1', JSON.stringify({ step: 2, form: { email: 'test@example.com' } })))
    await page.goto(account.role === 'MEMBER' && !account.isSuperAdmin ? '/login' : '/admin/login')
    await page.waitForLoadState('networkidle')
    await page.locator('input[name=email]').fill('test@example.com')
    await page.locator('input[name=password]').fill('Example1!')
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${account.destination}$`))
    await expect(page.getByRole('heading', { name: 'Signed in dashboard' })).toBeVisible()
  })
}

test('public modal signs in a super admin despite an old registration draft', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('alubonets-registration-draft-v1', JSON.stringify({ step: 2, form: { email: 'test@example.com' } })))
  await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: { user: null } }))
  await page.route('**/api/auth/login', route => route.fulfill({ json: { user: { id: 'test-user', email: 'test@example.com', fullName: 'Test User', initials: 'T', role: 'MEMBER', isSuperAdmin: true }, status: 'ACTIVE' } }))
  await page.route('**/admin', route => route.fulfill({ contentType: 'text/html', body: '<h1>Signed in dashboard</h1>' }))
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Login / Register', exact: true }).click()
  const modal = page.locator('#authModal')
  await modal.locator('input[type=email]').fill('test@example.com')
  await modal.locator('input[type=password]').fill('Example1!')
  await modal.getByRole('button', { name: 'Sign In', exact: true }).click()
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole('heading', { name: 'Signed in dashboard' })).toBeVisible()
})
