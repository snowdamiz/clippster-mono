import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { mkdtemp, rmdir, rm, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { runCli } from './cli.mjs';

const require = createRequire(import.meta.url);
const audioDir = dirname(require.resolve('@mediapipe/tasks-audio'));
const modelPath = fileURLToPath(new URL('./yamnet.tflite', import.meta.url));
const SAMPLE_RATE = 16_000;
const CHUNK_SECONDS = 15;
const STEP_SECONDS = 14;
const MAX_SECONDS = 30 * 60;

async function extractAudio(input, output, ffmpegPath, signal) {
  await new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath || process.env.HYPERFRAMES_FFMPEG_PATH || 'ffmpeg', [
      '-nostdin', '-v', 'error', '-i', input, '-map', '0:a:0', '-ac', '1', '-ar', String(SAMPLE_RATE),
      '-t', String(MAX_SECONDS), '-f', 'f32le', '-y', output,
    ], { signal, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let errorText = '';
    child.stderr.on('data', chunk => { errorText = (errorText + chunk).slice(-2000); });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(new Error(errorText.trim() || `Audio extraction exited with ${code}`)));
  });
}

/** Local AudioSet scan. Findings are review candidates, never automatic mutes. */
export async function classifyAudioEvents({ path, ffmpegPath }, { signal } = {}) {
  if (typeof path !== 'string' || !path || (ffmpegPath !== undefined && typeof ffmpegPath !== 'string')) throw new Error('Invalid audio input');
  signal?.throwIfAborted();
  const directory = await mkdtemp(join(tmpdir(), 'clippster-audio-'));
  const pcmPath = join(directory, 'audio.f32le');
  let server;
  let browser;
  try {
    await extractAudio(path, pcmPath, ffmpegPath, signal);
    const bytes = (await stat(pcmPath)).size;
    const duration = bytes / (SAMPLE_RATE * 4);
    if (duration < 0.8) throw new Error('Finished audio is too short for the sound scan');
    const chunks = Math.max(1, Math.ceil(Math.max(0, duration - CHUNK_SECONDS) / STEP_SECONDS) + 1);
    const assets = new Map([
      ['/audio_bundle.mjs', [join(audioDir, 'audio_bundle.mjs'), 'text/javascript']],
      ['/wasm/audio_wasm_internal.js', [join(audioDir, 'wasm', 'audio_wasm_internal.js'), 'text/javascript']],
      ['/wasm/audio_wasm_internal.wasm', [join(audioDir, 'wasm', 'audio_wasm_internal.wasm'), 'application/wasm']],
      ['/wasm/audio_wasm_nosimd_internal.js', [join(audioDir, 'wasm', 'audio_wasm_nosimd_internal.js'), 'text/javascript']],
      ['/wasm/audio_wasm_nosimd_internal.wasm', [join(audioDir, 'wasm', 'audio_wasm_nosimd_internal.wasm'), 'application/wasm']],
      ['/model.tflite', [modelPath, 'application/octet-stream']],
    ]);
    server = createServer((request, response) => {
      if (request.url === '/') { response.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><title>Local audio analysis</title>'); return; }
      const chunk = /^\/chunk\/(\d+)$/.exec(request.url ?? '');
      if (chunk) {
        const index = Number(chunk[1]);
        if (!Number.isSafeInteger(index) || index >= chunks) { response.writeHead(404).end(); return; }
        const start = index * STEP_SECONDS * SAMPLE_RATE * 4;
        const end = Math.min(bytes, start + CHUNK_SECONDS * SAMPLE_RATE * 4) - 1;
        response.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' });
        createReadStream(pcmPath, { start, end }).pipe(response);
        return;
      }
      const asset = assets.get(request.url);
      if (!asset) { response.writeHead(404).end(); return; }
      response.writeHead(200, { 'Content-Type': asset[1], 'Cache-Control': 'no-store' });
      createReadStream(asset[0]).on('error', () => response.destroy()).pipe(response);
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const located = await runCli(['browser', 'path'], { signal });
    if (located.code !== 0) throw new Error('The local rendering browser is unavailable');
    browser = await puppeteer.launch({ executablePath: located.stdout.trim().split(/\r?\n/).pop(), headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const closeOnAbort = () => { void browser?.close(); };
    signal?.addEventListener('abort', closeOnAbort, { once: true });
    const timeout = setTimeout(closeOnAbort, 5 * 60_000);
    try {
      const page = await browser.newPage();
      const origin = `http://127.0.0.1:${server.address().port}`;
      await page.goto(origin);
      const analysis = await page.evaluate(async (origin, count, step, sampleRate) => {
        const { AudioClassifier, FilesetResolver } = await import(origin + '/audio_bundle.mjs');
        const fileset = await FilesetResolver.forAudioTasks(origin + '/wasm');
        const classifier = await AudioClassifier.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: origin + '/model.tflite' },
          maxResults: -1, scoreThreshold: 0,
        });
        try {
          const events = [];
          let analyzedWindows = 0;
          let lastTimestampMs = 0;
          for (let index = 0; index < count; index++) {
            const response = await fetch(`${origin}/chunk/${index}`);
            if (!response.ok) throw new Error('Could not read a local audio chunk');
            const audio = new Float32Array(await response.arrayBuffer());
            const results = classifier.classify(audio, sampleRate);
            analyzedWindows += results.length;
            lastTimestampMs = Math.max(lastTimestampMs, ...results.map(result => result.timestampMs ?? 0));
            if (index === 0 && !results.some(result => result.classifications.some(head => head.categories.some(category => category.categoryName === 'Cough')))) {
              throw new Error('The local AudioSet model did not return cough labels');
            }
            for (const result of results) for (const head of result.classifications) for (const category of head.categories) {
              if (category.categoryName !== 'Cough' && category.categoryName !== 'Throat clearing') continue;
              if (category.score < 0.35) continue;
              events.push({ time: index * step + (result.timestampMs ?? 0) / 1000, label: category.categoryName, score: category.score });
            }
          }
          return { events, analyzedWindows, lastTimestampMs };
        } finally { classifier.close(); }
      }, origin, chunks, STEP_SECONDS, SAMPLE_RATE);
      const clusters = [];
      const latestByLabel = new Map();
      for (const event of analysis.events.sort((a, b) => a.time - b.time)) {
        const cluster = latestByLabel.get(event.label);
        if (cluster && event.time - cluster.lastTime < 0.7) {
          cluster.lastTime = event.time;
          if (event.score > cluster.best.score) cluster.best = event;
        } else {
          const next = { best: event, lastTime: event.time };
          clusters.push(next);
          latestByLabel.set(event.label, next);
        }
      }
      const deduplicated = clusters.map(cluster => cluster.best).sort((a, b) => a.time - b.time);
      return { findings: deduplicated, scannedSeconds: duration, analyzedWindows: analysis.analyzedWindows, lastTimestampMs: analysis.lastTimestampMs, truncated: duration >= MAX_SECONDS - 0.1 };
    } finally { clearTimeout(timeout); signal?.removeEventListener('abort', closeOnAbort); }
  } finally {
    await browser?.close();
    if (server) await new Promise(resolve => server.close(resolve));
    await rm(pcmPath, { force: true }).catch(() => undefined);
    await rmdir(directory).catch(() => undefined);
  }
}
