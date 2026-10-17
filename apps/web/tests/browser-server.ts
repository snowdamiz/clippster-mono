import { startFixture } from './fixtures'
import { createDefaultSubtitleSettings } from '@clippster/shared-types'
const fixture = await startFixture({ port: 8091, origin: 'http://127.0.0.1:8091', user: { subscription: { status: 'active', tier: 'creator' } }, creatorProfiles: [{ id: 11, name: 'Fixture creator', platform_links: [{ platform: 'kick', platform_id: 'fixture' }], clip_build_defaults: JSON.stringify({ targetAspectRatio: '9:16', framingConfig: { mode: 'manual', targetAspectRatio: '9:16', regions: [], sourceFrameMode: 'use16x9', blurEnabled: true, blurAmount: 15 }, layoutOverlays: [], watermarkMode: 'none', subtitleDefaults: { ...createDefaultSubtitleSettings(), enabled: true, selectedPresetId: 'tiktok-bold' } }) }] })
console.log('Browser fixture is ready; authentication and AI responses are test fixtures.')
process.on('SIGTERM', async () => {
  await fixture.dispose()
  process.exit(0)
})
process.on('SIGINT', async () => {
  await fixture.dispose()
  process.exit(0)
})
