import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { proxyWorkspace } from './workspace-proxy.mjs'

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
