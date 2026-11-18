import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import type { WebWorkspace } from '@clippster/shared-types'
import { startFixture, waitForJob } from './fixtures'

const { assetFixture } = vi.hoisted(() => ({ assetFixture: { path: '' } }))
vi.mock('../server/network', async importOriginal => {
  const actual = await importOriginal<typeof import('../server/network')>()
  const { copyFile } = await import('node:fs/promises')
  return { ...actual, downloadAsset: async (url: string, destination: string, signal: AbortSignal) => {
    if (url.startsWith('https://fixture.invalid/creator-')) return copyFile(assetFixture.path, destination)
    return actual.downloadAsset(url, destination, signal)
  } }
})

let fixture: Awaited<ReturnType<typeof startFixture>>
let cookie: string

async function request(path: string, method = 'GET', body?: unknown) {
  return fetch(`${fixture.url}/api/web${path}`, {
    method,
    headers: { Cookie: cookie, Origin: fixture.config.origin, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

beforeAll(async () => {
  fixture = await startFixture({ mockCreatorSkillEditor: true, creatorAssets: [
    { id: 201, asset_type: 'intro', url: 'https://fixture.invalid/creator-intro.mp4', mime_type: 'video/mp4' },
    { id: 202, asset_type: 'outro', url: 'https://fixture.invalid/creator-outro.mp4', mime_type: 'video/mp4' },
  ], creatorProfiles: [{ id: 101, name: 'Alex Stream', intro_ratio_settings: { '9:16': { assetId: 201 } }, outro_ratio_settings: { '9:16': { assetId: 202 } }, creator_skill_preferences: { brand: { channelName: 'Alex Live', colors: ['#123456'] }, editing: { preserveEveryWord: true, rules: ['Use only today’s VOD face frames'] }, publishing: { platforms: ['YouTube Shorts'] }, sponsors: [] } }], detectedClips: [
    { name: 'First highlight', segments: [{ start_time: 0.4, end_time: 1.4 }, { start_time: 3.4, end_time: 4.4 }] },
    { name: 'Second highlight', segments: [{ start_time: 1.4, end_time: 2.4 }, { start_time: 3.4, end_time: 4.4 }] },
  ] })
  cookie = await fixture.login()
  assetFixture.path = fixture.source
})
afterAll(async () => { await fixture.dispose() })

it('runs detected VOD clips through a credit-free fixture edit and keeps Raw selectable', async () => {
  const created = await request('/projects', 'POST', { name: 'Synthetic downloaded VOD' })
  expect(created.status).toBe(201)
  const projectId = ((await created.json()) as WebWorkspace).project.id
  const uploaded = await fetch(`${fixture.url}/api/web/projects/${projectId}/source`, { method: 'PUT', headers: { Cookie: cookie, Origin: fixture.config.origin, 'Content-Type': 'application/octet-stream' }, body: await readFile(fixture.source) })
  expect(uploaded.status).toBe(202)
  expect((await waitForJob(fixture.url, cookie, projectId)).jobs[0].status).toBe('completed')
  expect((await request(`/projects/${projectId}`, 'PATCH', { creatorId: 101 })).status).toBe(200)
  expect((await request(`/projects/${projectId}/detect`, 'POST', { prompt: 'Find highlights', creatorSkill: true })).status).toBe(202)
  let workspace: WebWorkspace = await waitForJob(fixture.url, cookie, projectId)
  expect(workspace.jobs[0].status, workspace.jobs[0].message).toBe('completed')
  const clips = workspace.project.clips
  expect(clips).toHaveLength(2)
  expect(clips.every(clip => clip.creatorSkill?.status === 'awaiting_approval' && clip.selectedVersion === 'raw')).toBe(true)
  expect((await request(`/projects/${projectId}/creator-skill/batch`, 'POST', { maxCreditsPerClip: 3 })).status).toBe(202)
  workspace = await waitForJob(fixture.url, cookie, projectId, 180_000)
  expect(workspace.jobs[0].status, workspace.jobs[0].message).toBe('completed')
  for (const clip of workspace.project.clips) {
    expect(clip.creatorSkill?.status, clip.creatorSkill?.reviewItems.join('\n')).toBe('needs_review')
  }
  expect(workspace.project.clips.every(clip => clip.creatorSkill?.playbookPackage?.automatedQa?.masterMd5 === clip.creatorSkill?.masterMd5)).toBe(true)
  expect(workspace.project.clips.every(clip => clip.creatorSkill?.phonePreviewAvailable)).toBe(true)
  expect(workspace.project.clips.every(clip => clip.creatorSkill?.reviewItems.some(item => item.includes('selected creator outro contains audio')))).toBe(true)
  expect(new Set(workspace.project.clips.map(clip => clip.creatorSkill?.aiSessionId)).size).toBe(2)
  expect(fixture.creatorSkillSessions()).toHaveLength(2)
  expect(fixture.creatorSkillSessions().every(session => session.media_items.map(item => item.name).includes('Creator intro') && session.media_items.map(item => item.name).includes('Creator outro'))).toBe(true)
  expect(fixture.creatorSkillSessions().every(session => session.document?.shots.at(-1)?.mediaId === session.media_items.find(item => item.name === 'Creator outro')?.id)).toBe(true)
  expect(workspace.project.clips.every(clip => clip.creatorSkill?.creatorProfile?.name === 'Alex Stream')).toBe(true)
  for (const clip of clips) {
    const phonePreview = await request(`/projects/${projectId}/clips/${clip.id}/creator-skill/phone-preview`)
    expect(phonePreview.status).toBe(200)
    expect(phonePreview.headers.get('content-type')).toContain('video/mp4')
    await phonePreview.arrayBuffer()
    const delivery = await request(`/projects/${projectId}/clips/${clip.id}/creator-skill/delivery`)
    expect(delivery.status).toBe(200)
    expect(delivery.headers.get('content-type')).toContain('application/zip')
    const bytes = new Uint8Array(await delivery.arrayBuffer())
    expect([...bytes.slice(0, 4)]).toEqual([80, 75, 3, 4])
    const archive = Buffer.from(bytes)
    for (const name of ['raw.mp4', 'edited-master.mp4', 'captions.srt', 'claims.md', 'footage.md', 'creator.md', 'checksums.md'])
      expect(archive.includes(Buffer.from(`/${name}`)), name).toBe(true)
    const claims = await request(`/projects/${projectId}/clips/${clip.id}/creator-skill/documents/claims.md`)
    expect(claims.status).toBe(200)
    expect(await claims.text()).toContain('Editorial draft.')
    const creatorProfile = await request(`/projects/${projectId}/clips/${clip.id}/creator-skill/documents/creator.md`)
    expect(creatorProfile.status).toBe(200)
    const snapshot = await creatorProfile.text()
    expect(snapshot).toContain('Channel: Alex Live')
    expect(snapshot).toContain('Use only today’s VOD face frames')
    expect(snapshot).toContain('brand mentions are not sponsor agreements')
    const raw = await request(`/projects/${projectId}/clips/${clip.id}/version`, 'PATCH', { version: 'raw' })
    expect(raw.status).toBe(200)
    expect(((await raw.json()) as WebWorkspace).project.clips.find(item => item.id === clip.id)?.selectedVersion).toBe('raw')
    const editedBuild = workspace.project.clips.find(item => item.id === clip.id)?.builds?.find(build => build.origin === 'creator_skill')
    expect(editedBuild).toBeTruthy()
    const wrongVersion = await request(`/projects/${projectId}/clips/${clip.id}/publish`, 'POST', { requestId: crypto.randomUUID(), accountId: 10, buildId: editedBuild?.id })
    expect(wrongVersion.status).toBe(409)
    expect(await wrongVersion.text()).toContain('does not match the selected Raw or Edited version')
  }
}, 240_000)
