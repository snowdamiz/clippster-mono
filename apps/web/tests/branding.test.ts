import { describe, it, expect, vi } from 'vitest'
import { copyFile, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import type { ApiClient } from '@clippster/api-client'
import type { WebClip } from '@clippster/shared-types'
import { startFixture } from './fixtures'
import { applyBranding } from '../server/branding'
import { probe } from '../server/media'

vi.mock('../server/network', async importOriginal => ({
  ...await importOriginal<typeof import('../server/network')>(),
  downloadAsset: (source: string, destination: string) => copyFile(source, destination),
}))

describe('built clip branding', () => {
  it('renders account watermark, intro and outro into the staged output', async () => {
    const fixture = await startFixture()
    try {
      const work = join(fixture.directory, 'branding-test')
      await mkdir(work)
      const clipPath = join(work, 'clip.mp4'), watermark = join(work, 'fixture.png')
      await copyFile(fixture.source, clipPath)
      execFileSync(fixture.config.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=red:s=64x32', '-frames:v', '1', '-threads', '1', '-y', watermark])
      const upstream = { get: async () => ({ success: true, profiles: [{ id: 1, intro_id: 1, outro_id: 2, watermark_id: 3 }], assets: [
        { id: 1, asset_type: 'intro', url: fixture.source }, { id: 2, asset_type: 'outro', url: fixture.source }, { id: 3, asset_type: 'watermark', url: watermark },
      ] }) } as unknown as ApiClient
      const clip = { aspectRatio: '16:9', branding: { creatorId: 1, watermarkX: 0.9, watermarkY: 0.1, watermarkWidth: 0.15 } } as WebClip
      const signal = new AbortController().signal
      const before = await probe(clipPath, fixture.config, signal)
      await applyBranding(clip, clipPath, work, fixture.config, signal, upstream, { subscription: { status: 'active' } })
      const after = await probe(clipPath, fixture.config, signal)
      expect(after.duration).toBeCloseTo(before.duration * 3, 0)
      expect(after.hasAudio).toBe(true)
      expect(after.width).toBe(1920)
      clip.branding!.creatorId = 99
      await expect(applyBranding(clip, clipPath, work, fixture.config, signal, upstream, { subscription: { status: 'active' } })).rejects.toThrow('Creator profile is no longer available')
    } finally { await fixture.dispose() }
  }, 60_000)
})
