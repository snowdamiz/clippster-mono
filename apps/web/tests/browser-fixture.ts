import { test as base, expect } from '@playwright/test'
import { createDefaultSubtitleSettings } from '@clippster/shared-types'
import { startFixture } from './fixtures'

// Each scenario gets its own database, upstream and production rate limiters.
// A shared backend makes tests depend on earlier scenarios' accounts and traffic.
export const test = base.extend<{ workspaceServer: void }>({
  workspaceServer: [async ({}, use) => {
    const fixture = await startFixture({
      port: 8091,
      origin: 'http://127.0.0.1:8091',
      user: { subscription: { status: 'active', tier: 'creator' } },
      creatorProfiles: [{
        id: 11,
        name: 'Fixture creator',
        platform_links: [{ platform: 'kick', platform_id: 'fixture' }],
        clip_build_defaults: JSON.stringify({
          targetAspectRatio: '9:16',
          framingConfig: { mode: 'manual', targetAspectRatio: '9:16', regions: [], sourceFrameMode: 'use16x9', blurEnabled: true, blurAmount: 15 },
          layoutOverlays: [],
          watermarkMode: 'none',
          subtitleDefaults: { ...createDefaultSubtitleSettings(), enabled: true, selectedPresetId: 'tiktok-bold' }
        })
      }]
    })
    try {
      await use()
    } finally {
      await fixture.dispose()
    }
  }, { auto: true }]
})

export { expect }
export type { Page } from '@playwright/test'
