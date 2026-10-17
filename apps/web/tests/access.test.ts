import { describe, it, expect } from 'vitest'
import { isFreePlan, needsPlanSelection, subscriptionCoversAccess } from '@clippster/shared-types'
import { startFixture } from './fixtures'
import { Store } from '../server/store'

describe('account and subscription access', () => {
  it('requires new users to choose a plan, accepts Free, paid and organization accounts', () => {
    expect(needsPlanSelection({})).toBe(true)
    expect(needsPlanSelection({ has_selected_plan: true })).toBe(false)
    expect(needsPlanSelection({ subscription: { status: 'active' } })).toBe(false)
    expect(needsPlanSelection({ owned_organization_id: 7 })).toBe(false)
    expect(needsPlanSelection({ created_by_organization_id: 7 })).toBe(false)
    expect(isFreePlan({ has_selected_plan: true })).toBe(true)
    expect(isFreePlan({ subscription: { status: 'cancelled', end_date: '2099-01-01' } })).toBe(false)
    expect(subscriptionCoversAccess({ status: 'active', end_date: '2000-01-01' })).toBe(false)
    expect(subscriptionCoversAccess({ status: 'cancelled', end_date: '2000-01-01', days_remaining: 20 })).toBe(false)
  })

  it('establishes account sessions only from the account origin with a verified bearer', async () => {
    const fixture = await startFixture()
    try {
      const request = (origin: string, token = 'fixture-token-1') => fetch(fixture.url + '/api/auth/session', {
        method: 'POST', headers: { Origin: origin, Authorization: `Bearer ${token}` }
      })
      expect((await request('https://evil.example')).status).toBe(403)
      expect((await request(fixture.config.origin)).status).toBe(403)
      expect((await request(fixture.config.accountOrigin, 'invalid')).status).toBe(401)
      const response = await request(fixture.config.accountOrigin)
      expect(response.status).toBe(200)
      expect(response.headers.get('set-cookie')).toContain('HttpOnly')
      const body = await response.json()
      expect(body.token).toBeUndefined()
      const cookie = response.headers.get('set-cookie')!.split(';')[0]
      expect((await fetch(fixture.url + '/api/web/projects', { headers: { Cookie: cookie } })).status).toBe(200)
      expect(JSON.stringify(fixture.store.db.prepare('SELECT * FROM sessions').all())).not.toContain('fixture-token')
    } finally { await fixture.dispose() }
  })

  it('blocks direct workspace requests when no plan has been selected', async () => {
    const fixture = await startFixture({ user: { has_selected_plan: false, subscription: { status: 'none' } } })
    try {
      const cookie = await fixture.login()
      const response = await fetch(fixture.url + '/api/web/projects', { headers: { Cookie: cookie } })
      expect(response.status).toBe(403)
      expect((await response.json()).error).toContain('Choose Free or a paid plan')
      expect((await fetch(fixture.url + '/api/auth/me', { headers: { Cookie: cookie } })).status).toBe(200)
    } finally { await fixture.dispose() }
  })

  it('enforces durable daily Free limits while uploads and library access remain available', async () => {
    const fixture = await startFixture({ user: { subscription: { status: 'none' } } })
    try {
      const cookie = await fixture.login()
      const headers = { Cookie: cookie, Origin: fixture.config.origin, 'Content-Type': 'application/json' }
      fixture.store.consumeFreeUsage('1', 'vod_download')
      fixture.store.consumeFreeUsage('1', 'vod_download')
      expect(() => fixture.store.consumeFreeUsage('1', 'vod_download')).toThrow('daily limit')
      const reopened = new Store(fixture.directory)
      try { expect(() => reopened.consumeFreeUsage('1', 'vod_download')).toThrow('daily limit') }
      finally { reopened.close() }
      const project = fixture.store.create('Free project', '1')
      const denied = await fetch(`${fixture.url}/api/web/projects/${project.id}/import`, {
        method: 'POST', headers, body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=test' })
      })
      expect(denied.status).toBe(403)
      expect(fixture.store.activeJobs()).toHaveLength(0)
      for (let i = 0; i < 5; i++) fixture.store.consumeFreeUsage('1', 'clip_build')
      expect(() => fixture.store.consumeFreeUsage('1', 'clip_build')).toThrow('daily limit')
      fixture.store.consumeFreeUsage('2', 'vod_download')
      expect((await fetch(fixture.url + '/api/web/projects', { headers })).status).toBe(200)
      // A previous UTC day does not spend today's quota.
      fixture.store.db.prepare('UPDATE daily_usage SET day = ? WHERE owner = ?').run('2000-01-01', '1')
      expect(() => fixture.store.consumeFreeUsage('1', 'vod_download')).not.toThrow()
    } finally { await fixture.dispose() }
  })

  it('revalidates plan selection after login instead of trusting the browser or session snapshot', async () => {
    const user = { has_selected_plan: true, subscription: { status: 'none' } }
    const fixture = await startFixture({ user })
    try {
      const cookie = await fixture.login()
      const request = () => fetch(fixture.url + '/api/web/projects', { headers: { Cookie: cookie } })
      expect((await request()).status).toBe(200)
      user.has_selected_plan = false
      expect((await request()).status).toBe(403)
      user.has_selected_plan = true
      expect((await request()).status).toBe(200)
    } finally { await fixture.dispose() }
  })
})
