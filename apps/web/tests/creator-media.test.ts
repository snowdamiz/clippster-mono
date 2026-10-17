import { it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { startFixture } from './fixtures'

it('uploads branding through the authenticated account and isolates assets between users', async () => {
  const fixture = await startFixture()
  try {
    const cookie = await fixture.login()
    const bytes = await readFile(fixture.source)
    const headers = { Cookie: cookie, Origin: fixture.config.origin, 'Content-Type': 'application/octet-stream' }
    const response = await fetch(fixture.url + '/api/web/account/user/assets?asset_type=intro&filename=intro.mp4&name=Intro&mime=video%2Fmp4', { method: 'POST', headers, body: bytes })
    expect(response.status).toBe(201)
    const { asset } = await response.json()
    expect(asset.asset_type).toBe('intro')
    expect(asset.width).toBe(320)
    expect(asset.height).toBe(180)
    expect(asset.duration).toBeCloseTo(6, 0)
    expect(fixture.brandingUploads()).toEqual([{ owner: 'fixture-token-1', type: 'intro', bytes: bytes.length }])
    expect((await (await fetch(fixture.url + '/api/web/account/user/assets', { headers })).json()).assets).toHaveLength(1)
    const other = await fixture.login('second@example.com')
    expect((await (await fetch(fixture.url + '/api/web/account/user/assets', { headers: { Cookie: other } })).json()).assets).toEqual([])
    expect((await fetch(fixture.url + '/api/web/account/user/assets?asset_type=bad&mime=video%2Fmp4', { method: 'POST', headers, body: bytes })).status).toBe(400)
    expect((await fetch(fixture.url + '/api/web/account/user/assets/1/content?url=http://localhost', { headers: { Cookie: other } })).status).toBe(404)
  } finally { await fixture.dispose() }
}, 30_000)

it('blocks personal branding uploads for restricted and free accounts', async () => {
  for (const options of [{ restrictions: { restricted: true } }, { user: { subscription: { status: 'none' as const }, has_selected_plan: true } }]) {
    const fixture = await startFixture(options)
    try {
      const response = await fetch(fixture.url + '/api/web/account/user/assets?asset_type=watermark&mime=image%2Fpng', { method: 'POST', headers: { Cookie: await fixture.login(), Origin: fixture.config.origin, 'Content-Type': 'application/octet-stream' }, body: new Uint8Array([1]) })
      expect(response.status).toBe(403)
      expect(fixture.brandingUploads()).toEqual([])
    } finally { await fixture.dispose() }
  }
}, 30_000)
