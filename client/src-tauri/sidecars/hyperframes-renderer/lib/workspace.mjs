import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

const WRITABLE_EXTENSIONS = new Set(['.html', '.md', '.json', '.css']);
const MEDIA_DIR = 'assets/media';
const VENDOR_DIR = 'assets/vendor';
const FONTS_DIR = 'assets/fonts';
const FONT_EXTENSIONS = new Set(['.ttf', '.otf', '.woff', '.woff2']);

/** Resolve `relativePath` inside `projectDir`, rejecting anything that escapes it. */
export function resolveInside(projectDir, relativePath) {
  const root = path.resolve(projectDir);
  const target = path.resolve(root, relativePath);
  const rel = path.relative(root, target);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Path escapes the workspace: ${relativePath}`);
  }
  return target;
}

export async function initWorkspace({ projectDir }) {
  await fs.mkdir(path.join(projectDir, 'compositions'), { recursive: true });
  await fs.mkdir(path.join(projectDir, MEDIA_DIR), { recursive: true });
  await fs.mkdir(path.join(projectDir, VENDOR_DIR), { recursive: true });
  await fs.copyFile(require.resolve('gsap/dist/gsap.min.js'), path.join(projectDir, VENDOR_DIR, 'gsap.min.js'));
  await fs.writeFile(
    path.join(projectDir, 'hyperframes.json'),
    JSON.stringify({ paths: { blocks: 'compositions', components: 'compositions/components', assets: 'assets' }, media: { autoProxy: true } }, null, 2)
  );
  return { projectDir, gsapSrc: `${VENDOR_DIR}/gsap.min.js`, fonts: await linkFonts(projectDir) };
}

/**
 * Link the app's bundled fonts into `assets/fonts`. The compiler declares them with `@font-face`
 * in the root `index.html`, so sub-compositions can use the family names directly.
 */
async function linkFonts(projectDir) {
  const fontsDir = process.env.CLIPPSTER_FONTS_DIR;
  if (!fontsDir) return [];
  await fs.mkdir(path.join(projectDir, FONTS_DIR), { recursive: true });
  const fonts = [];
  for (const name of await fs.readdir(fontsDir)) {
    if (!FONT_EXTENSIONS.has(path.extname(name).toLowerCase())) continue;
    const relative = `${FONTS_DIR}/${name}`;
    await linkOrCopy(path.join(fontsDir, name), resolveInside(projectDir, relative));
    fonts.push(relative);
  }
  return fonts.sort();
}

/** Make the user's source files reachable from the composition (Hyperframes only serves the project directory). */
export async function linkMedia({ projectDir, items }) {
  const linked = [];
  for (const { id, path: sourcePath } of items) {
    if (!/^[\w-]+$/.test(id)) throw new Error(`Invalid media id: ${id}`);
    const ext = path.extname(sourcePath).toLowerCase();
    const relative = `${MEDIA_DIR}/${id}${ext}`;
    await linkOrCopy(sourcePath, resolveInside(projectDir, relative));
    linked.push({ id, src: relative });
  }
  return { linked };
}

/** Hard-link (same volume), symlink (non-Windows), or copy as a last resort. Existing targets are kept. */
async function linkOrCopy(sourcePath, target) {
  if (await exists(target)) return;
  try {
    await fs.link(sourcePath, target);
  } catch {
    try {
      if (process.platform === 'win32') throw new Error('symlinks need elevation on Windows');
      await fs.symlink(sourcePath, target);
    } catch {
      await fs.copyFile(sourcePath, target);
    }
  }
}

export async function writeFile({ projectDir, path: relativePath, content }) {
  if (!WRITABLE_EXTENSIONS.has(path.extname(relativePath).toLowerCase())) {
    throw new Error(`Only ${[...WRITABLE_EXTENSIONS].join(', ')} files can be written: ${relativePath}`);
  }
  const target = resolveInside(projectDir, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf8');
  return { path: relativePath, bytes: Buffer.byteLength(content) };
}

export async function readFile({ projectDir, path: relativePath }) {
  return { path: relativePath, content: await fs.readFile(resolveInside(projectDir, relativePath), 'utf8') };
}

export async function deleteFile({ projectDir, path: relativePath }) {
  await fs.rm(resolveInside(projectDir, relativePath), { force: true });
  return { path: relativePath };
}

/** List authored files (compositions, plan, root) — media and vendor assets are omitted. */
export async function listFiles({ projectDir }) {
  const files = [];
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(projectDir, full).split(path.sep).join('/');
      if (entry.name.startsWith('.') || rel === 'assets' || rel === 'renders' || rel === 'snapshots') continue;
      if (entry.isDirectory()) await walk(full);
      else if (WRITABLE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(rel);
    }
  }
  await walk(projectDir);
  return { files: files.sort() };
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
