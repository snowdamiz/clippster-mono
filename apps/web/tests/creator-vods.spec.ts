import { test, expect } from '@playwright/test'
test('creator VOD browsing and latest downloads open projects without leaving the workspace', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Email', { exact: true }).fill('test@example.com')
  await page.getByLabel('Password', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  const vods = [{ id: 'older', title: 'Older completed stream', duration_seconds: 900, url: 'https://www.twitch.tv/videos/123' }, { id: 'newest', title: 'Latest completed stream', duration_seconds: 1200, url: 'https://www.twitch.tv/videos/456' }]
  const imports: Array<Record<string, unknown>> = []
  await page.route('**/api/web/account/**', route => {
    const url = new URL(route.request().url()), path = url.pathname.split('/web/account')[1]
    if (path === '/user/creator-profiles') return route.fulfill({ json: { success: true, profiles: [{ id: 1, name: 'Fixture streamer', scope: 'streamer', platform_links: [{ id: 1, platform: 'twitch', platform_id: 'fixture-channel', is_primary: true }] }] } })
    if (path === '/user/assigned-creator-profiles') return route.fulfill({ json: { success: true, profiles: [] } })
    if (path === '/user/assets') return route.fulfill({ json: { success: true, assets: [] } })
    if (path === '/media/vods') {
      expect(url.searchParams.get('channel')).toBe('fixture-channel')
      expect(url.searchParams.get('platform')).toBe('twitch')
      return route.fulfill({ json: { success: true, vods } })
    }
    return route.fulfill({ status: 404, json: {} })
  })
  await page.route('**/api/web/projects/*/import', route => { imports.push(route.request().postDataJSON()); return route.fulfill({ status: 202, json: { id: 'fixture-job', status: 'queued' } }) })
  await page.goto('/?view=creators')
  await page.locator('.creator-card').getByTitle('More actions').click()
  await page.getByRole('menuitem', { name: 'View VODs', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Search VODs', exact: true })).toBeVisible()
  await page.locator('.vod-card').filter({ hasText: 'Older completed stream' }).getByTitle('Download', { exact: true }).click()
  let download = page.getByRole('dialog', { name: 'Download Options', exact: true })
  await expect(download.getByText('Older completed stream', { exact: true })).toBeVisible()
  await download.getByRole('button', { name: 'Start Download', exact: true }).click()
  await expect.poll(() => imports.length).toBe(1)
  expect(imports[0].url).toBe(vods[0].url)
  await expect(page.getByRole('heading', { name: 'Older completed stream', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Project workspace', exact: true })).toHaveCount(0)
  expect(new URL(page.url()).pathname).toBe('/')
  await page.goto('/?view=creators')
  await page.locator('.creator-card').getByTitle('More actions').click()
  await page.getByRole('menuitem', { name: 'Download VOD', exact: true }).click()
  download = page.getByRole('dialog', { name: 'Download Latest VOD', exact: true })
  await expect(download.getByText('Older completed stream', { exact: true })).toBeVisible()
  await download.getByRole('button', { name: 'Start Download', exact: true }).click()
  await expect.poll(() => imports.length).toBe(2)
  expect(imports[1].url).toBe(vods[0].url)
  await expect(page.getByRole('heading', { name: 'Older completed stream', exact: true })).toBeVisible()
})
