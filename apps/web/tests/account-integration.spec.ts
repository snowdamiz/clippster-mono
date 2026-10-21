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
  for (const label of ['Home', 'Download Video', 'Video Library', 'Built Clips', 'Messages', 'Billing', 'Organizations']) {
    await expect(page.locator('aside').first().getByRole('link', { name: label, exact: true })).toBeVisible()
  }
  await page.screenshot({ path: info.outputPath('account-dashboard.png') })
  await page.locator('aside').first().getByRole('link', { name: 'Video Library', exact: true }).click()
  const workspace = page.frameLocator('iframe[title="Clippster video workspace"]')
  await expect(workspace.getByRole('heading', { name: 'Video library', exact: true })).toHaveText('Video library')
  await expect(workspace.getByRole('heading', { name: 'Sign In', exact: true })).toBeHidden()
  await expect(workspace.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('account-videos.png') })
  await workspace.locator('header').getByRole('button', { name: 'New project', exact: true }).click()
  await workspace.getByLabel('Project name').fill('Integrated account clip')
  const source = info.outputPath('source.mp4')
  execFileSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
    '-i', 'testsrc2=size=320x180:rate=24:duration=94', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=94',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', '-y', source])
  const chooser = page.waitForEvent('filechooser')
  await workspace.getByRole('button', { name: 'Select videos from computer', exact: true }).click()
  await (await chooser).setFiles(source)
  await workspace.getByRole('button', { name: 'Create project', exact: true }).click()
  await workspace.getByRole('button', { name: 'Open workspace: Integrated account clip', exact: true }).click()
  await expect(page).toHaveURL(/\/account\/videos\?project=/)
  await expect(workspace.getByRole('region', { name: 'Project workspace' })).toBeVisible()
  await expect(workspace.locator('video').first()).toHaveJSProperty('readyState', 4, { timeout: 30_000 })
  await page.reload()
  await expect(workspace.getByRole('region', { name: 'Project workspace' })).toBeVisible()
  await workspace.getByRole('button', { name: 'Detect clips', exact: true }).click()
  await workspace.getByRole('dialog').getByRole('combobox').first().click()
  await workspace.getByRole('option').first().click()
  await workspace.getByRole('dialog').getByRole('button', { name: 'Detect clips', exact: true }).click()
  await expect(workspace.getByRole('heading', { name: /AI highlight/ })).toBeVisible({ timeout: 30_000 })
  await workspace.getByTitle('Clip actions', { exact: true }).click()
  await workspace.getByRole('menuitem', { name: 'Build clip', exact: true }).click()
  await workspace.getByRole('button', { name: 'Next', exact: true }).click()
  await workspace.getByRole('button', { name: 'Next', exact: true }).click()
  await workspace.getByRole('button', { name: 'Build 1 video', exact: true }).click()
  await expect(workspace.getByTitle('Download clip', { exact: true })).toBeVisible({ timeout: 60_000 })
  const download = page.waitForEvent('download')
  await workspace.getByTitle('Download clip', { exact: true }).click()
  await workspace.getByRole('menuitem').filter({ hasText: '16:9' }).click()
  expect((await download).suggestedFilename()).toContain('AI highlight')
  await page.locator('aside').first().getByRole('link', { name: 'Built Clips', exact: true }).click()
  await expect(workspace.getByRole('heading', { name: 'Built Clips', exact: true })).toBeVisible()
  await workspace.getByTitle('List View', { exact: true }).click()
  const builtCard = workspace.locator('[data-build-id]').filter({ hasText: 'AI highlight' })
  await expect(builtCard).toBeVisible()
  await builtCard.hover()
  await builtCard.getByRole('button', { name: 'More actions', exact: true }).click()
  await workspace.getByRole('menuitem', { name: 'Open in project', exact: true }).click()
  await expect(page).toHaveURL(/\/account\/videos\?project=.+&clip=/)
  await expect(workspace.getByRole('region', { name: 'Project workspace' })).toBeVisible()
  await workspace.getByRole('button', { name: 'Close workspace', exact: true }).click()
  await expect(page).toHaveURL(/\/account\/clips$/)
  await expect(workspace.getByRole('heading', { name: 'Built Clips', exact: true })).toBeVisible()
  await expect(page.locator('aside').first().getByRole('link', { name: 'Organizations', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('account sidebar opens every embedded workspace page without falling back to the library', async ({ page }, info) => {
  const errors: string[] = []
  const startups: string[] = []
  let libraryLoads = 0
  page.on('request', request => {
    const path = new URL(request.url()).pathname
    if (path === '/workspace/' || path === '/workspace/api/auth/session') startups.push(path)
    if (path === '/workspace/api/web/projects') libraryLoads++
  })
  page.on('pageerror', error => errors.push(error.message))
  await account(page)
  await page.route('**/api/settings/feature-flags', route => route.fulfill({ json: { success: true, feature_flags: { campaigns_enabled: true } } }))
  await page.route('**/api/user/restrictions', route => route.fulfill({ json: { success: true, restricted: false, restrictions: {} } }))
  await page.goto('/account')
  const workspace = page.frameLocator('iframe[title="Clippster video workspace"]')
  let initialStartups: string[] = []
  for (const [label, heading] of [
    ['My Creators', 'Creator profiles'], ['Download Video', 'Download video'],
    ['Video Library', 'Video library'], ['Built Clips', 'Built Clips'],
    ['Campaigns', 'Campaigns'], ['Prompts', 'Prompts'], ['Calendar', 'Calendar'],
  ]) {
    await page.locator('aside').first().getByRole('link', { name: label, exact: true }).click()
    await expect(workspace.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible()
    if (label === 'My Creators') {
      initialStartups = [...startups]
      expect(libraryLoads).toBe(0)
      await workspace.locator('body').evaluate(element => element.setAttribute('data-workspace-instance', 'original'))
    }
    expect(startups).toEqual(initialStartups)
    await expect(workspace.locator('body')).toHaveAttribute('data-workspace-instance', 'original')
    await expect(workspace.getByRole('dialog', { name: /New project|Create Project/ })).toHaveCount(0)
    await page.screenshot({ path: info.outputPath(`${label.replaceAll(' ', '-')}.png`) })
  }
  await page.goBack()
  await expect(workspace.getByRole('heading', { name: 'Prompts', exact: true }).first()).toBeVisible()
  await page.goForward()
  await expect(workspace.getByRole('heading', { name: 'Calendar', exact: true }).first()).toBeVisible()
  await page.evaluate(() => window.addEventListener('clippster-before-workspace-navigation', event => event.preventDefault(), { once: true }))
  page.once('dialog', dialog => dialog.dismiss())
  await page.locator('aside').first().getByRole('link', { name: 'Video Library', exact: true }).click()
  await expect(page).toHaveURL(/\/account\/calendar$/)
  await expect(workspace.getByRole('heading', { name: 'Calendar', exact: true }).first()).toBeVisible()
  expect(startups).toEqual(initialStartups)
  expect(errors).toEqual([])
})

test('workspace uses the latest route when navigation changes during startup', async ({ page }) => {
  await account(page)
  let releasePermissions!: () => void
  const permissions = new Promise<void>(resolve => { releasePermissions = resolve })
  await page.route('**/workspace/api/web/account/user/restrictions', async route => {
    await permissions
    await route.fulfill({ json: { success: true, restricted: false, restrictions: {} } })
  })
  await page.goto('/account/videos')
  const workspace = page.frameLocator('iframe[title="Clippster video workspace"]')
  await expect(workspace.getByText('Opening your workspace…', { exact: true })).toBeVisible()
  await page.locator('aside').first().getByRole('link', { name: 'Download Video', exact: true }).click()
  releasePermissions()
  await expect(workspace.getByRole('heading', { name: 'Download video', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/account\/downloads$/)
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

test('admin dashboard shows unlimited access instead of stored Free plan and 60 credits', async ({ page }) => {
  await account(page, { is_admin: true, subscription: { status: 'none', tier: null }, credits: { hours_remaining: '60.00' } })
  await page.goto('/account')
  await expect(page.getByText('Admin', { exact: true })).toBeVisible()
  await expect(page.getByText('Unlimited', { exact: true })).toBeVisible()
  await expect(page.getByText('Unlimited access', { exact: true })).toBeVisible()
  await expect(page.getByText('Free', { exact: true })).toHaveCount(0)
  await expect(page.getByText('60.00', { exact: true })).toHaveCount(0)
})

test('signed-out visitors cannot access the account video routes', async ({ page }) => {
  await page.goto('/account/videos')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.locator('iframe')).toHaveCount(0)
})

test('Clipper Profile uses desktop tabs, profile editor and account settings', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await account(page, { owned_organization_id: 7 })
  let profile = { id: 1, user_id: 1, display_name: 'Fixture Clipper', slug: 'fixture-clipper', bio: 'Clips and highlights', avatar_url: '', is_public: true, looking_for_work: true, specialty_tags: ['Gaming'], total_campaigns_completed: 3, total_clips_delivered: 20, total_endorsements: 4, channel_links: [], portfolio_clips: [] }
  await page.route('**/api/user/**', route => route.fulfill({ json: { success: true, accounts: [], social_accounts: [], posts: [], methods: [], payment_methods: [], campaigns: [], submissions: [], portfolio_clips: [], channel_links: [], preferences: {}, restrictions: {}, summary: {} } }))
  await page.route('**/api/clippers/leaderboard**', route => route.fulfill({ json: { success: true, entries: [] } }))
  await page.route('**/api/settings/feature-flags', route => route.fulfill({ json: { success: true, feature_flags: {} } }))
  await page.route('**/api/hiring-posts**', route => route.fulfill({ json: { success: true, posts: [], applications: [] } }))
  await page.route('**/api/user/clipper-profile', async route => {
    if (route.request().method() === 'PUT') profile = { ...profile, ...route.request().postDataJSON() }
    await route.fulfill({ json: { success: true, profile } })
  })
  let remotePosts: any[] = []
  await page.route('**/api/user/posts', route => route.fulfill({ json: { success: true, posts: remotePosts } }))
  await page.route('**/workspace/api/web/profile-media/post-thumbnail/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF1sAAAAASUVORK5CYII=', 'base64') }))
  await page.goto('/account/profile')
  const workspace = page.frameLocator('iframe')
  await expect(workspace.getByText('Fixture Clipper', { exact: true }).first()).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 360 })
  const scrollArea = workspace.locator('.page-layout__content')
  await scrollArea.evaluate(element => { element.scrollTop = element.scrollHeight })
  await expect.poll(() => scrollArea.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
  await scrollArea.evaluate(element => { element.scrollTop = 0 })
  await page.setViewportSize({ width: 1440, height: 960 })
  for (const label of ['Leaderboard', 'Accounts', 'Payments', 'Campaigns', 'Posts']) await expect(workspace.getByRole('tablist').first().getByRole('tab', { name: label, exact: true })).toBeVisible()
  await workspace.getByRole('button', { name: 'Edit profile', exact: true }).click()
  await workspace.getByPlaceholder('Your public name').fill('Updated Clipper')
  await workspace.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(workspace.getByRole('button', { name: 'Save changes', exact: true })).toHaveCount(0)
  await workspace.getByRole('link', { name: 'My profile', exact: true }).click()
  await expect(workspace.getByText('Updated Clipper', { exact: true }).first()).toBeVisible()
  await workspace.getByRole('tablist').first().getByRole('tab', { name: 'Posts', exact: true }).click()
  remotePosts = [{ id: 1, source: 'organization', platform: 'x', caption: 'Posted from another client', status: 'published', view_count: 0, like_count: 0, thumbnail_url: 'https://media.example.test/post.png', inserted_at: '2026-10-12T00:00:00Z' }]
  await expect(workspace.getByText('Posted from another client', { exact: true })).toBeVisible({ timeout: 15000 })
  await expect.poll(() => workspace.locator('img[src*="/profile-media/post-thumbnail/"]').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
  profile = { ...profile, bio: 'Changed from another client' }
  await expect(workspace.getByText('Changed from another client', { exact: true })).toBeVisible({ timeout: 15000 })
  await page.screenshot({ path: info.outputPath('native-clipper-profile.png') })
  await page.getByRole('button', { name: 'Account menu', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Account Settings', exact: true }).click()
  const settings = page.getByRole('dialog', { name: 'Account Settings', exact: true }).frameLocator('iframe')
  await settings.getByRole('button', { name: 'Preferences', exact: true }).click()
  await expect(settings.getByRole('switch', { name: '24-hour time', exact: true })).toBeVisible()
  await expect(settings.getByText(/App tours/i)).toHaveCount(0)
  await expect(settings.getByRole('button', { name: /Delete data/i })).toHaveCount(0)
  await settings.getByRole('button', { name: 'Notifications', exact: true }).click()
  await expect(settings.getByText(/Background notifications/i)).toHaveCount(0)
  await expect(settings.getByText('Livestream', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('native-account-settings.png') })
  expect(errors).toEqual([])
})
