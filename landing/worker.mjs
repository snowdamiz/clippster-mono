// Cloudflare Worker entry: same routing as server.mjs, with static files from the ASSETS binding.
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

let indexHtml

function respond(status, body, headers = {}) {
  return new Response(body, { status, headers: { ...SECURITY_HEADERS, ...headers } })
}

/** Stream the request to the upstream unchanged; the upstream validates auth, cookies and ranges. */
async function proxy(request, target, prefix, errorMessage, upstream = { fetch }) {
  const incoming = new URL(request.url)
  const url = new URL(target)
  url.pathname = url.pathname.replace(/\/$/, '') + (incoming.pathname.slice(prefix.length) || '/')
  url.search = incoming.search
  try {
    return await upstream.fetch(url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'manual',
    })
  } catch {
    return Response.json({ error: errorMessage }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
  }
}

async function getIndexHtml(env, origin) {
  indexHtml ??= await (await env.ASSETS.fetch(new URL('/index.html', origin))).text()
  return indexHtml
}

async function handle(request, env) {
  const url = new URL(request.url)
  const pathname = normalizePath(url.pathname)

  if (isProxyPath(pathname, '/api')) {
    return proxy(request, API_URL, '/api', 'The account API is unavailable. Please try again shortly.')
  }

  if (isProxyPath(pathname, '/workspace')) {
    return proxy(request, 'https://clippster-web', '/workspace', 'The video workspace is unavailable. Please try again shortly.', env.WORKSPACE)
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return respond(405, 'Method Not Allowed')
  }

  if (pathname === '/health') {
    return respond(200, JSON.stringify({ ok: true }), {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache',
    })
  }

  const location = redirectLocation(url.hostname, pathname, url.search)
  if (location) return respond(301, null, { Location: location })

  if (pathname === '/sitemap.xml') {
    const sitemap = await renderSitemap()
    return respond(200, sitemap.xml, {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': sitemap.cacheControl,
    })
  }

  if (pathname !== '/') {
    const asset = await env.ASSETS.fetch(new URL(pathname, url.origin), { method: request.method })
    if (asset.ok) {
      const headers = new Headers(asset.headers)
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value)
      const type = headers.get('Content-Type') || ''
      if (/^(text\/|application\/(javascript|json|xml))/.test(type) && !/charset=/i.test(type)) {
        headers.set('Content-Type', `${type}; charset=utf-8`)
      }
      headers.set('Cache-Control', assetCacheControl(pathname))
      return new Response(asset.body, { status: 200, headers })
    }
  }

  const rendered = await renderPage(pathname, await getIndexHtml(env, url.origin))
  return respond(rendered.status, rendered.html, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  })
}

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env)
    } catch (error) {
      console.error('[seo-server]', error)
      return respond(500, 'Internal Server Error', { 'Content-Type': 'text/plain; charset=utf-8' })
    }
  },
}
