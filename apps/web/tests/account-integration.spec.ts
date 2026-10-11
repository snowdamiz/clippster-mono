import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import type { Page } from '@playwright/test'

async function account(page: Page, overrides: Record<string, unknown> = {}) {
  const user = { id: 1, email: 'test@example.com', name: 'Test account', account_type: 'personal',
    has_selected_plan: true, subscription: { status: 'active', tier: 'creator' }, ...overrides }
  await page.addInitScript(({ user }) => {
    localStorage.setItem('auth_token', 'fixture-token-1')
    localStorage.setItem('auth_provider', 'email')
    localStorage.setItem('user', JSON.stringify(user))
  }, { user })
  await page.route('**/api/auth/me', route => {
    if (new URL(route.request().url()).pathname.startsWith('/workspace/')) return route.continue()
    return route.fulfill({ json: { success: true, user } })
  })
  return user
}

test('account navigation includes videos and preserves organization and billing, without a second login', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await account(page, { owned_organization_id: 7 })
  await page.goto('/account')
  for (const label of ['Home', 'Download Video', 'Video Library', 'Messages', 'Profile', 'Social', 'Posts', 'Settings', 'Billing', 'Organization']) {
    await expect(page.locator('aside').first().getByRole('link', { name: label, exact: true })).toBeVisible()
  }
  await page.screenshot({ path: info.outputPath('account-dashboard.png') })
  await page.locator('aside').first().getByRole('link', { name: 'Video Library', exact: true }).click()
  const workspace = page.frameLocator('iframe[title="Clippster video workspace"]')
  await expect(workspace.locator('.page-header__title')).toHaveText('Video Library')
  await expect(workspace.getByRole('heading', { name: 'Sign In', exact: true })).toBeHidden()
  await expect(workspace.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('account-videos.png') })
  await workspace.getByRole('button', { name: 'New Project', exact: true }).click()
  await workspace.getByLabel('Project name').fill('Integrated account clip')
  await workspace.getByRole('button', { name: 'Create Project', exact: true }).click()
  const source = info.outputPath('source.mp4')
  execFileSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
    '-i', 'testsrc2=size=320x180:rate=24:duration=6', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=6',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', '-y', source])
  await workspace.getByLabel('Upload source video').setInputFiles(source)
  await expect(workspace.getByRole('button', { name: 'Find clips', exact: true })).toBeEnabled({ timeout: 30_000 })
  await workspace.getByRole('button', { name: 'Find clips', exact: true }).click()
  await expect(workspace.getByLabel('Name', { exact: true })).toHaveValue('AI highlight', { timeout: 30_000 })
  await workspace.getByRole('button', { name: 'Build clip', exact: true }).click()
  await expect(workspace.getByRole('link', { name: 'Download MP4' })).toBeVisible({ timeout: 60_000 })
  const download = page.waitForEvent('download')
  await workspace.getByRole('link', { name: 'Download MP4' }).click()
  expect((await download).suggestedFilename()).toBe('AI highlight.mp4')
  await expect(page.locator('aside').first().getByRole('link', { name: 'Organization', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('new users choose a plan before accessing videos and Free selection returns to the combined account', async ({ page }) => {
  const user = await account(page, { has_selected_plan: false, subscription: { status: 'none' } })
  await page.route('**/api/subscription/tiers', route => route.fulfill({ json: { success: true, tiers: [] } }))
  await page.route('**/api/subscription/select-free', route => {
    user.has_selected_plan = true
    return route.fulfill({ json: { success: true, has_selected_plan: true } })
  })
  await page.goto('/account/videos')
  await expect(page).toHaveURL(/\/account\/billing/)
  await expect(page.getByText('Choose a plan to continue', { exact: true })).toBeVisible()
  await expect(page.locator('iframe')).toHaveCount(0)
  await page.getByRole('button', { name: /Continue with Free/ }).click()
  await expect(page).toHaveURL(/\/account$/)
  await expect(page.locator('aside').first().getByRole('link', { name: 'Video Library', exact: true })).toBeVisible()
})

test('signed-out visitors cannot access the account video routes', async ({ page }) => {
  await page.goto('/account/videos')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.locator('iframe')).toHaveCount(0)
})
