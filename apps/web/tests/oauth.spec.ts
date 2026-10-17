import { test, expect } from '@playwright/test'

test('the shared Google button completes a browser-bound handoff and restores the cookie session on reload', async ({
  page,
  context
}, info) => {
  // Replace only Google consent. All browser UI, BFF, session storage, PKCE exchange, and /me calls run normally.
  await page.route('https://accounts.google.com/**', async (route) => {
    const state = new URL(route.request().url()).searchParams.get('state')!
    await route.fulfill({
      status: 302,
      headers: {
        location: `http://127.0.0.1:8091/api/auth/google/callback?state=${state}&code=fixture-google-${state}`
      }
    })
  })
  await page.goto('/')
  await expect(
    page.getByRole('dialog', { name: 'Transform Videos into Viral Clips' })
  ).toBeVisible()
  await expect(page.getByAltText('Clippster')).toBeVisible()
  await page.getByRole('button', { name: 'Google', exact: true }).click()
  await expect(page.locator('.page-header__title')).toHaveText('Video Library')
  expect(page.url()).toBe('http://127.0.0.1:8091/')
  const cookies = await context.cookies()
  expect(cookies.find((c) => c.name === 'clippster_web')?.httpOnly).toBe(true)
  expect(cookies.find((c) => c.name === 'clippster_oauth')).toBeUndefined()
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('token')
  await page.reload()
  await expect(page.locator('.page-header__title')).toHaveText('Video Library')
  await page.screenshot({ path: info.outputPath('shared-library-web.png') })
  await page.getByRole('link', { name: 'Sign out' }).click()
  await expect(page.getByRole('button', { name: 'Google', exact: true })).toBeVisible()
})

test('Google cancellation returns to the shared sign-in screen with a useful error', async ({
  page
}) => {
  await page.route('https://accounts.google.com/**', async (route) => {
    const state = new URL(route.request().url()).searchParams.get('state')!
    await route.fulfill({
      status: 302,
      headers: {
        location: `http://127.0.0.1:8091/api/auth/google/callback?state=${state}&error=google_cancelled`
      }
    })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Google', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Google sign-in was cancelled')
  await expect(page.getByRole('button', { name: 'Google', exact: true })).toBeEnabled()
  expect(page.url()).toBe('http://127.0.0.1:8091/')
})

test('the web adapter preserves registration, OTP errors, unverified login, and password reset', async ({
  page
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign up', exact: true }).click()
  await page.getByLabel('Email', { exact: true }).fill('register@example.com')
  await page.getByLabel('Password', { exact: true }).fill('test-password')
  await page.getByLabel('Confirm password', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Create Account', exact: true }).click()
  await expect(page.getByLabel('Verification code')).toBeVisible()
  await page.getByRole('button', { name: '← Back', exact: true }).click()
  await page.getByLabel('Password', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await expect(page.getByLabel('Verification code')).toBeVisible()
  await page.getByLabel('Verification code').fill('654321')
  await page.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Invalid verification code')
  await page.getByLabel('Verification code').fill('123456')
  await page.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(page.locator('.page-header__title')).toHaveText('Video Library')
  await page.getByRole('link', { name: 'Sign out' }).click()
  await page.goto('/reset-password/fixture-reset-token')
  await page.getByLabel('Password', { exact: true }).fill('replacement-password')
  await page.getByLabel('Confirm password', { exact: true }).fill('replacement-password')
  await page.getByRole('button', { name: 'Save password', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Password saved')
  await expect(page.getByRole('button', { name: 'Google', exact: true })).toBeVisible()
  expect(page.url()).toBe('http://127.0.0.1:8091/')
})
