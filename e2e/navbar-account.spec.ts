import { expect, test } from '@playwright/test'
const user = { id: 'test-member', email: 'peter@example.com', fullName: 'Peter', role: 'MEMBER', initials: 'P', status: 'ACTIVE' }
for (const photo of ['none', 'valid', 'broken']) {
  test(`header account button with ${photo} photo`, async ({ page }) => {
    await page.route('**/api/auth/me', route => route.fulfill({ json: { user: { ...user, avatarUrl: photo === 'none' ? null : '/test-avatar.png' } } }))
    await page.route('**/test-avatar.png', route => photo === 'broken'
      ? route.fulfill({ status: 404 })
      : route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM1sAAAAASUVORK5CYII=', 'base64') }))
    await page.goto('/')
    const account = page.locator('header').getByRole('link', { name: 'Account', exact: true })
    await expect(account).toBeVisible()
    await expect(account).toHaveAttribute('href', '/profile')
    await expect(page.getByRole('button', { name: 'Login / Register', exact: true })).toHaveCount(0)
    if (photo === 'valid') await expect(account.locator('img')).toBeVisible()
    else await expect(account).toContainText('P')
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(account).toBeVisible()
  })
}
test('signed-out header retains login button', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: { user: null } }))
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Login / Register', exact: true })).toBeVisible()
  await expect(page.locator('header').getByRole('link', { name: 'Account', exact: true })).toHaveCount(0)
})
