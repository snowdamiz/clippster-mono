import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const CLI_ENTRY = path.join(path.dirname(require.resolve('hyperframes/package.json')), 'bin', 'hyperframes.mjs');

/** Run the Hyperframes CLI with the bundled Node binary; resolves with stdout/stderr and exit code. */
export function runCli(args, { cwd, signal } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_ENTRY, ...args], {
      cwd,
      env: process.env,
      signal,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

/** Run a `--json` CLI command and parse its report. Non-zero exits still carry a report (e.g. failed checks). */
async function runJson(args, options) {
  const { code, stdout, stderr } = await runCli([...args, '--json'], options);
  const start = stdout.indexOf('{');
  if (start < 0) throw new Error((stderr || stdout).trim() || `hyperframes ${args[0]} exited with ${code}`);
  return JSON.parse(stdout.slice(start));
}

export async function ensureBrowser({ signal } = {}) {
  const ensure = await runCli(['browser', 'ensure'], { signal });
  if (ensure.code !== 0) throw new Error(ensure.stderr.trim() || 'Could not download the rendering browser');
  const located = await runCli(['browser', 'path'], { signal });
  return { path: located.stdout.trim().split(/\r?\n/).pop() };
}

export function lint({ projectDir }, { signal } = {}) {
  return runJson(['lint', projectDir], { signal });
}

export function check({ projectDir, samples = 9 }, { signal } = {}) {
  return runJson(['check', projectDir, '--samples', String(samples)], { signal });
}

export function timeline({ projectDir }, { signal } = {}) {
  return runJson(['timeline', projectDir], { signal });
}

/**
 * Capture stills at exact times. With `against`, Hyperframes also saves the reference frame at
 * each time plus a side-by-side sheet. Vision description is always off: the director model judges.
 */
export async function snapshot({ projectDir, times, outDir, against }, { signal } = {}) {
  await fs.rm(outDir, { recursive: true, force: true });
  const args = ['snapshot', projectDir, '--at', times.map((t) => t.toFixed(3)).join(','), '--no-end', '--describe', 'false', '-o', outDir];
  if (against) args.push('--against', against);
  const { code, stderr } = await runCli(args, { signal });
  if (code !== 0) throw new Error(stderr.trim() || 'Snapshot failed');
  const files = (await fs.readdir(outDir)).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();
  return { outDir, files: files.map((f) => path.join(outDir, f)) };
}
