import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rmdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { classifyAudioEvents } from '../lib/audio-score.mjs';
import { runCli } from '../lib/cli.mjs';

function toneWav() {
  const sampleRate = 16_000;
  const samples = sampleRate * 3;
  const output = Buffer.alloc(44 + samples * 2);
  output.write('RIFF', 0);
  output.writeUInt32LE(output.length - 8, 4);
  output.write('WAVEfmt ', 8);
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(1, 22);
  output.writeUInt32LE(sampleRate, 24);
  output.writeUInt32LE(sampleRate * 2, 28);
  output.writeUInt16LE(2, 32);
  output.writeUInt16LE(16, 34);
  output.write('data', 36);
  output.writeUInt32LE(samples * 2, 40);
  for (let index = 0; index < samples; index++) output.writeInt16LE(Math.round(Math.sin(index * Math.PI * 880 / sampleRate) * 6000), 44 + index * 2);
  return output;
}

test('local AudioSet scan classifies finished audio without reporting a cough for a pure tone', async context => {
  const ffmpeg = process.env.HYPERFRAMES_FFMPEG_PATH || 'ffmpeg';
  if (spawnSync(ffmpeg, ['-version'], { windowsHide: true }).status !== 0) return context.skip('FFmpeg is not installed');
  const browser = await runCli(['browser', 'path']);
  if (browser.code !== 0) return context.skip('Rendering browser is not installed');
  const directory = await mkdtemp(join(tmpdir(), 'clippster-sound-test-'));
  const path = join(directory, 'tone.wav');
  try {
    await writeFile(path, toneWav());
    const result = await classifyAudioEvents({ path, ffmpegPath: ffmpeg });
    assert.ok(result.scannedSeconds >= 2.9);
    assert.ok(result.analyzedWindows > 1 && result.lastTimestampMs > 0);
    assert.equal(result.truncated, false);
    assert.deepEqual(result.findings, []);
  } finally {
    await rm(path, { force: true });
    await rmdir(directory);
  }
});
