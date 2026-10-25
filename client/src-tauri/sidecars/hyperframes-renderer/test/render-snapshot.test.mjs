import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { withRenderSnapshot } from '../lib/render-snapshot.mjs';
test('export uses the captured files while editing continues and cleans up its snapshot', async () => {
  const project = await fs.mkdtemp(path.join(os.tmpdir(), 'clippster-export-test-'));
  let captured;
  try {
    await fs.mkdir(path.join(project, 'assets'));
    await fs.writeFile(path.join(project, 'assets', 'image.svg'), '<svg/>');
    await fs.writeFile(path.join(project, 'index.html'), 'old unsaved workspace');
    const result = await withRenderSnapshot(project, { 'index.html': 'selected edit', 'compositions/scene.html': 'edited icon' }, async snapshot => {
      captured = snapshot;
      await fs.writeFile(path.join(project, 'index.html'), 'newer edit during export');
      assert.equal(await fs.readFile(path.join(snapshot, 'index.html'), 'utf8'), 'selected edit');
      assert.equal(await fs.readFile(path.join(snapshot, 'compositions/scene.html'), 'utf8'), 'edited icon');
      assert.equal(await fs.readFile(path.join(snapshot, 'assets/image.svg'), 'utf8'), '<svg/>');
      return 'rendered';
    });
    assert.equal(result, 'rendered');
    await assert.rejects(fs.access(captured));
    assert.equal(await fs.readFile(path.join(project, 'index.html'), 'utf8'), 'newer edit during export');
  } finally { await fs.rm(project, { recursive: true, force: true }); }
});
