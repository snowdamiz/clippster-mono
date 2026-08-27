import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildTimelineExportPlan } from './buildTimelineExport';

function hasBin(name: string): boolean {
  try {
    execFileSync(name, ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function probeDuration(path: string): number {
  const output = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
    { encoding: 'utf8' },
  );
  return Number(output.trim());
}

function writeColorClip(path: string, color: string) {
  execFileSync(
    'ffmpeg',
    [
      '-f',
      'lavfi',
      '-i',
      `color=c=${color}:s=320x180:d=2`,
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:sample_rate=44100:duration=2',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-shortest',
      '-y',
      path,
    ],
    { stdio: 'ignore' },
  );
}

describe.skipIf(!hasBin('ffmpeg') || !hasBin('ffprobe'))('timeline export ffmpeg', () => {
  it('writes a dissolve whose duration matches the preview timeline', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tl-export-'));
    const a = join(dir, 'a.mp4');
    const b = join(dir, 'b.mp4');
    const outputPath = join(dir, 'out.mp4');
    const workDir = join(dir, 'work');
    mkdirSync(workDir);
    writeColorClip(a, 'red');
    writeColorClip(b, 'blue');

    const plan = buildTimelineExportPlan({
      videos: [
        { path: a, sourceStart: 0, sourceEnd: 2, speed: 1, muted: false },
        { path: b, sourceStart: 0, sourceEnd: 2, speed: 1, muted: false, transitionIn: 'dissolve' },
      ],
      images: [],
      audio: [],
      outputPath,
      workDir,
      targetRatio: '16:9',
    });

    for (const clip of plan.clipRenders) {
      execFileSync('ffmpeg', clip.args, { stdio: 'ignore' });
    }
    execFileSync('ffmpeg', plan.concat.args, { stdio: 'ignore' });
    execFileSync('ffmpeg', plan.compose.args, { stdio: 'ignore' });

    expect(existsSync(outputPath)).toBe(true);
    const duration = probeDuration(outputPath);
    expect(duration).toBeGreaterThan(3.2);
    expect(duration).toBeLessThan(3.8);
  });
});
