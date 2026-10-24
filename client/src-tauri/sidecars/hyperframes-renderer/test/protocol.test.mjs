import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('../index.mjs', import.meta.url));

let child;
let projectDir;
let nextId = 0;
const waiting = new Map();
let ready;

function request(op, params = {}) {
  const id = `t${++nextId}`;
  return new Promise((resolve) => {
    waiting.set(id, resolve);
    child.stdin.write(`${JSON.stringify({ id, op, ...params })}\n`);
  });
}

before(async () => {
  projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hf-sidecar-test-'));
  child = spawn(process.execPath, [entry], { stdio: ['pipe', 'pipe', 'inherit'] });
  ready = new Promise((resolve) => {
    readline.createInterface({ input: child.stdout }).on('line', (line) => {
      const message = JSON.parse(line);
      if (message.type === 'ready') return resolve();
      if (message.type === 'progress') return;
      waiting.get(message.id)?.(message);
      waiting.delete(message.id);
    });
  });
  await ready;
});

after(async () => {
  child.stdin.end();
  await new Promise((resolve) => child.once('exit', resolve));
  await fs.rm(projectDir, { recursive: true, force: true });
});

test('initializes a workspace with vendored GSAP', async () => {
  const response = await request('initWorkspace', { projectDir });
  assert.equal(response.type, 'result');
  assert.equal(response.data.gsapSrc, 'assets/vendor/gsap.min.js');
  await fs.access(path.join(projectDir, 'assets/vendor/gsap.min.js'));
  const config = JSON.parse(await fs.readFile(path.join(projectDir, 'hyperframes.json'), 'utf8'));
  assert.equal(config.paths.blocks, 'compositions');
});

test('writes, lists, reads and deletes authored files', async () => {
  const html = '<!doctype html><div data-composition-id="root"></div>';
  const written = await request('writeFile', { projectDir, path: 'index.html', content: html });
  assert.deepEqual(written.data, { path: 'index.html', bytes: Buffer.byteLength(html) });
  await request('writeFile', { projectDir, path: 'compositions/intro.html', content: '<div></div>' });

  const listed = await request('listFiles', { projectDir });
  assert.deepEqual(listed.data.files, ['compositions/intro.html', 'hyperframes.json', 'index.html']);

  const read = await request('readFile', { projectDir, path: 'index.html' });
  assert.equal(read.data.content, html);

  await request('deleteFile', { projectDir, path: 'compositions/intro.html' });
  const afterDelete = await request('listFiles', { projectDir });
  assert.deepEqual(afterDelete.data.files, ['hyperframes.json', 'index.html']);
});

test('rejects paths outside the workspace and non-authored file types', async () => {
  const escape = await request('writeFile', { projectDir, path: '../escape.html', content: 'x' });
  assert.equal(escape.type, 'error');
  assert.match(escape.error, /escapes the workspace/);

  const script = await request('writeFile', { projectDir, path: 'payload.js', content: 'x' });
  assert.equal(script.type, 'error');
  assert.match(script.error, /can be written/);
});

test('links media by id and rejects unsafe ids', async () => {
  const source = path.join(projectDir, 'source.mp4');
  await fs.writeFile(source, 'not really a video');
  const linked = await request('linkMedia', { projectDir, items: [{ id: 'clip-1', path: source }] });
  assert.deepEqual(linked.data.linked, [{ id: 'clip-1', src: 'assets/media/clip-1.mp4' }]);
  await fs.access(path.join(projectDir, 'assets/media/clip-1.mp4'));

  const unsafe = await request('linkMedia', { projectDir, items: [{ id: '../x', path: source }] });
  assert.equal(unsafe.type, 'error');
});

test('reports unknown operations', async () => {
  const response = await request('explode');
  assert.equal(response.type, 'error');
  assert.equal(response.error, 'Unknown op: explode');
});
