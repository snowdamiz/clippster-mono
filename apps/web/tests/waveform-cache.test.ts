import { it, expect, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { startFixture, waitForJob } from './fixtures'

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return { ...actual, writeFile: (...args: Parameters<typeof actual.writeFile>) => {
    if (String(args[0]).includes('waveform-v2.f32')) return Promise.reject(Object.assign(new Error('Cache is read-only'), { code: 'EACCES' }))
    return actual.writeFile(...args)
  } }
})

it('serves decoded waveform peaks even when disk cache writes are denied', async () => {
  const fixture = await startFixture()
  try {
    const cookie = await fixture.login()
    const headers = { Cookie: cookie, Origin: fixture.config.origin, 'Content-Type': 'application/json' }
    const workspace = await (await fetch(`${fixture.url}/api/web/projects`, { method: 'POST', headers, body: JSON.stringify({ name: 'Read-only waveform cache' }) })).json()
    const path = `${fixture.url}/api/web/projects/${workspace.project.id}`
    await fetch(`${path}/source`, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/octet-stream' }, body: await readFile(fixture.source) })
    await waitForJob(fixture.url, cookie, workspace.project.id)
    for (const query of ['width=100', 'start=1&end=3&width=50']) {
      const response = await fetch(`${path}/waveform?${query}`, { headers })
      expect(response.status).toBe(200)
      const waveform = await response.json()
      expect(waveform.peaks.some((peak: { max: number }) => peak.max > 0)).toBe(true)
    }
  } finally { await fixture.dispose() }
})
