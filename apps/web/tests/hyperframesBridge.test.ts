import { it, expect } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HyperframesBridge } from '../server/hyperframesBridge'

it('relays renderer progress, results, errors, and cancellation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'clippster-renderer-'))
  const script = join(directory, 'renderer.mjs')
  await writeFile(script, String.raw`
    import readline from 'node:readline';
    const send = value => process.stdout.write(JSON.stringify(value) + '\n');
    send({ id: null, type: 'ready' });
    readline.createInterface({ input: process.stdin }).on('line', line => {
      const item = JSON.parse(line);
      if (item.op === 'cancel') return send({ id: item.target, type: 'error', error: 'Cancelled', cancelled: true });
      if (item.op === 'wait') return;
      if (item.op === 'fail') return send({ id: item.id, type: 'error', error: 'Render failed' });
      send({ id: item.id, type: 'progress', progress: 0.5, stage: 'rendering' });
      send({ id: item.id, type: 'result', data: { value: item.value } });
    });
  `)
  const bridge = new HyperframesBridge(script)
  try {
    const progress: number[] = []
    expect(await bridge.request<{ value: number }>('echo', { value: 7 }, { onProgress: value => progress.push(value) })).toEqual({ value: 7 })
    expect(progress).toEqual([0.5])
    await expect(bridge.request('fail')).rejects.toThrow('Render failed')
    const controller = new AbortController()
    const pending = bridge.request('wait', {}, { signal: controller.signal })
    await new Promise(resolve => setImmediate(resolve))
    controller.abort()
    await expect(pending).rejects.toThrow('Cancelled')
  } finally {
    await bridge.close()
    await rm(directory, { recursive: true, force: true })
  }
})
