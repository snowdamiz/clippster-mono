import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readConfig } from '../server/config'
import { sourceUrl } from '../server/validation'
import { downloadSource, probe } from '../server/media'
const config = readConfig()
const url = sourceUrl(process.argv[2])
const directory = await mkdtemp(join(tmpdir(), 'clippster-source-smoke-'))
try {
  const signal = AbortSignal.timeout(10 * 60_000)
  const path = await downloadSource(url, directory, config, signal, (progress, message) =>
    console.log(`${Math.round(progress)}% ${message}`)
  )
  console.log(JSON.stringify(await probe(path, config, signal)))
} finally {
  await rm(directory, { recursive: true, force: true })
}
