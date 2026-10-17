import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { proxyWorkspace, proxyAccountApi } from './workspace-proxy.mjs'

test('workspace proxy streams authenticated uploads, cookies and ranged playback on the account origin', async () => {
  const received = []
  const upstream = http.createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    received.push({ url: req.url, method: req.method, headers: req.headers, body: Buffer.concat(chunks).toString() })
    res.writeHead(req.headers.range ? 206 : 200, {
      'Set-Cookie': 'clippster_web=session; HttpOnly; SameSite=Lax; Path=/',
      'Content-Type': 'video/mp4', 'Content-Range': 'bytes 0-3/4'
    })
    res.end('test')
  })
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve))
  const target = `http://127.0.0.1:${upstream.address().port}`
  const website = http.createServer((req, res) => proxyWorkspace(req, res, target))
  await new Promise(resolve => website.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${website.address().port}`
  try {
    const upload = await fetch(origin + '/workspace/api/web/source?project=1', {
      method: 'PUT', headers: { Cookie: 'clippster_web=session', Origin: origin }, body: 'video data'
    })
    assert.equal(upload.status, 200)
    assert.match(upload.headers.get('set-cookie'), /HttpOnly/)
    const playback = await fetch(origin + '/workspace/api/web/source', { headers: { Range: 'bytes=0-3' } })
    assert.equal(playback.status, 206)
    assert.equal(await playback.text(), 'test')
    assert.equal(received[0].url, '/api/web/source?project=1')
    assert.equal(received[0].body, 'video data')
    assert.equal(received[0].headers.cookie, 'clippster_web=session')
    assert.equal(received[0].headers.origin, origin)
    await fetch(origin + '/workspace//evil.example/secret')
    assert.equal(received[2].headers.host, new URL(target).host)
    assert.equal(received[2].url, '//evil.example/secret')
  } finally {
    website.closeAllConnections(); upstream.closeAllConnections()
    await Promise.all([website, upstream].map(server => new Promise(resolve => server.close(resolve))))
  }
})

test('account proxy forwards profile, analytics and multipart uploads to the configured API', async () => {
  const received = []
  const api = http.createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    received.push({ path: req.url, method: req.method, authorization: req.headers.authorization, type: req.headers['content-type'], body: Buffer.concat(chunks).toString() })
    res.writeHead(200, { 'Content-Type': 'application/json' });res.end(JSON.stringify({ success: true }))
  })
  await new Promise(resolve => api.listen(0, '127.0.0.1', resolve))
  const website = http.createServer((req, res) => proxyAccountApi(req, res, `http://127.0.0.1:${api.address().port}/api`))
  await new Promise(resolve => website.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${website.address().port}`
  try {
    const headers = { Authorization: 'Bearer fixture' }
    assert.equal((await fetch(origin + '/api/user/clipper-profile', { headers })).status, 200)
    assert.equal((await fetch(origin + '/api/user/posts/sync-analytics', { method: 'POST', headers })).status, 200)
    const form = new FormData();form.append('avatar', new Blob(['avatar bytes']), 'avatar.png')
    assert.equal((await fetch(origin + '/api/user/clipper-profile/avatar', { method: 'POST', headers, body: form })).status, 200)
    assert.deepEqual(received.map(item => item.path), ['/api/user/clipper-profile', '/api/user/posts/sync-analytics', '/api/user/clipper-profile/avatar'])
    assert.ok(received.every(item => item.authorization === 'Bearer fixture'))
    assert.match(received[2].type, /multipart\/form-data/)
    assert.match(received[2].body, /avatar bytes/)
  } finally {
    website.closeAllConnections();api.closeAllConnections()
    await Promise.all([website, api].map(server => new Promise(resolve => server.close(resolve))))
  }
})
