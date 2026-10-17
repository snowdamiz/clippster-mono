import { readFile, writeFile, rename, stat, rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type { Config } from './config'
import type { WebProject } from '@clippster/shared-types'
import { projectDirectory } from './storage'
import { run } from './process'

const pending = new Map<string, Promise<Buffer>>()
const cache = new Map<string, Buffer>()
const MAX_CACHE_BYTES = 64 * 1024 ** 2

/** Decode only mono audio. Preserve a peak for each 10ms without astats text output. */
export async function waveformData(project: WebProject, config: Config): Promise<Buffer> {
  if (!project.hasAudio) return Buffer.alloc(0)
  const directory = projectDirectory(config, project.id), source = join(directory, 'source.mp4')
  const metadata = await stat(source), key = `${source}-${metadata.size}-${metadata.mtimeMs}`
  const hit = cache.get(key)
  if (hit) { cache.delete(key); cache.set(key, hit); return hit }
  let extraction = pending.get(key)
  if (!extraction) {
    extraction = (async () => {
      const output = join(directory, 'waveform-v2.f32'), stamp = `${metadata.size}-${metadata.mtimeMs}`
      let data: Buffer | undefined
      try { if ((await readFile(output + '.source', 'utf8')) === stamp) data = await readFile(output) } catch { /* First use or changed source. */ }
      if (!data) {
        const peaks: number[] = []; let carry = Buffer.alloc(0), peak = 0, samples = 0
        await run(config.ffmpeg, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-i', source, '-map', '0:a:0', '-vn', '-ac', '1', '-ar', '8000', '-c:a', 'pcm_s16le', '-f', 's16le', 'pipe:1'], AbortSignal.timeout(10 * 60_000), 10 * 60_000, undefined, false, chunk => {
          const input = carry.length ? Buffer.concat([carry, chunk]) : chunk
          const complete = input.length - input.length % 2
          for (let offset = 0; offset < complete; offset += 2) {
            const value = Math.abs(input.readInt16LE(offset)); if (value > peak) peak = value
            if (++samples === 80) { peaks.push(peak / 32768); peak = 0; samples = 0 }
          }
          carry = Buffer.from(input.subarray(complete))
        })
        if (samples) peaks.push(peak / 32768)
        data = Buffer.alloc(peaks.length * 4); peaks.forEach((value, index) => data!.writeFloatLE(value, index * 4))
        const temporary = output + '.' + randomUUID() + '.tmp'
        try {
          await writeFile(temporary, data, { mode: 0o600 })
          await writeFile(temporary + '.source', stamp, { mode: 0o600 })
          await rename(temporary, output)
          await rename(temporary + '.source', output + '.source')
        } catch { /* Disk caching is optional: decoded peaks still serve this request. */ }
        finally { await Promise.all([rm(temporary, { force: true }), rm(temporary + '.source', { force: true })]).catch(() => {}) }
      }
      cache.set(key, data)
      let bytes = [...cache.values()].reduce((sum, value) => sum + value.length, 0)
      while (bytes > MAX_CACHE_BYTES && cache.size) { const first = cache.keys().next().value!; bytes -= cache.get(first)!.length; cache.delete(first) }
      return data
    })()
    pending.set(key, extraction)
    extraction.finally(() => pending.delete(key)).catch(() => {})
  }
  return extraction
}
