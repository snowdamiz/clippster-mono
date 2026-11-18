import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { runCli } from '../lib/cli.mjs';
import { capturePageScreenshot } from '../lib/page-capture.mjs';

test('static page screenshot contains captured HTML without requesting its remote images', async context => {
  const browser = await runCli(['browser', 'path']);
  if (browser.code !== 0) return context.skip('Rendering browser is not installed');
  let requests = 0;
  const server = createServer((_request, response) => { requests++; response.writeHead(200).end('unexpected'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const folder = await mkdtemp(join(tmpdir(), 'clippster-source-page-'));
  try {
    const destination = join(folder, 'page.png');
    const html = `<h1>Captured company article</h1><p style="width:220px">Earlier context. <span>Pepsi reported</span> revenue of 5.2 billion in the quarter. Later context.</p><img src="http://127.0.0.1:${server.address().port}/private">`;
    const result = await capturePageScreenshot({ html, destination, highlightText: 'Pepsi reported revenue of 5.2 billion in the quarter.', sourceUrl: 'https://pepsi.example/report', capturedAt: '2026-11-03T12:00:00Z' });
    assert.equal(result.highlighted, true);
    assert.ok(result.highlightRects >= 2);
    assert.equal(result.sourceLabel, 'Source: pepsi.example · Captured 2026-11-03 UTC · Static copy');
    const bytes = await readFile(destination);
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.ok(bytes.length > 1000);
    assert.equal(requests, 0);
    const unmatched = await capturePageScreenshot({ html, destination: join(folder, 'unmatched.png'), highlightText: 'A different claim with no matching article line.' });
    assert.equal(unmatched.highlighted, false);
    assert.equal(unmatched.highlightRects, 0);
  } finally {
    await rm(folder, { recursive: true, force: true });
    await new Promise(resolve => server.close(resolve));
  }
});
