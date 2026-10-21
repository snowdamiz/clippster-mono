import { test, expect } from './browser-fixture'

test('personal, organization and campaign creators survive refresh and partial failures', async ({ page }) => {
  await page.request.post('/api/auth/email/login', {
    headers: { Origin: 'http://127.0.0.1:8091' },
    data: { email: 'test@example.com', password: 'test-password' }
  })
  let failPersonal = false
  let name = 'Desktop personal creator'
  const profile = (id: number, name: string) => ({ id, name, scope: 'streamer', platform_links: [{ id, platform: 'twitch', platform_id: 'creator-channel', is_primary: true }] })
  await page.route('**/api/web/account/user/**', async route => {
    const path = new URL(route.request().url()).pathname.split('/user/')[1]
    if (path === 'creator-profiles') return route.fulfill(failPersonal
      ? { status: 503, json: { error: 'Creator service temporarily unavailable' } }
      : { json: { success: true, profiles: [profile(11, name)] } })
    if (path === 'assigned-creator-profiles') return route.fulfill({ json: { success: true, profiles: [{ ...profile(22, 'Organization creator'), organization_id: 7, organization_name: 'Our organization' }] } })
    if (path === 'campaigns') return route.fulfill({ json: { success: true, campaigns: [{ id: 33, title: 'Assigned campaign', organization_id: 7, organization: { name: 'Our organization' }, creator_profile_id: 44, branding_profile_id: null, creator_profiles: [profile(44, 'Campaign creator')], inserted_at: new Date().toISOString(), updated_at: new Date().toISOString() }] } })
    if (path === 'assets') return route.fulfill({ json: { success: true, assets: [] } })
    return route.continue()
  })
  await page.goto('/?view=creators')
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Organization creator', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Assigned campaign/ }).click()
  await expect(page.getByText('Campaign creator', { exact: true })).toBeVisible()
  name = 'Updated in Tauri'
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
  failPersonal = true
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Could not load personal creators')
  await expect(page.getByRole('heading', { name: 'Organization creator', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
  failPersonal = false
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
})
