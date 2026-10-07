import { test, expect } from '@playwright/test'
for (const theme of ['desktop', 'web']) {
  test(`shared player, captions, controls, media adapter, and header with ${theme} styles`, async ({
    page
  }, info) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`http://127.0.0.1:8093/?theme=${theme}`)
    await expect(page.getByRole('heading', { name: 'Shared workspace test' })).toBeVisible()
    await expect(page.getByText('9:16 Pre-Edit')).toBeVisible()
    const video = page.getByTestId('project-video')
    await expect(video).toHaveJSProperty('readyState', 4)
    await expect(page.locator('.subtitle-text-container')).toContainText('CAPTION')
    await page.getByTitle('Play/Pause (Space)').click()
    await expect(video).toHaveJSProperty('paused', false)
    await expect
      .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime))
      .toBeGreaterThan(0.15)
    await page.getByTitle('Play/Pause (Space)').click()
    await expect(video).toHaveJSProperty('paused', true)
    if (theme === 'desktop') {
      await page.getByRole('button', { name: 'Seek transcript gap' }).click()
      await expect(page.locator('.subtitle-text-container')).not.toBeVisible()
    }
    await page.getByTitle('Go to Beginning').click()
    await expect(video).toHaveJSProperty('currentTime', 0)
    await expect(page.locator('.subtitle-text-container')).toContainText('CAPTION')
    await page.getByTitle('Mute/Unmute').click()
    await expect(video).toHaveJSProperty('muted', true)
    await page.getByRole('slider').fill('0.4')
    await expect(video).toHaveJSProperty('volume', 0.4)
    await page.getByTitle('Fullscreen (F)', { exact: true }).click()
    await expect(page.getByLabel('Fullscreen requests')).toHaveText('1')
    await page.getByRole('button', { name: 'Toggle image framing' }).click()
    await expect(page.getByLabel('Resolved assets')).toContainText('/desktop/local-image.svg')
    await expect
      .poll(() =>
        page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
          const pixel = canvas
            .getContext('2d')!
            .getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data
          return pixel[1] > 240 && pixel[0] < 10 && pixel[2] < 10
        })
      )
      .toBe(true)
    await page.screenshot({ path: info.outputPath(`shared-${theme}.png`) })
    await page.getByRole('button', { name: 'Close workspace' }).click()
    await expect(page.getByLabel('Closed')).toHaveText('true')
    expect(errors).toEqual([])
  })
}

for (const theme of ['desktop', 'web']) {
  test(`shared authentication has the same layout and form behavior with ${theme} styles`, async ({
    page
  }, info) => {
    await page.goto(`http://127.0.0.1:8093/?theme=${theme}&view=auth`)
    const dialog = page.getByRole('dialog', { name: 'Transform Videos into Viral Clips' })
    await expect(dialog).toBeVisible()
    await expect(page.getByRole('button', { name: 'Google', exact: true })).toBeVisible()
    await expect(page.getByAltText('Clippster')).toHaveJSProperty('naturalWidth', 215)
    await expect.poll(async () => Math.round((await dialog.boundingBox())!.width)).toBe(720)
    await page.screenshot({ path: info.outputPath(`auth-${theme}.png`) })
    await page.getByRole('button', { name: 'Sign up', exact: true }).click()
    await page.getByLabel('Email', { exact: true }).fill('test@example.com')
    await page.getByLabel('Password', { exact: true }).fill('password123')
    await page.getByLabel('Confirm password', { exact: true }).fill('different123')
    await expect(page.getByRole('button', { name: 'Create Account', exact: true })).toBeDisabled()
    await page.getByLabel('Confirm password', { exact: true }).fill('password123')
    await page.getByRole('button', { name: 'Create Account', exact: true }).click()
    await page.getByLabel('Verification code').fill('654321')
    await page.getByRole('button', { name: 'Verify', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Invalid verification code')
    await page.getByRole('button', { name: '← Back', exact: true }).click()
    await page.getByRole('button', { name: 'Forgot password?', exact: true }).click()
    await page.getByRole('button', { name: 'Send Reset Link', exact: true }).click()
    await expect(page.getByText('If an account exists for test@example.com')).toBeVisible()
    await page.getByRole('button', { name: 'Return to sign in', exact: true }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('button', { name: 'Google', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.getByRole('button', { name: 'Google', exact: true })).toBeInViewport({
      ratio: 1
    })
    await page.screenshot({ path: info.outputPath(`auth-${theme}-mobile.png`) })
    await page.getByRole('button', { name: 'Google', exact: true }).click()
    await expect(page.getByLabel('Authenticated')).toHaveText('1')
    await expect(page.getByLabel('Provider')).toHaveText('google')
    await expect(dialog).not.toBeVisible()
  })
}
