import { test, expect, type Page } from '@playwright/test'

async function signIn(page: Page) {
  await page.goto('/')
  await page.getByLabel('Email', { exact: true }).fill('test@example.com')
  await page.getByLabel('Password', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await expect(page.locator('.page-header__title')).toBeVisible()
}

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
    else if (path === '/campaigns') data.campaigns = [campaign]
    else if (path === '/campaigns/1') data = { ...data, campaign, participation }
    else if (path === '/campaigns/1/apply') participation = { status: 'approved' }
    else if (path === '/app-settings/feature-flags') data.feature_flags = { campaigns_enabled: false }
    else if (path === '/social/scheduled') data.posts = canceled ? [] : [post]
    else if (path === '/social/scheduled/3/cancel') canceled = true
    else if (path === '/user/posts') data.posts = []
    else if (path === '/user/external-posts') data.submissions = []
    else return route.fulfill({ status: 404, json: { error: 'Unexpected test request' } })
    await route.fulfill({ json: data })
  })
  await page.goto('/?view=creators')
  await page.getByRole('button', { name: 'New Profile', exact: true }).click()
  await page.getByLabel('Name', { exact: true }).fill('Fixture creator')
  await page.getByRole('button', { name: 'Add platform', exact: true }).click()
  await page.getByLabel('Channel identifier').fill('fixture-channel')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Fixture creator', exact: true })).toBeVisible()
  expect(profiles[0].platform_links).toEqual([{ platform: 'twitch', platform_id: 'fixture-channel', is_primary: true }])
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
