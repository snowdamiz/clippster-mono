import http from 'node:http'
import https from 'node:https'

/** Stream video uploads, range playback and exports without buffering in the website server. */
export function proxyWorkspace(req, res, target) {
  const incoming = new URL(req.url || '/', 'http://localhost')
  const url = new URL(target)
  url.pathname = incoming.pathname.replace(/^\/workspace(?=\/|$)/, '') || '/'
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
    res.end(JSON.stringify({ error: 'The video workspace is unavailable. Please try again shortly.' }))
  })
  req.on('aborted', () => upstream.destroy())
  res.on('close', () => { if (!res.writableFinished) upstream.destroy() })
  req.pipe(upstream)
}
