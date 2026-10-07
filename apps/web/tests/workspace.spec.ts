import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
test('sign in, upload, AI clip, trim, render, download, and reopen a project', async ({
  page
}, testInfo) => {
  const projectName = `Browser smoke test ${testInfo.repeatEachIndex}`
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Sign In', exact: true })).toBeVisible()
  await page.getByLabel('Email', { exact: true }).fill('test@example.com')
  await page.getByLabel('Password', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await expect(page.locator('.page-header__title')).toBeVisible()
  await page.getByRole('button', { name: 'New Project', exact: true }).click()
  await page.getByLabel('Project name').fill(projectName)
  await page.getByRole('button', { name: 'Create Project', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Project workspace' })).toBeVisible()
  const source = testInfo.outputPath('source.mp4')
  mkdirSync(resolve(source, '..'), { recursive: true })
  execFileSync(process.env.FFMPEG_PATH || 'ffmpeg', [
    '-hide_banner',
    '-loglevel',
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
  await page.getByLabel('Upload source video').setInputFiles(source)
  await expect(page.getByRole('button', { name: 'Find clips', exact: true })).toBeEnabled({
    timeout: 30_000
  })
  await page.getByRole('button', { name: 'Find clips', exact: true }).click()
  await expect(page.getByRole('button', { name: /AI highlight.*2.0s/ })).toBeVisible({
    timeout: 30_000
  })
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('AI highlight')
  await expect(page.locator('video').first()).toHaveJSProperty('readyState', 4)
  await page.getByLabel('Name', { exact: true }).fill('My first web clip')
  await page.getByLabel('End (seconds)').last().fill('4.9')
  await page.getByRole('button', { name: 'Save & build clip' }).click()
  await expect(page.getByRole('link', { name: 'Download MP4' })).toBeVisible({ timeout: 60_000 })
  const downloaded = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Download MP4' }).click()
  const download = await downloaded
  expect(download.suggestedFilename()).toBe('My first web clip.mp4')
  const path = testInfo.outputPath('clip.mp4')
  await download.saveAs(path)
  const duration = Number(
    execFileSync(
      process.env.FFPROBE_PATH || 'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', path],
      { encoding: 'utf8' }
    )
  )
  expect(duration).toBeCloseTo(2.5, 0)
  // Unsaved edits must neither expose an outdated export nor silently disappear.
  await page.getByLabel('Name', { exact: true }).fill('Unsaved edit')
  await expect(page.getByRole('link', { name: 'Download MP4' })).toBeHidden()
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'Close workspace' }).click()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Unsaved edit')
  await page.getByRole('button', { name: 'Revert', exact: true }).click()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('My first web clip')
  await expect(page.getByRole('link', { name: 'Download MP4' })).toBeVisible()
  await page.getByLabel('Aspect ratio').selectOption('16:9')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await expect(page.getByRole('link', { name: 'Download MP4' })).toBeHidden()
  await page.getByRole('button', { name: 'Build clip', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Download MP4' })).toBeVisible({ timeout: 60_000 })
  const landscapeDownload = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Download MP4' }).click()
  const landscapePath = testInfo.outputPath('landscape.mp4')
  await (await landscapeDownload).saveAs(landscapePath)
  const metadata = JSON.parse(
    execFileSync(
      process.env.FFPROBE_PATH || 'ffprobe',
      [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=width,height',
        '-of',
        'json',
        landscapePath
      ],
      { encoding: 'utf8' }
    )
  )
  expect(metadata.streams[0]).toMatchObject({ width: 1920, height: 1080 })
  await page.screenshot({ path: testInfo.outputPath('workspace-desktop.png') })
  await page.getByRole('button', { name: 'Close workspace' }).click()
  await page.reload()
  await page
    .locator('.project-card')
    .filter({ has: page.getByRole('heading', { name: projectName, exact: true }) })
    .click()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('My first web clip')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: testInfo.outputPath('workspace-mobile.png') })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  )
  expect(errors).toEqual([])
})
