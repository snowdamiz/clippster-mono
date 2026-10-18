import { test, expect } from './browser-fixture'
import { execFileSync } from 'node:child_process'
import { readFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
test('merged UI preserves browser workspace and export navigation', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const origin = 'http://127.0.0.1:8091',
    request = page.request
  await request.post('/api/auth/email/login', {
    headers: { Origin: origin },
    data: { email: 'test@example.com', password: 'test-password' }
  })
  const source = testInfo.outputPath('source.mp4')
  mkdirSync(dirname(source), { recursive: true })
  execFileSync(process.env.FFMPEG_PATH || 'ffmpeg', [
    '-v',
    'error',
    '-f',
    'lavfi',
    '-i',
    'testsrc2=size=320x180:rate=24:duration=6',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:duration=6',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-shortest',
    '-y',
    source
  ])
  const created = await request.post('/api/web/projects', {
    headers: { Origin: origin },
    data: { name: 'Desktop workspace parity' }
  })
  const { project } = await created.json()
  expect(
    (
      await request.put('/api/web/projects/' + project.id + '/source', {
        headers: { Origin: origin, 'Content-Type': 'application/octet-stream' },
        data: readFileSync(source)
      })
    ).ok()
  ).toBeTruthy()
  await expect
    .poll(
      async () =>
        (await (await request.get('/api/web/projects/' + project.id)).json()).project.status
    )
    .toBe('ready')
  const saved = await request.post('/api/web/projects/' + project.id + '/clips', {
    headers: { Origin: origin },
    data: {
      name: 'Manual highlight',
      aspectRatio: '16:9',
      captions: false,
      segments: [
        { start_time: 0.4, end_time: 1.4 },
        { start_time: 3.4, end_time: 4.4 }
      ]
    }
  })
  expect(saved.ok()).toBeTruthy()
  await page.goto('/?project=' + project.id)
  await expect(page.getByRole('region', { name: 'Project workspace' })).toBeVisible()
  await expect(page.locator('video').first()).toHaveJSProperty('readyState', 4)
  await expect(page.getByTitle('Zoom in', { exact: true })).toBeVisible()
  await expect(page.getByTitle('Add new clip (N key)')).toBeVisible()
  await expect(page.locator('[data-video-track]')).toBeVisible()
  await expect(page.locator('[data-media-panel]')).toContainText('Manual highlight')
  await page.screenshot({ path: testInfo.outputPath('desktop-workspace-page.png') })
  await page.getByTitle('Clip actions', { exact: true }).click()
  await expect(page.getByRole('menuitem', { name: /Edit clip/i })).toHaveCount(0)
  await page.getByRole('menuitem', { name: 'Build clip', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Export configuration', exact: true })
  ).toBeVisible()
  await page.getByRole('button', { name: /1:1/ }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Framing & layout', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Export settings', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: '60 FPS', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Build 2 videos', exact: true })).toBeEnabled()
  await page.screenshot({ path: testInfo.outputPath('merged-export.png') })
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByTitle('Clip actions', { exact: true }).click()
  await page.getByRole('menuitem', { name: 'Publish now', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Quick publish', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /No, skip subtitles/ }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('button', { name: /Publish \(/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Built clips 1', exact: true })).toBeVisible()
  await page.getByRole('checkbox', { name: 'YouTube YouTube', exact: true }).click()
  await page.getByRole('combobox').click()
  await page.getByRole('option', { name: /Fixture channel/ }).click()
  await expect(page.getByRole('button', { name: 'Publish (1)', exact: true })).toBeEnabled()
  expect(errors).toEqual([])
})
