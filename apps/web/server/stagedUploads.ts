import { Router, type Request } from 'express'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, rm, statfs, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Transform, type Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { randomUUID } from 'node:crypto'
import { WEB_UPLOAD_CHUNK_BYTES } from '@clippster/shared-types'
import type { Config } from './config'
import { requireValue, HttpError } from './errors'

const idleMs = 60 * 60_000
type Staged = { owner: string; path: string; size: number; received: number; touched: number; writing: boolean }
export type StagedUploads = ReturnType<typeof stagedUploads>

/** Assembles files sent in chunks; upload routes read a finished one by passing `?upload=<id>` instead of a body. */
export function stagedUploads(config: Config) {
  const directory = join(config.dataDir, 'staged-uploads')
  const staged = new Map<string, Staged>()
  // The index lives in memory, so files left by a previous process can never be finished.
  const ready = rm(directory, { recursive: true, force: true }).then(() => mkdir(directory, { recursive: true, mode: 0o700 }))
  ready.catch(() => { /* Reported by the first upload that awaits it. */ })
  const discard = async (id: string, upload: Staged) => { staged.delete(id); await rm(upload.path, { force: true }) }
  const owned = (id: string, owner: string) => {
    const upload = staged.get(id)
    requireValue(upload && upload.owner === owner, 404, 'Upload not found. Please start the upload again.')
    return upload
  }
  const router = Router()
  router.post('/uploads', async (req, res) => {
    const owner = res.locals.session.owner, size = Number(req.body?.size)
    requireValue(Number.isSafeInteger(size) && size > 0, 400, 'Choose a file to upload.')
    requireValue(size <= config.maxSourceBytes, 413, `Files must be ${Math.round(config.maxSourceBytes / 1024 ** 3)} GB or smaller.`)
    for (const [id, upload] of staged) if (Date.now() - upload.touched > idleMs) await discard(id, upload)
    requireValue([...staged.values()].filter((upload) => upload.owner === owner).length < 2 && staged.size < 8, 409, 'Wait for your current upload to finish.')
    await ready
    const disk = await statfs(config.dataDir)
    requireValue(disk.bavail * disk.bsize > size * 2, 507, 'Media storage is full. Please try later.')
    const id = randomUUID(), path = join(directory, id)
    await writeFile(path, '', { flag: 'wx', mode: 0o600 })
    staged.set(id, { owner, path, size, received: 0, touched: Date.now(), writing: false })
    res.status(201).json({ id })
  })
  router.put('/uploads/:id', async (req, res) => {
    const upload = owned(String(req.params.id), res.locals.session.owner), offset = Number(req.query.offset)
    // A retried chunk the server already stored resumes from the server's position.
    if (offset !== upload.received || upload.writing) {
      res.status(409).json({ error: 'The upload is out of sync. Resuming.', received: upload.received })
      return
    }
    requireValue(req.is('application/octet-stream'), 415, 'Upload the original file.')
    upload.writing = true
    try {
      let bytes = 0
      await pipeline(req, new Transform({ transform(chunk, _encoding, callback) {
        bytes += chunk.length
        callback(bytes > WEB_UPLOAD_CHUNK_BYTES || offset + bytes > upload.size ? new HttpError(413, 'The upload chunk is too large.') : null, chunk)
      } }), createWriteStream(upload.path, { flags: 'r+', start: offset }))
      upload.received = offset + bytes
      upload.touched = Date.now()
      res.json({ received: upload.received })
    } finally { upload.writing = false }
  })
  router.delete('/uploads/:id', async (req, res) => {
    const id = String(req.params.id)
    await discard(id, owned(id, res.locals.session.owner))
    res.status(204).end()
  })
  /** The finished staged file when the request names one, otherwise the request body itself. */
  function body(req: Request, owner: string): Readable {
    if (!req.query.upload) return req
    const id = String(req.query.upload), upload = owned(id, owner)
    requireValue(upload.received === upload.size && !upload.writing, 409, 'The upload is not finished yet.')
    staged.delete(id)
    const stream = createReadStream(upload.path, { end: upload.size - 1 })
    stream.once('close', () => void rm(upload.path, { force: true }))
    return stream
  }
  return { router, body }
}
