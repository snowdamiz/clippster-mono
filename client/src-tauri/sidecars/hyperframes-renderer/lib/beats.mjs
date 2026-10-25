import { spawn } from 'node:child_process';
import { analyzeMusicFromSignal } from '@hyperframes/core/beats';

const SAMPLE_RATE = 22050;

function decodeMono(audioPath, { start, duration, signal }) {
  const args = ['-v', 'error'];
  if (start) args.push('-ss', String(start));
  if (duration) args.push('-t', String(duration));
  args.push('-i', audioPath, '-vn', '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 'f32le', 'pipe:1');
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.HYPERFRAMES_FFMPEG_PATH || 'ffmpeg', args, { signal, windowsHide: true });
    const chunks = [];
    let stderr = '';
    child.stdout.on('data', (c) => chunks.push(c));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(stderr.trim() || `ffmpeg exited with ${code}`));
      const buf = Buffer.concat(chunks);
      resolve(new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4)));
    });
  });
}

/** Beat grid with per-beat strength for any audio or video file (no project needed). */
export async function beats({ audioPath, start, duration }, { signal } = {}) {
  const samples = await decodeMono(audioPath, { start, duration, signal });
  if (samples.length === 0) return { bpm: null, bpmConfidence: 'uncertain', beats: [] };
  const analysis = await analyzeMusicFromSignal({ sampleRate: SAMPLE_RATE, channels: [samples] });
  return {
    bpm: analysis.bpm,
    bpmConfidence: analysis.bpmConfidence,
    beats: analysis.beatTimes.map((time, i) => ({ time: round(time), strength: round(analysis.beatStrengths[i] ?? 0) })),
  };
}

const round = (n) => Math.round(n * 1000) / 1000;
