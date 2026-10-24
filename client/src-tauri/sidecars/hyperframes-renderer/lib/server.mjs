import { randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { getHyperframeRuntimeScript } from '@hyperframes/core/runtime-script';
import { resolveInside } from './workspace.mjs';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.aac': 'audio/aac',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const RUNTIME_PATH = '/__hf/runtime.js';
// Agent-written HTML is untrusted: same-server resources only, no outbound network.
const CSP = "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors *";

let server = null;
let port = 0;
let runtime = null;
const roots = new Map();

function startServer() {
  if (server) return Promise.resolve();
  server = http.createServer((req, res) => handle(req, res).catch((e) => fail(res, 500, e.message)));
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      resolve();
    });
  });
}

/** Serve a workspace for the preview player; returns its index URL. Tokens make paths unguessable. */
export async function serve({ projectDir }) {
  await startServer();
  let token = [...roots].find(([, dir]) => dir === projectDir)?.[0];
  if (!token) {
    token = randomBytes(16).toString('hex');
    roots.set(token, projectDir);
  }
  return { url: `http://127.0.0.1:${port}/${token}/index.html`, token };
}

export function unserve({ token }) {
  roots.delete(token);
  return { token };
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === RUNTIME_PATH) {
    runtime ??= getHyperframeRuntimeScript();
    return send(res, 200, MIME_TYPES['.js'], runtime);
  }

  const [, token, ...rest] = url.pathname.split('/');
  const root = roots.get(token);
  if (!root) return fail(res, 404, 'Not found');

  let file;
  try {
    file = resolveInside(root, decodeURIComponent(rest.join('/')));
  } catch {
    return fail(res, 403, 'Forbidden');
  }

  const stat = await fs.stat(file).catch(() => null);
  if (!stat?.isFile()) return fail(res, 404, 'Not found');
  const type = MIME_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';

  if (rest.join('/') === 'index.html') {
    const html = await fs.readFile(file, 'utf8');
    const tag = `<script src="${RUNTIME_PATH}"></script>`;
    return send(res, 200, type, html.includes('</body>') ? html.replace('</body>', `${tag}</body>`) : html + tag);
  }

  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', ...baseHeaders() };
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : stat.size - Number(range[2]);
    const end = range[1] && range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
    if (start > end || start < 0) return fail(res, 416, 'Range not satisfiable');
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
    return createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, 'Content-Length': stat.size });
  createReadStream(file).pipe(res);
}

function baseHeaders() {
  return { 'Content-Security-Policy': CSP, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
}

function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body), ...baseHeaders() });
  res.end(body);
}

function fail(res, status, message) {
  if (res.headersSent) return res.destroy();
  send(res, status, 'text/plain; charset=utf-8', message);
}
