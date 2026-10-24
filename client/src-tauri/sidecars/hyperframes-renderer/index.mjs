// Newline-delimited JSON protocol over stdin/stdout.
// Request:  { id, op, ...params }   (op "cancel" takes { target })
// Response: { id, type: "progress" | "result" | "error", ... }
import readline from 'node:readline';

const protocolWrite = process.stdout.write.bind(process.stdout);
// Libraries (producer, puppeteer) log to stdout; keep stdout exclusively for protocol messages.
process.stdout.write = process.stderr.write.bind(process.stderr);
console.log = console.info = console.debug = console.error;

const { beats } = await import('./lib/beats.mjs');
const cli = await import('./lib/cli.mjs');
const { render } = await import('./lib/render.mjs');
const server = await import('./lib/server.mjs');
const workspace = await import('./lib/workspace.mjs');

const send = (message) => protocolWrite(`${JSON.stringify(message)}\n`);

const handlers = {
  initWorkspace: (p) => workspace.initWorkspace(p),
  linkMedia: (p) => workspace.linkMedia(p),
  writeFile: (p) => workspace.writeFile(p),
  readFile: (p) => workspace.readFile(p),
  deleteFile: (p) => workspace.deleteFile(p),
  listFiles: (p) => workspace.listFiles(p),
  serve: (p) => server.serve(p),
  unserve: (p) => server.unserve(p),
  ensureBrowser: (_p, ctx) => cli.ensureBrowser(ctx),
  lint: (p, ctx) => cli.lint(p, ctx),
  check: (p, ctx) => cli.check(p, ctx),
  timeline: (p, ctx) => cli.timeline(p, ctx),
  snapshot: (p, ctx) => cli.snapshot(p, ctx),
  beats: (p, ctx) => beats(p, ctx),
  render: (p, ctx) => render(p, ctx),
};

const running = new Map();
const pending = new Set();
let stdinClosed = false;

function track(promise) {
  pending.add(promise);
  promise.finally(() => {
    pending.delete(promise);
    if (stdinClosed && pending.size === 0) process.exit(0);
  });
}

async function handle({ id, op, ...params }) {
  if (op === 'cancel') {
    running.get(params.target)?.abort();
    return send({ id, type: 'result', data: { cancelled: params.target } });
  }
  const handler = handlers[op];
  if (!handler) return send({ id, type: 'error', error: `Unknown op: ${op}` });

  const controller = new AbortController();
  running.set(id, controller);
  const ctx = {
    signal: controller.signal,
    onProgress: (progress, stage, message) => send({ id, type: 'progress', progress, stage, message }),
  };
  try {
    send({ id, type: 'result', data: await handler(params, ctx) });
  } catch (error) {
    const cancelled = controller.signal.aborted;
    send({ id, type: 'error', error: cancelled ? 'Cancelled' : error?.message || String(error), cancelled });
  } finally {
    running.delete(id);
  }
}

readline.createInterface({ input: process.stdin }).on('line', (line) => {
  if (!line.trim()) return;
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    return send({ id: null, type: 'error', error: 'Malformed request' });
  }
  track(handle(request));
});

process.stdin.on('end', () => {
  stdinClosed = true;
  if (pending.size === 0) process.exit(0);
});
send({ id: null, type: 'ready' });
