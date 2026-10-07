import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { once } from 'node:events'

for (const dockerReady of [false, true]) {
  test(
    `root setup prepares Docker with an existing database (Docker ready: ${dockerReady})`,
    {
      skip: process.platform === 'win32',
      timeout: 15_000
    },
    async () => {
      const root = realpathSync(mkdtempSync(join(tmpdir(), 'clippster-dev-setup-')))
      const database = createServer((socket) => socket.end()).listen(0)
      await once(database, 'listening')
      try {
        for (const directory of [
          'scripts',
          'bin',
          'server',
          'client/src-tauri/pumpfun-service',
          'client/src-tauri/sidecars/remotion-renderer/dist'
        ]) {
          mkdirSync(join(root, directory), { recursive: true })
        }
        copyFileSync(new URL('./dev-setup.mjs', import.meta.url), join(root, 'scripts/dev-setup.mjs'))
        writeFileSync(join(root, 'client/src-tauri/sidecars/remotion-renderer/dist/bundle.js'), '')
        if (dockerReady) writeFileSync(join(root, 'docker-ready'), '')
        for (const executable of ['yarn', 'mix', 'docker', 'open', 'sudo', 'lsof']) {
          writeFileSync(
            join(root, 'bin', executable),
            `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const command = path.basename(process.argv[1]);
const args = process.argv.slice(2);
fs.appendFileSync(process.env.CAPTURE, JSON.stringify({command, args}) + '\\n');
if (command === 'docker' && args[0] === 'info' && !fs.existsSync(process.env.DOCKER_READY)) process.exit(1);
if (command === 'open' || command === 'sudo') fs.writeFileSync(process.env.DOCKER_READY, '');
`,
            { mode: 0o755 }
          )
        }
        const capture = join(root, 'commands.jsonl')
        const child = spawn(process.execPath, [join(root, 'scripts/dev-setup.mjs')], {
          cwd: root,
          env: {
            ...process.env,
            PATH: join(root, 'bin'),
            DATABASE_PORT: String(database.address().port),
            CAPTURE: capture,
            DOCKER_READY: join(root, 'docker-ready')
          },
          stdio: ['ignore', 'pipe', 'pipe']
        })
        let output = ''
        child.stdout.on('data', (data) => {
          output += data
        })
        child.stderr.on('data', (data) => {
          output += data
        })
        const [code] = await once(child, 'close')
        assert.equal(code, 0, output)
        const calls = readFileSync(capture, 'utf8')
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line))
        assert.ok(calls.some((call) => call.command === 'docker' && call.args[0] === 'info'))
        assert.equal(
          calls.some((call) => ['open', 'sudo'].includes(call.command)),
          !dockerReady
        )
        assert.equal(
          calls.some((call) => call.command === 'docker' && call.args[0] === 'compose'),
          false,
          'an existing database must not be recreated'
        )
        assert.deepEqual(
          calls.filter((call) => call.command === 'mix').map((call) => call.args),
          [['deps.get'], ['ecto.create'], ['ecto.migrate']]
        )
      } finally {
        database.close()
        rmSync(root, { recursive: true, force: true })
      }
    }
  )
}
