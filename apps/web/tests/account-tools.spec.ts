import { test, expect, type Page } from './browser-fixture'

async function signIn(page: Page) {
  await page.goto('/')
  await page.getByLabel('Email', { exact: true }).fill('test@example.com')
  await page.getByLabel('Password', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Video library', exact: true })).toBeVisible()
}

test('creator page shares desktop cards, scopes and organization profiles', async ({ page }, info) => {
  await signIn(page)
  const personal = [
    { id: 1, name: 'Local Twitch Creator', description: 'Imported personal creator', scope: 'streamer', intro_id: 9, platform_links: [{ id: 1, platform: 'twitch', platform_id: 'local-channel', is_primary: true }] },
    { id: 2, name: 'Global Branding', description: 'Branding for every creator', scope: 'global', platform_links: [] },
    { id: 3, name: 'Studio Profile', scope: 'personal_studio', platform_links: [] },
  ]
  await page.route('**/api/web/account/**', route => {
    const path = new URL(route.request().url()).pathname.split('/web/account')[1]
    if (path === '/user/creator-profiles') return route.fulfill({ json: { success: true, profiles: personal } })
    if (path === '/user/assets') return route.fulfill({ json: { success: true, assets: [] } })
    if (path === '/user/assigned-creator-profiles') return route.fulfill({ json: { success: true, profiles: [{ id: 1, name: 'Team Kick Creator', scope: 'streamer', organization_id: 1, organization_name: 'Fixture Team', platform_links: [{ id: 2, platform: 'kick', platform_id: 'team-channel', is_primary: true }] }] } })
    return route.fulfill({ status: 404, json: { error: 'Unexpected creator request' } })
  })
  await page.goto('/?view=creators')
  await expect(page.getByRole('heading', { name: 'Creator profiles', exact: true })).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(3)
  await expect(page.getByRole('heading', { name: /^Organization profiles/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /^Your creator profiles/ })).toBeVisible()
  await expect(page.locator('.page-toolbar')).toContainText('4 creators')
  await page.screenshot({ path: info.outputPath('creators-desktop-view.png') })
  await page.getByPlaceholder('Search creators…').fill('local-channel')
  await expect(page.getByRole('article')).toHaveCount(1)
  await page.getByRole('article').getByTitle('More actions').click()
  await page.getByRole('menuitem', { name: 'Edit profile' }).click()
  await expect(page.getByPlaceholder('Creator name')).toHaveValue('Local Twitch Creator')
  await expect(page.getByPlaceholder('Channel slug or URL')).toHaveValue('local-channel')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('article').getByTitle('More actions').click()
  await page.getByRole('menuitem', { name: 'Delete creator', exact: true }).click()
  const confirmation = page.getByRole('dialog', { name: 'Delete Creator', exact: true })
  await expect(confirmation).toContainText('Local Twitch Creator')
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(confirmation).toHaveCount(0)
  await page.getByPlaceholder('Search creators…').fill('Team Kick Creator')
  await page.getByRole('article').getByTitle('More actions').click()
  await page.getByRole('menuitem', { name: 'Submit post link', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Submit post link', exact: true })).toBeVisible()
  await page.getByRole('dialog', { name: 'Submit post link', exact: true }).getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByPlaceholder('Search creators…').fill('')
  await page.getByRole('tab', { name: 'Global branding', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(1)
  await expect(page.locator('article h3')).toHaveText('Global Branding')
  await expect(page.getByRole('button', { name: 'Add global profile' })).toBeVisible()
})

test('custom prompts persist and system prompts remain read-only', async ({ page }, info) => {
  await signIn(page)
  // Same-origin embedding uses the website proxy in production; test the actual page directly here.
  await page.goto('/?view=prompts')
  await expect(page.getByRole('heading', { name: 'Default Clip Detector', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'New Prompt', exact: true }).click()
  await page.getByLabel('Name', { exact: true }).fill('Browser prompt test')
  await page.getByLabel('Prompt', { exact: true }).fill('Find concise explanations with a clear conclusion.')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.reload()
  const custom = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Browser prompt test', exact: true }) })
  await expect(custom).toBeVisible()
  const system = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Default Clip Detector', exact: true }) })
  await system.getByRole('button', { name: 'View', exact: true }).click()
  await expect(page.getByLabel('Prompt', { exact: true })).toHaveAttribute('readonly', '')
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await page.screenshot({ path: info.outputPath('prompts.png') })
  page.once('dialog', dialog => dialog.accept())
  await custom.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(custom).toHaveCount(0)
})

test('creator editing, campaign participation and calendar actions use the account APIs', async ({ page }, info) => {
  await signIn(page)
  const profiles: Array<Record<string, unknown>> = []
  const campaign = { id: 1, title: 'Fixture campaign', description: 'Campaign details', join_type: 'open', status: 'active', allowed_platforms: ['youtube'], per_clip_amount: '10', payment_model: 'per_clip' }
  let participation: { status: string } | null = null
  const post = { id: 3, caption: 'Scheduled fixture', scheduled_at: new Date().toISOString(), status: 'scheduled', can_cancel: true, can_edit: true }
  let canceled = false
  await page.route('**/api/web/account/**', async route => {
    const path = new URL(route.request().url()).pathname.split('/web/account')[1]
    const method = route.request().method()
    let data: Record<string, unknown> = { success: true }
    if (path === '/user/creator-profiles') {
      if (method === 'POST') profiles.push({ ...route.request().postDataJSON(), id: 1 })
      data.profiles = profiles
    } else if (path === '/user/assigned-creator-profiles') data.profiles = []
    else if (path === '/user/assets') data.assets = []
    else if (path === '/creator-channel') data = { username: 'Fixture channel', displayName: 'Fixture channel', profileImageUrl: null }
    else if (path === '/campaigns') data.campaigns = [campaign]
    else if (path === '/campaigns/1') data = { ...data, campaign, participation }
    else if (path === '/campaigns/1/apply') participation = { status: 'approved' }
    else if (path === '/settings/feature-flags') data.feature_flags = { campaigns_enabled: false }
    else if (path === '/social/scheduled') data.posts = canceled ? [] : [post]
    else if (path === '/social/scheduled/3/cancel') canceled = true
    else if (path === '/user/posts') data.posts = []
    else if (path === '/user/external-posts') data.submissions = []
    else return route.fulfill({ status: 404, json: { error: 'Unexpected test request' } })
    await route.fulfill({ json: data })
  })
  await page.goto('/?view=creators')
  await page.locator('[data-tour-id=\"tour-add-creator\"]').click()
  await page.getByPlaceholder('Creator name').fill('Fixture creator')
  await page.getByRole('button', { name: /^Add platform/ }).click()
  await page.getByRole('button', { name: /PumpFun/ }).click()
  await page.getByRole('menuitem', { name: /Twitch/ }).click()
  await page.getByPlaceholder('Channel slug or URL').fill('fixture-channel')
  await page.getByRole('button', { name: 'Create profile', exact: true }).click()
  await expect(page.locator('article h3', { hasText: 'Fixture creator' })).toBeVisible()
  expect(profiles[0].platform_links).toEqual([expect.objectContaining({ platform: 'twitch', platform_id: 'fixture-channel', is_primary: true })])
  await page.goto('/?view=campaigns')
  await page.getByRole('button', { name: 'View Campaign', exact: true }).click()
  await page.getByRole('button', { name: 'Join campaign', exact: true }).click()
  await expect(page.getByText('Your participation: approved')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Submit clip', exact: true })).toBeVisible()
  await page.goto('/?view=calendar')
  await page.getByRole('button', { name: /Scheduled fixture/ }).click()
  await expect(page.getByRole('button', { name: 'Save schedule', exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('calendar.png') })
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Cancel scheduled post', exact: true }).click()
  await expect(page.getByText('Post canceled.', { exact: true })).toBeVisible()
  expect(canceled).toBe(true)
})
