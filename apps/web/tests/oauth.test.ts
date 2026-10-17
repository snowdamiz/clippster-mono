import { beforeAll, afterAll, expect, it } from 'vitest'
import { startFixture } from './fixtures'
let fixture: Awaited<ReturnType<typeof startFixture>>
beforeAll(async () => {
  fixture = await startFixture()
})
afterAll(async () => {
  await fixture.dispose()
})
async function start(cookie = '') {
  const response = await fetch(fixture.url + '/api/auth/google/start', {
    method: 'POST',
    headers: { Origin: fixture.config.origin, Cookie: cookie, 'Content-Type': 'application/json' },
    body: '{}'
  })
  expect(response.status).toBe(200)
  const data = await response.json()
  expect(new URL(data.url).origin).toBe('https://accounts.google.com')
  const state = new URL(data.url).searchParams.get('state')!
  return { state, cookie: response.headers.get('set-cookie')!.split(';')[0], response }
}
async function callback(state: string, cookie = '', error?: string) {
  return fetch(
    `${fixture.url}/api/auth/google/callback?state=${state}&${error ? `error=${error}` : `code=fixture-google-${state}`}`,
    {
      headers: { Cookie: cookie },
      redirect: 'manual'
    }
  )
}
it('Google handoff establishes the same encrypted, HttpOnly session as email and rotates an old session', async () => {
  const old = await fixture.login()
  const attempt = await start(old)
  expect(attempt.response.headers.get('set-cookie')).toContain('HttpOnly')
  expect(attempt.response.headers.get('set-cookie')).toContain('SameSite=Lax')
  const response = await callback(attempt.state, `${attempt.cookie}; ${old}`)
  expect(response.status).toBe(303)
  expect(response.headers.get('location')).toBe('/')
  const sessionCookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith('clippster_web='))!
    .split(';')[0]
  expect(sessionCookie).not.toBe(old)
  expect(response.headers.get('referrer-policy')).toBe('no-referrer')
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(
    (await fetch(fixture.url + '/api/auth/me', { headers: { Cookie: sessionCookie } })).status
  ).toBe(200)
  expect((await fetch(fixture.url + '/api/auth/me', { headers: { Cookie: old } })).status).toBe(401)
  expect(JSON.stringify(fixture.store.db.prepare('SELECT * FROM sessions').all())).not.toContain(
    'fixture-token'
  )
  expect((await callback(attempt.state, attempt.cookie)).headers.get('location')).toBe(
    '/?auth_error=google_expired'
  )
})
it('requires both the initiating browser cookie and matching state; never accepts a bearer from the URL', async () => {
  const first = await start(),
    second = await start()
  expect((await callback(first.state)).headers.get('location')).toBe('/?auth_error=google_expired')
  expect((await callback(first.state, second.cookie)).headers.get('location')).toBe(
    '/?auth_error=google_expired'
  )
  const response = await fetch(fixture.url + '/api/auth/google/callback?token=fixture-token-1', {
    redirect: 'manual'
  })
  expect(response.headers.getSetCookie()).toEqual([])
  expect((await callback(first.state, first.cookie)).headers.get('location')).toBe('/')
})
it('expires attempts, consumes cancellation, and blocks cross-origin initiation', async () => {
  const expired = await start()
  fixture.store.db.prepare('UPDATE oauth_attempts SET expires = 0').run()
  expect((await callback(expired.state, expired.cookie)).headers.get('location')).toBe(
    '/?auth_error=google_expired'
  )
  const cancelled = await start()
  expect(
    (await callback(cancelled.state, cancelled.cookie, 'google_cancelled')).headers.get('location')
  ).toBe('/?auth_error=google_cancelled')
  expect((await callback(cancelled.state, cancelled.cookie)).headers.get('location')).toBe(
    '/?auth_error=google_expired'
  )
  const response = await fetch(fixture.url + '/api/auth/google/start', {
    method: 'POST',
    headers: { Origin: 'https://evil.example' }
  })
  expect(response.status).toBe(403)
})
it('a new sign-in attempt replaces the prior attempt for that browser', async () => {
  const first = await start(),
    second = await start(first.cookie)
  expect((await callback(first.state, first.cookie)).headers.get('location')).toBe(
    '/?auth_error=google_expired'
  )
  expect((await callback(second.state, second.cookie)).headers.get('location')).toBe('/')
})
