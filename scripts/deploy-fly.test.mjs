import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

for (const target of ['web', 'server', 'landing']) {
  test(`deploy helper selects the ${target} app without contacting Fly`, () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'clippster-deploy-test-')))
    try {
      mkdirSync(join(root, 'scripts'))
      mkdirSync(join(root, 'server'))
      mkdirSync(join(root, 'bin'))
      copyFileSync(new URL('./deploy-fly.mjs', import.meta.url), join(root, 'scripts/deploy-fly.mjs'))
      const capture = join(root, 'invocation.json')
      writeFileSync(
        join(root, 'bin/flyctl'),
        `#!${process.execPath}\nimport('node:fs').then(fs => fs.writeFileSync(process.env.CAPTURE, JSON.stringify({args:process.argv.slice(2),cwd:process.cwd(),token:process.env.FLY_API_TOKEN})));\n`,
        { mode: 0o755 }
      )
      writeFileSync(join(root, 'server/.env'), `FLY_${target.toUpperCase()}_TOKEN="file-fixture-token"\n`)
      const result = spawnSync(process.execPath, [join(root, 'scripts/deploy-fly.mjs'), target], {
        encoding: 'utf8',
        timeout: 10_000,
        env: {
          PATH: join(root, 'bin'),
          CAPTURE: capture,
          [`FLY_${target.toUpperCase()}_TOKEN`]: 'environment-fixture-token'
        }
      })
      assert.equal(result.status, 0, result.stderr)
      const invocation = JSON.parse(readFileSync(capture, 'utf8'))
      assert.equal(invocation.token, 'environment-fixture-token')
      assert.equal(invocation.cwd, target === 'server' ? join(root, 'server') : root)
      assert.deepEqual(invocation.args.slice(0, 3), ['deploy', '.', '--remote-only'])
      assert.equal(invocation.args.includes('--ha=false'), target === 'web')
      if (target !== 'server') {
        const directory = target === 'web' ? 'apps/web' : 'landing'
        assert.equal(invocation.args[invocation.args.indexOf('--config') + 1], `${directory}/fly.toml`)
        assert.equal(invocation.args[invocation.args.indexOf('--dockerfile') + 1], `${directory}/Dockerfile`)
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
}
