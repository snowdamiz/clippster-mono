import { it, expect } from 'vitest'
import { startFixture } from './fixtures'
it('persists recent VOD searches by account, deduplicates them, and isolates clearing', async () => {
  const fixture = await startFixture()
  try {
    const cookie = await fixture.login(), other = await fixture.login('second@example.com')
    const request = (method = 'GET', body?: unknown, session = cookie) => fetch(fixture.url + '/api/web/vod-searches', { method, headers: { Cookie: session, Origin: fixture.config.origin, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
    const search = { id: 'asmongold', platform: 'kick', displayText: 'https://kick.com/asmongold' }
    expect((await request('POST', search)).status).toBe(200)
    await request('POST', { ...search, id: 'second-channel' })
    await request('POST', search)
    const searches = (await (await request()).json()).searches
    expect(searches).toHaveLength(2)
    expect(searches[0]).toMatchObject(search)
    expect(searches[0].timestamp).toBeGreaterThan(0)
    expect((await (await request('GET', undefined, other)).json()).searches).toEqual([])
    expect((await request('POST', { ...search, platform: 'bad' })).status).toBe(400)
    expect((await request('GET', undefined, '')).status).toBe(401)
    await request('DELETE', undefined, other)
    expect((await (await request()).json()).searches).toHaveLength(2)
    await request('DELETE')
    expect((await (await request()).json()).searches).toEqual([])
  } finally { await fixture.dispose() }
}, 30_000)
