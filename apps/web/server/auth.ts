import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'
import { rateLimit } from 'express-rate-limit'
import { Router } from 'express'
import { createApiClient, createAuthApi } from '@clippster/api-client'
import type { Store, Session } from './store'
import type { Config } from './config'
import { HttpError, requireValue } from './errors'
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export function createAuth(store: Store, config: Config) {
  const COOKIE = config.secureCookies ? '__Host-clippster_web' : 'clippster_web'
  const OAUTH_COOKIE = config.secureCookies ? '__Host-clippster_oauth' : 'clippster_oauth'
  const cookieOptions = {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: 'lax' as const,
    path: '/'
  }
  const key = createHash('sha256').update(config.sessionSecret).digest()
  function encrypt(token: string) {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    return Buffer.concat([iv, cipher.update(token), cipher.final(), cipher.getAuthTag()]).toString(
      'base64'
    )
  }
  function decrypt(value: string) {
    const bytes = Buffer.from(value, 'base64')
    const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12))
    decipher.setAuthTag(bytes.subarray(-16))
    return Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString()
  }
  function token(session: Session) {
    return decrypt(session.token)
  }
  function readCookie(req: Request, name: string) {
    return req.headers.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1)
  }
  function readSession(req: Request) {
    const cookie = readCookie(req, COOKIE)
    return cookie ? store.session(hash(cookie)) : undefined
  }
  function upstream(bearer: string | null = null, timeoutMs = 30_000) {
    return createApiClient({
      baseUrl: config.apiUrl,
      platform: 'web',
      getToken: async () => bearer,
      onUnauthorized: () => {},
      timeoutMs
    })
  }
  function establish(req: Request, res: Response, bearer: string, owner: string) {
    const old = readSession(req)
    if (old) store.deleteSession(old.id)
    const cookie = randomBytes(32).toString('hex')
    const expires = Date.now() + 7 * 86400_000
    store.saveSession({ id: hash(cookie), owner, token: encrypt(bearer), expires })
    res.cookie(COOKIE, cookie, {
      ...cookieOptions,
      maxAge: 7 * 86400_000
    })
  }
  async function requireSession(req: Request, res: Response, next: NextFunction) {
    const session = readSession(req)
    requireValue(session, 401, 'Sign in to continue.')
    // Revalidate with the existing account service, including expiration and account deletion.
    let bearer: string
    try {
      bearer = token(session)
    } catch {
      store.deleteSession(session.id)
      throw new HttpError(401, 'Your session expired. Please sign in again.')
    }
    const me = await createAuthApi(upstream(bearer)).me()
    if (!me?.success || !me.user || String(me.user.id) !== session.owner) {
      store.deleteSession(session.id)
      throw new HttpError(401, 'Your session expired. Please sign in again.')
    }
    res.locals.session = session
    res.locals.user = me.user
    next()
  }
  const router = Router()
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'private, no-store')
    next()
  })
  router.use(
    rateLimit({
      windowMs: 15 * 60_000,
      limit: 100,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Too many requests. Please try again later.' }
    })
  )
  const actions = new Set([
    'login',
    'register',
    'verify-otp',
    'resend-verification',
    'forgot-password',
    'reset-password'
  ])
  router.post('/google/start', async (req, res) => {
    const state = randomBytes(32).toString('base64url')
    const verifier = randomBytes(32).toString('base64url')
    const cookie = randomBytes(32).toString('base64url')
    let url: string
    try {
      const result = await upstream().post<{ url: string }>(
        '/auth/google/start',
        {
          origin: config.origin,
          client_state: state,
          code_challenge: createHash('sha256').update(verifier).digest('base64url'),
          referral_code:
            typeof req.body?.referral_code === 'string'
              ? req.body.referral_code.slice(0, 100)
              : undefined
        },
        { skipAuth: true }
      )
      const target = new URL(result.url)
      requireValue(
        target.origin === 'https://accounts.google.com' && !target.username && !target.password,
        502,
        'Invalid sign-in URL.'
      )
      url = target.href
    } catch {
      throw new HttpError(503, 'Google sign-in is unavailable. Please try again shortly.')
    }
    const old = readCookie(req, OAUTH_COOKIE)
    if (old) store.deleteOAuthAttempt(hash(old))
    store.saveOAuthAttempt(hash(cookie), hash(state), encrypt(verifier))
    res.cookie(OAUTH_COOKIE, cookie, { ...cookieOptions, maxAge: 600_000 })
    res.json({ url })
  })
  router.get('/google/callback', async (req, res) => {
    res.set('Referrer-Policy', 'no-referrer')
    const cookie = readCookie(req, OAUTH_COOKIE)
    const state = typeof req.query.state === 'string' ? req.query.state : ''
    const encrypted =
      cookie && state.length <= 128 ? store.takeOAuthAttempt(hash(cookie), hash(state)) : undefined
    if (!encrypted) return res.redirect(303, '/?auth_error=google_expired')
    res.clearCookie(OAUTH_COOKIE, cookieOptions)
    if (req.query.error)
      return res.redirect(
        303,
        `/?auth_error=${req.query.error === 'google_cancelled' ? 'google_cancelled' : 'google_failed'}`
      )
    try {
      requireValue(
        typeof req.query.code === 'string' && req.query.code.length <= 128,
        400,
        'Invalid sign-in code.'
      )
      const result = await upstream().post<{
        success: boolean
        token: string
        user: { id: number }
      }>(
        '/auth/google/exchange',
        {
          code: req.query.code,
          code_verifier: decrypt(encrypted),
          origin: config.origin
        },
        { skipAuth: true }
      )
      requireValue(result.success && result.token && result.user, 401, 'Sign-in failed.')
      const me = await createAuthApi(upstream(result.token)).me()
      requireValue(me.success && me.user && me.user.id === result.user.id, 401, 'Sign-in failed.')
      establish(req, res, result.token, String(me.user.id))
      return res.redirect(303, '/')
    } catch {
      return res.redirect(303, '/?auth_error=google_failed')
    }
  })
  router.post('/email/:action', async (req, res) => {
    requireValue(actions.has(String(req.params.action)), 404, 'Not found.')
    requireValue(req.body && typeof req.body === 'object', 400, 'Invalid request.')
    const result = await upstream().requestWithStatus<{
      success: boolean
      token?: string
      user?: { id: number }
      error?: string
    }>(`/auth/email/${req.params.action}`, { method: 'POST', body: req.body, skipAuth: true })
    if (result.data?.success && result.data.token && result.data.user) {
      establish(req, res, result.data.token, String(result.data.user.id))
    }
    const { token: _token, ...data } = result.data
    res.status(result.status).json(data)
  })
  router.get('/me', requireSession, (_req, res) =>
    res.json({ success: true, user: res.locals.user })
  )
  router.post('/logout', (req, res) => {
    const session = readSession(req)
    if (session) store.deleteSession(session.id)
    res.clearCookie(COOKIE, {
      path: '/',
      secure: config.secureCookies,
      httpOnly: true,
      sameSite: 'lax'
    })
    res.json({ success: true })
  })
  return { router, requireSession, token, upstream }
}
export type Auth = ReturnType<typeof createAuth>
