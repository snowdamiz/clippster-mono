import { it, expect, vi } from 'vitest'

vi.mock('@clippster/shared-types', async (original) => ({ ...(await original<object>()), WEB_UPLOAD_CHUNK_BYTES: 4 }))

type Reply = { status: number; received: number } | 'network-error'
const sent: string[] = []
const replies: Reply[] = [
  { status: 200, received: 4 },
  'network-error',
  // The retried chunk had already arrived, so the server reports its position instead of storing it twice.
  { status: 409, received: 8 },
  { status: 200, received: 10 }
]
class FakeRequest {
  status = 0
  responseText = ''
  timeout = 0
  url = ''
  upload: { onprogress?: (event: { loaded: number }) => void } = {}
  onload?: () => void
  onerror?: () => void
  ontimeout?: () => void
  open(method: string, url: string) { this.url = `${method} ${url}` }
  setRequestHeader() {}
  send(body: Blob) {
    sent.push(this.url)
    const reply = replies.shift()
    queueMicrotask(() => {
      if (reply === 'network-error' || !reply) return this.onerror?.()
      this.upload.onprogress?.({ loaded: body.size })
      this.status = reply.status
      this.responseText = JSON.stringify({ received: reply.received })
      this.onload?.()
    })
  }
}

it('stages large files in chunks, resumes from the server position, and names the upload', async () => {
  vi.stubGlobal('location', new URL('https://clippster.app/workspace/'))
  vi.stubGlobal('XMLHttpRequest', FakeRequest)
  const begin = vi.fn(async () => new Response(JSON.stringify({ id: 'u1' }), { status: 201 }))
  vi.stubGlobal('fetch', begin)
  const { prepareUpload } = await import('../src/api')
  const small = new File(['abcd'], 'small.mp4')
  expect(await prepareUpload('/api/web/projects/p/source', small)).toEqual({ url: '/api/web/projects/p/source', body: small })
  expect(begin).not.toHaveBeenCalled()

  const progress: number[] = []
  const target = await prepareUpload('/api/web/projects/p/framing-assets?type=video', new File(['0123456789'], 'large.mp4'), (loaded) => progress.push(loaded))
  expect(target).toEqual({ url: '/api/web/projects/p/framing-assets?type=video&upload=u1', body: null })
  const [, init] = begin.mock.calls[0] as unknown as [string, RequestInit]
  expect(JSON.parse(String(init.body))).toEqual({ size: 10 })
  expect(sent).toEqual([
    'PUT /api/web/uploads/u1?offset=0',
    'PUT /api/web/uploads/u1?offset=4',
    'PUT /api/web/uploads/u1?offset=4',
    'PUT /api/web/uploads/u1?offset=8'
  ])
  expect(progress).toEqual([4, 8, 10])
})
