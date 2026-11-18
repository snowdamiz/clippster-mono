import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { cutoutPortrait, detectFaces } from '../lib/face-score.mjs';
import { runCli } from '../lib/cli.mjs';

test('the packaged local face model detects a face in a bundled portrait', async context => {
  const browser = await runCli(['browser', 'path']);
  if (browser.code !== 0) return context.skip('Rendering browser is not installed');
  const portrait = fileURLToPath(new URL('../../../../public/editor/stock/portrait.jpg', import.meta.url));
  const [faces] = await detectFaces({ paths: [portrait] });
  assert.ok(faces.some(face => face.score > 0.8 && face.width > 0.1 && face.height > 0.1));
  assert.ok(faces.some(face => face.keypoints.length >= 3 && face.keypoints.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))));
});

test('the packaged portrait model creates a local PNG cutout', async context => {
  const browser = await runCli(['browser', 'path']);
  if (browser.code !== 0) return context.skip('Rendering browser is not installed');
  const folder = await mkdtemp(join(tmpdir(), 'clippster-portrait-'));
  try {
    const portrait = fileURLToPath(new URL('../../../../public/editor/stock/portrait.jpg', import.meta.url));
    const destination = join(folder, 'cutout.png');
    const result = await cutoutPortrait({ path: portrait, destination });
    assert.ok(result.foregroundFraction > 0.05 && result.foregroundFraction < 0.95);
    assert.ok(result.transparentPixels > 1000 && result.opaquePixels > 1000);
    const bytes = await readFile(destination);
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.ok(bytes.length > 1000);
  } finally { await rm(folder, { recursive: true, force: true }); }
});
