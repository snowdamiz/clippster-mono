import { it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { startFixture, waitForJob } from './fixtures'
import { createDefaultSubtitleSettings } from '@clippster/shared-types'
it('snapshots owned creator defaults into the downloaded workspace and manual project', async () => {
  const defaults = { targetAspectRatio: '9:16', framingConfig: { mode: 'manual', targetAspectRatio: '9:16', regions: [], sourceFrameMode: 'use16x9', blurEnabled: true, blurAmount: 15 }, layoutOverlays: [], watermarkMode: 'none', customWatermarkSettings: null, subtitleDefaults: { ...createDefaultSubtitleSettings(), enabled: true, selectedPresetId: 'tiktok-bold' } }
  const fixture = await startFixture({ creatorProfiles: [{ id: 11, name: 'Fixture creator', clip_build_defaults: JSON.stringify(defaults) }] })
  try {
    const cookie = await fixture.login(), other = await fixture.login('second@example.com')
    const request = (path: string, method = 'GET', body?: unknown, session = cookie) => fetch(`${fixture.url}/api/web${path}`, { method, headers: { Cookie: session, Origin: fixture.config.origin, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
    const initial = await (await request('/projects', 'POST', { name: 'Creator layout' })).json(), id = initial.project.id
    expect((await request(`/projects/${id}/creator-layout`, 'POST', { creatorId: 11 }, other)).status).toBe(404)
    expect((await request(`/projects/${id}/creator-layout`, 'POST', { creatorId: 99 })).status).toBe(404)
    const seeded = await request(`/projects/${id}/creator-layout`, 'POST', { creatorId: 11 })
    expect(seeded.status).toBe(200); const preset = (await seeded.json()).project.vodPresetConfig
    expect(preset).toMatchObject({ targetAspectRatio: '9:16', watermarkMode: 'none', subtitleDefaults: { enabled: true, selectedPresetId: 'tiktok-bold' }, framingConfig: { sourceFrameMode: 'use16x9' } })
    await fetch(`${fixture.url}/api/web/projects/${id}/source`, { method: 'PUT', headers: { Cookie: cookie, Origin: fixture.config.origin, 'Content-Type': 'application/octet-stream' }, body: await readFile(fixture.source) })
    await waitForJob(fixture.url, cookie, id)
    const saved = await (await request(`/projects/${id}/clips`, 'POST', { name: 'Creator clip', aspectRatio: '9:16', captions: true, subtitleSettings: preset.subtitleDefaults, framingConfig: preset.framingConfig, segments: [{ start_time: 0, end_time: 2 }] })).json()
    const child = await (await request(`/projects/${id}/clips/${saved.project.clips[0].id}/project`, 'POST')).json()
    expect(child.project.creatorId).toBe(11); expect(child.project.vodPresetConfig).toEqual(preset)
  } finally { await fixture.dispose() }
}, 30000)
