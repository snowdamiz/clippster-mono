import { test, expect } from './browser-fixture'

test('failed downloads show their status and retry action after the UI merge', async ({ page }) => {
  await page.request.post('/api/auth/email/login', { headers: { Origin: 'http://127.0.0.1:8091' }, data: { email: 'test@example.com', password: 'test-password' } })
  const project = { id: 'failed-download', name: 'Failed VOD', status: 'error', error: 'Provider unavailable', createdAt: Date.now(), updatedAt: Date.now(), duration: 0, clips: [], words: [], sourceUrl: 'https://www.twitch.tv/videos/123' }
  await page.route('**/api/web/projects', route => route.fulfill({ json: { projects: [project], jobs: [] } }))
  let retries = 0
  await page.route('**/api/web/projects/failed-download/import', route => {
    retries++
    return route.fulfill({ status: 503, json: { error: 'Please retry later' } })
  })
  await page.goto('/')
  await expect(page.getByText('Download failed', { exact: true })).toBeVisible()
  await page.getByTitle('Retry download', { exact: true }).click()
  await expect.poll(() => retries).toBe(1)
  await expect(page.getByRole('alert')).toContainText('Please retry later')
})

test('library shows desktop download progress then a video card without opening the workspace', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Email', { exact: true }).fill('test@example.com')
  await page.getByLabel('Password', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  let completed = false
  const project = { id: 'progress-fixture', name: 'Downloaded VOD', status: 'importing', createdAt: Date.now(), updatedAt: Date.now(), duration: 900, clips: [], words: [], hasAudio: true, sourceUrl: 'https://kick.com/fixture/videos/123' }
  await page.route('**/api/web/projects', route => route.fulfill({ json: { projects: [{ ...project, status: completed ? 'ready' : 'importing' }], jobs: completed ? [] : [{ id: 'download-fixture', projectId: project.id, kind: 'import', status: 'running', progress: 45 }] } }))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Active downloads 1' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Downloaded VOD' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancel download', exact: true })).toHaveCount(1)
  completed = true
  await expect(page.getByRole('button', { name: 'Cancel download', exact: true })).toHaveCount(0, { timeout: 10_000 })
  await expect(page.getByRole('heading', { name: 'Downloaded VOD' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Project workspace' })).toHaveCount(0)
})
