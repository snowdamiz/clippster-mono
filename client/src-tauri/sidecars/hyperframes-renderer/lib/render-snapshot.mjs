import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveInside } from './workspace.mjs';

/** Own an isolated export project so subsequent editor writes cannot change an in-flight render. */
export async function withRenderSnapshot(projectDir, files, operation) {
  const snapshot = await fs.mkdtemp(path.join(os.tmpdir(), 'clippster-export-'));
  try {
    if (files) {
      // Linked media/font assets are immutable; authored files come from the captured UI version.
      await fs.cp(path.join(projectDir, 'assets'), path.join(snapshot, 'assets'), { recursive: true, dereference: true });
      for (const [relative, content] of Object.entries(files)) {
        const target = resolveInside(snapshot, relative);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, content, 'utf8');
      }
      try { await fs.copyFile(path.join(projectDir, 'hyperframes.json'), path.join(snapshot, 'hyperframes.json')); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    } else {
      await fs.cp(projectDir, snapshot, { recursive: true, dereference: true, filter: source => !['.hyperframes', '.debug'].includes(path.basename(source)) });
    }
    return await operation(snapshot);
  } finally {
    await fs.rm(snapshot, { recursive: true, force: true });
  }
}
