import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { proxyWorkspace, proxyAccountApi } from './workspace-proxy.mjs'
import {
  API_URL,
  SECURITY_HEADERS,
  assetCacheControl,
  isProxyPath,
  normalizePath,
  redirectLocation,
  renderPage,
  renderSitemap,
} from './site.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.join(__dirname, 'dist')
const PORT = Number(process.env.PORT || 8080)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

let cachedIndexHtml

function getIndexHtml() {
  if (!cachedIndexHtml) {
    const distIndex = path.join(DIST_DIR, 'index.html')
    const sourceIndex = path.join(__dirname, 'index.html')
    // Prefer the Vite build; fall back to source so SEO unit tests can run without `yarn build`.
    if (fs.existsSync(distIndex)) {
      cachedIndexHtml = fs.readFileSync(distIndex, 'utf8')
    } else if (fs.existsSync(sourceIndex)) {
      cachedIndexHtml = fs.readFileSync(sourceIndex, 'utf8')
    } else {
      throw new Error(`Missing index.html (tried ${distIndex} and ${sourceIndex})`)
    }
  }
  return cachedIndexHtml
}

export function renderApp(pathname) {
  return renderPage(pathname, getIndexHtml())
}

function send(res, status, body, headers = {}) {
  const isHead = res.req?.method === 'HEAD'
  const payload =
    body == null || body === ''
      ? Buffer.alloc(0)
      : Buffer.isBuffer(body)
        ? body
        : Buffer.from(String(body))
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Length': String(payload.length),
    ...headers,
  })
  if (isHead) {
    res.end()
    return
  }
  res.end(payload)
}

function sendHtml(res, status, html, extraHeaders = {}) {
  send(res, status, html, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    ...extraHeaders,
  })
}

function safeJoinDist(urlPath) {
  const relative = decodeURIComponent(urlPath).replace(/^\/+/, '')
  const full = path.normalize(path.join(DIST_DIR, relative))
  if (!full.startsWith(DIST_DIR)) return null
  return full
}

async function handle(req, res) {
  res.req = req
  const host = req.headers.host || 'clippster.app'
  const url = new URL(req.url || '/', `http://${host}`)
  const pathname = normalizePath(url.pathname)

  if (isProxyPath(pathname, '/api')) {
    proxyAccountApi(req, res, API_URL)
    return
  }

  if (isProxyPath(pathname, '/workspace')) {
    proxyWorkspace(req, res, process.env.WORKSPACE_URL || 'http://127.0.0.1:8090')
    return
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'Method Not Allowed')
    return
  }

  if (pathname === '/health') {
    send(res, 200, JSON.stringify({ ok: true }), {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache',
    })
    return
  }

  const location = redirectLocation(host.split(':')[0].toLowerCase(), pathname, url.search)
  if (location) {
    send(res, 301, '', { Location: location })
    return
  }

  if (pathname === '/sitemap.xml') {
    const sitemap = await renderSitemap()
    send(res, 200, sitemap.xml, {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': sitemap.cacheControl,
    })
    return
  }

  const filePath = pathname === '/' ? null : safeJoinDist(pathname)
  if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    send(res, 200, fs.readFileSync(filePath), {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': assetCacheControl(filePath),
    })
    return
  }

  const rendered = await renderApp(pathname)
  sendHtml(res, rendered.status, rendered.html)
}

export function createServer() {
  return http.createServer((req, res) => {
    handle(req, res).catch((error) => {
      console.error('[seo-server]', error)
      send(res, 500, 'Internal Server Error', { 'Content-Type': 'text/plain; charset=utf-8' })
    })
  })
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  createServer().listen(PORT, '0.0.0.0', () => {
    console.log(`Clippster landing listening on ${PORT}`)
  })
}
