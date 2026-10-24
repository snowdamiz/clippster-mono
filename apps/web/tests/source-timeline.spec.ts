import { test, expect } from './browser-fixture'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'

test('selected source range stays positioned and bounded while trimming and reloading', async ({ page }, info) => {
  const origin = 'http://127.0.0.1:8091', request = page.request
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await request.post('/api/auth/email/login', { headers: { Origin: origin }, data: { email: 'test@example.com', password: 'test-password' } })
  const source = info.outputPath('timeline-source.mp4'); mkdirSync(dirname(source), { recursive: true })
  execFileSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=160x90:rate=4:duration=40', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=40', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', '-y', source])
  const { project } = await (await request.post('/api/web/projects', { headers: { Origin: origin }, data: { name: 'Source timeline regression' } })).json()
  const path = `/api/web/projects/${project.id}`
  expect((await request.put(path + '/source', { headers: { Origin: origin, 'Content-Type': 'application/octet-stream' }, data: readFileSync(source) })).ok()).toBeTruthy()
  await expect.poll(async () => (await (await request.get(path)).json()).project.status).toBe('ready')
  expect((await request.post(path + '/clips', { headers: { Origin: origin }, data: { name: 'Later in the source', aspectRatio: '16:9', captions: false, segments: [{ start_time: 22, end_time: 25 }] } })).ok()).toBeTruthy()
  await page.goto('/?project=' + project.id)
  await expect(page.getByRole('region', { name: 'Project workspace' })).toBeVisible()
  const track = page.locator('[data-video-track]'), segment = page.locator('.clip-segment').first()
  await expect(segment).toBeVisible()
  await expect(page.locator('video').first()).toHaveJSProperty('readyState', 4)
  const original = (await track.boundingBox())!, clip = (await segment.boundingBox())!
  expect((clip.x - original.x) / original.width).toBeCloseTo(.55, 2)
  expect(clip.width / original.width).toBeCloseTo(.075, 2)
  expect(clip.x + clip.width).toBeLessThanOrEqual(original.x + original.width + 1)
  await page.screenshot({ path: info.outputPath('source-position.png') })

  const handle = (await segment.locator('.resize-handle-right').boundingBox())!
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(handle.x + handle.width / 2 + original.width * 2 / 40, handle.y + handle.height / 2, { steps: 12 })
  await page.mouse.up()
  await expect.poll(async () => (await (await request.get(path)).json()).project.clips[0].segments[0].end_time).toBeCloseTo(27, 1)
  await page.reload()
  await expect(segment).toBeVisible()
  const reloadedTrack = (await track.boundingBox())!, reloadedClip = (await segment.boundingBox())!
  expect((reloadedClip.x - reloadedTrack.x) / reloadedTrack.width).toBeCloseTo(.55, 2)
  expect(reloadedClip.width / reloadedTrack.width).toBeCloseTo(.125, 2)
  await page.getByRole('button', { name: 'Zoom to selected clip', exact: true }).click()
  await page.getByRole('button', { name: 'Fit entire source', exact: true }).click()
  await expect(page.locator('video').first()).toHaveAttribute('src', /\/source$/)
  expect(errors).toEqual([])
})
