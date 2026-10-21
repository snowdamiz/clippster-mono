import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const cli = fileURLToPath(new URL('./cli.mjs', import.meta.url))

test('CLI X-only missing-credentials run reports partial coverage and writes a usable review without network access', async (t) => {
  const directory = await mkdtemp(resolve(tmpdir(), 'outreach-cli-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const config = resolve(directory, 'config.json')
  const env = resolve(directory, '.env')
  await writeFile(config, JSON.stringify({ sources: ['x'], outputDir: './campaign' }))
  await writeFile(env, '')
  const options = { encoding: 'utf8', timeout: 10000, env: { PATH: process.env.PATH } }
  const result = spawnSync(process.execPath, [cli, 'discover', '--config', config, '--env', env], options)
  assert.equal(result.status, 2, result.stderr)
  assert.match(result.stdout, /Set X_BEARER_TOKEN/)
  const state = JSON.parse(await readFile(resolve(directory, 'campaign/state.json'), 'utf8'))
  assert.equal(Object.keys(state.discovery).length, 1)
  assert.deepEqual(state.selected, [])
  assert.match(await readFile(resolve(directory, 'campaign/review.html'), 'utf8'), /No channels found yet/)
  const report = spawnSync(process.execPath, [cli, 'report', '--config', config, '--env', env], options)
  assert.equal(report.status, 2)
  assert.match(report.stdout, /Review:/)
})

test('CLI help does not initialize a campaign or require credentials', () => {
  const result = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8', env: { PATH: process.env.PATH } })
  assert.equal(result.status, 0)
  assert.match(result.stdout, /X_BEARER_TOKEN/)
  assert.match(result.stdout, /always local drafts/)
  assert.match(result.stdout, /no Twitch\/Kick keys/)
})
