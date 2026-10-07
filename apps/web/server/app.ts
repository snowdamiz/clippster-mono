import express from 'express'
import type { ErrorRequestHandler } from 'express'
import { resolve } from 'node:path'
import type { Config } from './config'
import { Store } from './store'
import { createAuth } from './auth'
import { Jobs } from './jobs'
import { workspaceRoutes } from './routes'
import { HttpError } from './errors'
export async function createWebApp(config: Config) {
  const store = new Store(config.dataDir)
  const auth = createAuth(store, config)
  const jobs = new Jobs(store, config, auth)
  await jobs.start()
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', config.secureCookies ? 1 : false)
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
    })
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin !== config.origin) {
      next(new HttpError(403, 'Request origin is not allowed.'))
      return
    }
    next()
  })
  app.get('/api/health', (_req, res) => {
    store.db.prepare('SELECT 1').get()
    res.json({ status: 'ok' })
  })
  app.use(express.json({ limit: '64kb' }))
  app.use('/api/auth', auth.router)
  app.use('/api/web', workspaceRoutes(store, config, auth, jobs))
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }))
  app.use(express.static(resolve('dist/public'), { index: false, maxAge: '1h' }))
  app.get('/{*path}', (_req, res) =>
    res.sendFile(resolve('dist/public/index.html'), { headers: { 'Cache-Control': 'no-cache' } })
  )
  const errors: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) {
      next(error)
      return
    }
    const status =
      error instanceof HttpError
        ? error.status
        : error.status === 413
          ? 413
          : error.type === 'entity.parse.failed'
            ? 400
            : 500
    res
      .status(status)
      .json({
        error:
          error instanceof HttpError
            ? error.message
            : status === 400
              ? 'Invalid JSON.'
              : status === 413
                ? 'Request is too large.'
                : 'The service could not complete this request. Please try again.'
      })
    if (status >= 500)
      console.error(
        JSON.stringify({ event: 'web_request_failed', status, type: error.name || 'Error' })
      )
  }
  app.use(errors)
  return {
    app,
    store,
    jobs,
    close: async () => {
      await jobs.stop()
      store.close()
    }
  }
}
