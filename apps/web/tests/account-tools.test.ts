import { describe, it, expect } from 'vitest'
import { startFixture } from './fixtures'
import { clipInput } from '../server/validation'
import { hasCreatorToolsAccess } from '@clippster/shared-types'
import { mkdir, copyFile } from 'node:fs/promises'
import { join } from 'node:path'

describe('account tools access and isolation', () => {
  it('rejects expired plans even when the stored tier remains Creator', () => {
    expect(hasCreatorToolsAccess({ subscription: { tier: 'creator', status: 'expired' } })).toBe(false)
    expect(hasCreatorToolsAccess({ subscription: { tier: 'starter', status: 'active' } })).toBe(false)
    expect(hasCreatorToolsAccess({ subscription: { tier: 'creator', status: 'active' } })).toBe(true)
    expect(hasCreatorToolsAccess({ owned_organization_id: 1 })).toBe(true)
  })
  it('isolates prompts between owners and applies organization restrictions', async () => {
    const restrictions = { restricted: false, restrictions: { allow_custom_prompts: true } }
    const fixture = await startFixture({ user: { subscription: { tier: 'creator', status: 'active' } }, restrictions })
    try {
      const cookie = await fixture.login()
      const headers = { Cookie: cookie, Origin: fixture.config.origin, 'Content-Type': 'application/json' }
      const response = await fetch(fixture.url + '/api/web/prompts', { method: 'POST', headers, body: JSON.stringify({ name: 'My template', content: 'Find clear explanations.' }) })
      expect(response.status).toBe(201)
      const { id } = await response.json()
      fixture.store.db.prepare('UPDATE prompts SET owner = ? WHERE id = ?').run('2', id)
      expect((await (await fetch(fixture.url + '/api/web/prompts', { headers })).json()).prompts).toEqual([])
      expect((await fetch(`${fixture.url}/api/web/prompts/${id}`, { method: 'DELETE', headers })).status).toBe(404)
      restrictions.restricted = true; restrictions.restrictions.allow_custom_prompts = false
      expect((await fetch(fixture.url + '/api/web/prompts', { headers })).status).toBe(403)
    } finally { await fixture.dispose() }
  })
  it('enforces both the campaign feature flag and tier on direct requests', async () => {
    const user = { subscription: { tier: 'creator', status: 'active' }, campaigns_enabled: false }
    const fixture = await startFixture({ user })
    try {
      const headers = { Cookie: await fixture.login() }
      const request = () => fetch(fixture.url + '/api/web/account/campaigns', { headers })
      expect((await request()).status).toBe(403)
      user.campaigns_enabled = true
      expect((await request()).status).toBe(200)
      user.subscription.tier = 'starter'
      expect((await request()).status).toBe(403)
      expect((await fetch(fixture.url + '/api/web/account/admin/users', { headers })).status).toBe(404)
    } finally { await fixture.dispose() }
  })
  it('preserves folder metadata without allowing another owner to change a project', async () => {
    const fixture = await startFixture()
    try {
      const headers = { Cookie: await fixture.login(), Origin: fixture.config.origin, 'Content-Type': 'application/json' }
      const project = fixture.store.create('Original', '1')
      const response = await fetch(`${fixture.url}/api/web/projects/${project.id}`, { method: 'PATCH', headers, body: JSON.stringify({ name: 'Renamed', folder: 'Interviews' }) })
      expect(response.status).toBe(200)
      expect(fixture.store.get(project.id, '1').folder).toBe('Interviews')
      const other = fixture.store.create('Other', '2')
      expect((await fetch(`${fixture.url}/api/web/projects/${other.id}`, { method: 'PATCH', headers, body: JSON.stringify({ name: 'Wrong owner' }) })).status).toBe(404)
    } finally { await fixture.dispose() }
  })
  it('publishes the built file once per request and blocks approval bypasses', async () => {
    const restrictions = { restrictions: { require_clip_approval: false, restricting_org_id: 7 } }
    const fixture = await startFixture({ restrictions })
    try {
      const headers = { Cookie: await fixture.login(), Origin: fixture.config.origin, 'Content-Type': 'application/json' }
      const project = fixture.store.create('Publishing', '1')
      const clip = { id: crypto.randomUUID(), name: 'Built', revision: 1, builtRevision: 1, aspectRatio: '16:9' as const, captions: false, segments: [{ start_time: 0, end_time: 1, duration: 1, transcript: null }] }
      project.clips.push(clip); fixture.store.save(project, '1')
      const directory = join(fixture.directory, 'media', project.id)
      await mkdir(directory, { recursive: true }); await copyFile(fixture.source, join(directory, `${clip.id}.mp4`))
      const requestId = crypto.randomUUID()
      const send = (id = requestId) => fetch(`${fixture.url}/api/web/projects/${project.id}/clips/${clip.id}/publish`, { method: 'POST', headers, body: JSON.stringify({ requestId: id, accountId: 10, caption: 'Fixture only' }) })
      expect((await send()).status).toBe(200)
      expect((await send()).status).toBe(200)
      expect(fixture.publishCalls()).toBe(1)
      restrictions.restrictions.require_clip_approval = true
      expect((await send(crypto.randomUUID())).status).toBe(403)
      expect(fixture.publishCalls()).toBe(1)
      const organizations = await fetch(fixture.url + '/api/web/account/organizations', { headers })
      expect((await organizations.json()).organizations).toEqual([{ id: 7, role: 'member' }])
      const assigned = await fetch(fixture.url + '/api/web/account/organizations/7/my-social-accounts', { headers })
      expect((await assigned.json()).accounts[0].id).toBe(70)
      const approvedPath = await fetch(`${fixture.url}/api/web/projects/${project.id}/clips/${clip.id}/publish`, { method: 'POST', headers, body: JSON.stringify({ requestId: crypto.randomUUID(), accountId: 70, organizationId: 7, caption: 'Review this clip' }) })
      expect(approvedPath.status).toBe(200)
      expect((await approvedPath.json()).post.status).toBe('awaiting_approval')
      expect(fixture.publishCalls()).toBe(2)
    } finally { await fixture.dispose() }
  })
})

describe('clip framing validation', () => {
  const input = { name: 'Test', segments: [{ start_time: 0, end_time: 5 }], aspectRatio: '9:16', captions: false }
  const region = { id: 'region', color: '#00FFFF', source: { x: 0, y: 0, width: 0.5, height: 0.5 }, output: { x: 0, y: 0, width: 1, height: 1 } }
  it('rejects invalid geometry and overlapping timed layouts before invoking FFmpeg', () => {
    const framingConfig = { mode: 'manual', targetAspectRatio: '9:16', regions: [region] }
    expect(clipInput({ ...input, framingConfig }, 6).framingConfig?.regions).toHaveLength(1)
    expect(() => clipInput({ ...input, framingConfig: { ...framingConfig, regions: [{ ...region, source: { ...region.source, x: 0.9 } }] } }, 6)).toThrow('Invalid framing')
    expect(() => clipInput({ ...input, framingConfig: { ...framingConfig, segmentConfigs: [{ segmentId: '1', startTime: 0, endTime: 3, regions: [region] }, { segmentId: '2', startTime: 2, endTime: 4, regions: [] }] } }, 6)).toThrow('Invalid framing')
  })
})
