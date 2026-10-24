import fs from 'node:fs/promises';
import path from 'node:path';
import { createRenderJob, executeRenderJob } from '@hyperframes/producer';

const quiet = { info() {}, debug() {}, warn: (m) => console.error(m), error: (m) => console.error(m) };

/** `name.mp4`, or `name (2).mp4` and so on when the file exists, so exports never overwrite. */
async function uniquePath(requested) {
  const { dir, name, ext } = path.parse(requested);
  for (let n = 1; ; n++) {
    const candidate = path.join(dir, n === 1 ? `${name}${ext}` : `${name} (${n})${ext}`);
    try {
      await fs.access(candidate);
    } catch {
      return candidate;
    }
  }
}

/** Render the workspace's index.html to an MP4, reporting progress as 0..1. */
export async function render({ projectDir, outputPath: requested, fps = 30, crf = 20 }, { signal, onProgress }) {
  await fs.mkdir(path.dirname(requested), { recursive: true });
  const outputPath = await uniquePath(requested);
  const job = createRenderJob({ fps, quality: 'high', format: 'mp4', crf, logger: quiet });
  let last = -1;
  await executeRenderJob(
    job,
    projectDir,
    outputPath,
    (current, message) => {
      const progress = Math.max(0, Math.min(1, current.progress / 100));
      if (progress - last >= 0.01 || current.status !== 'rendering') {
        last = progress;
        onProgress(progress, current.status, message);
      }
    },
    signal
  );
  if (job.status !== 'complete') throw new Error(job.error || `Render ${job.status}`);
  const { size } = await fs.stat(outputPath);
  return { outputPath, bytes: size, duration: job.duration ?? null, warnings: job.warnings.map((w) => w.message ?? String(w)) };
}
