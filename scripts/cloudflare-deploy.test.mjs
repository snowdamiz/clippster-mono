import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('the shared container lifecycle restarts the container on every deploy, gracefully', () => {
  const shared = read('../cloudflare/container.mjs')
  // A running container keeps the image it started with, so a new Worker version (each deploy) must restart it,
  // not only a change of secrets or vars.
  assert.match(shared, /this\.env\.CF_VERSION_METADATA\?\.id/)
  assert.match(shared, /await this\.ctx\.storage\.get\('startHash'\)\) !== startHash/)
  // SIGTERM first, so the server finishes its writes and R2 mounts upload pending files before the hard stop.
  assert.match(shared, /container\.signal\(15\)[\s\S]*await container\.destroy\(\)/)

  for (const worker of ['../server/cloudflare/wrangler.jsonc', '../apps/web/cloudflare/wrangler.jsonc']) {
    assert.match(read(worker), /"version_metadata": \{ "binding": "CF_VERSION_METADATA" \}/, worker)
  }
})
