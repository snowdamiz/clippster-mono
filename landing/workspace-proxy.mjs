import http from 'node:http'
import https from 'node:https'

/** Stream video uploads, range playback and exports without buffering in the website server. */
export function proxyWorkspace(req, res, target) {
  return proxyRequest(req, res, target, '/workspace', 'The video workspace is unavailable. Please try again shortly.')
}

/** Keep shared desktop account requests on the website origin. The API validates the bearer token. */
export function proxyAccountApi(req, res, target) {
  return proxyRequest(req, res, target, '/api', 'The account API is unavailable. Please try again shortly.')
}

function proxyRequest(req, res, target, prefix, errorMessage) {
  const incoming = new URL(req.url || '/', 'http://localhost')
  const url = new URL(target)
  const suffix = incoming.pathname.slice(prefix.length)
  url.pathname = url.pathname.replace(/\/$/, '') + (suffix || '/')
  url.search = incoming.search
  const transport = url.protocol === 'https:' ? https : http
  const headers = { ...req.headers, host: url.host }
  delete headers.connection
  const upstream = transport.request(url, { method: req.method, headers }, response => {
    res.writeHead(response.statusCode || 502, response.headers)
    response.pipe(res)
  })
  upstream.on('error', () => {
    if (res.headersSent) return res.destroy()
    res.writeHead(502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify({ error: errorMessage }))
  })
  req.on('aborted', () => upstream.destroy())
  res.on('close', () => { if (!res.writableFinished) upstream.destroy() })
  req.pipe(upstream)
}
