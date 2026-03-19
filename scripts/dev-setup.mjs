import { execSync, spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import net from 'net';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...opts });
    return true;
  } catch {
    return false;
  }
}

function runRequired(cmd, opts = {}) {
  if (!run(cmd, opts)) {
    throw new Error(`Command failed: ${cmd}`);
  }
}

function removePackageLock(dir) {
  const lockFile = path.join(dir, 'package-lock.json');
  if (fs.existsSync(lockFile)) {
    fs.unlinkSync(lockFile);
    console.log(`Removed ${path.relative(ROOT, lockFile)}`);
  }
}

function isDockerRunning() {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function isComposePostgresRunning() {
  try {
    const output = execSync(
      'docker compose -f server/docker-compose.yml ps db --format json',
      { cwd: ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }
    );
    if (output.includes('"running"')) return true;
  } catch {}

  // Fallback: check if port 5432 is already in use (handles containers
  // started outside this compose project or native PostgreSQL installs)
  try {
    if (process.platform === 'win32') {
      const output = execSync('netstat -ano | findstr :5432 | findstr LISTENING',
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      return output.trim().length > 0;
    } else {
      execSync('lsof -i :5432 -sTCP:LISTEN', { stdio: 'ignore' });
      return true;
    }
  } catch {}

  return false;
}

function canConnectToPort(host, port, timeoutMs = 1000) {
  return new Promise(resolve => {
    const socket = new net.Socket();
    let settled = false;

    const finish = result => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

async function isHostPostgresReady() {
  return canConnectToPort('localhost', 5432);
}

async function waitForHostPostgres(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isHostPostgresReady()) return true;
    await new Promise(r => setTimeout(r, 1000));
  }

  return false;
}

async function main() {
  console.log('=== Clippster Dev Setup ===\n');

  // 1. Install root + workspace dependencies
  console.log('--- Installing dependencies ---');
  removePackageLock(ROOT);
  runRequired('yarn install');

  // 2. Install non-workspace dependencies
  console.log('\n--- Installing non-workspace dependencies ---');
  removePackageLock(path.join(ROOT, 'client/src-tauri/pumpfun-service'));
  runRequired('yarn install', { cwd: path.join(ROOT, 'client/src-tauri/pumpfun-service') });
  removePackageLock(path.join(ROOT, 'server'));
  runRequired('yarn install', { cwd: path.join(ROOT, 'server') });

  // 3. Install & build remotion-renderer sidecar
  console.log('\n--- Building remotion-renderer sidecar ---');
  const sidecarDir = path.join(ROOT, 'client/src-tauri/sidecars/remotion-renderer');
  const bundlePath = path.join(sidecarDir, 'dist/bundle.js');

  if (!fs.existsSync(bundlePath)) {
    removePackageLock(sidecarDir);
    runRequired('yarn install', { cwd: sidecarDir });
    runRequired('yarn build', { cwd: sidecarDir });
  } else {
    console.log('remotion-renderer bundle already exists, skipping build.');
  }

  // 3. Docker Postgres
  console.log('\n--- Checking PostgreSQL ---');
  const hostPostgresReady = await isHostPostgresReady();

  if (hostPostgresReady) {
    console.log('PostgreSQL is already reachable on localhost:5432.');
  } else if (!isDockerRunning()) {
    console.log('Docker is not running. Starting Docker...');
    if (process.platform === 'darwin') {
      spawnSync('open', ['-a', 'Docker'], { stdio: 'inherit' });
    } else if (process.platform === 'win32') {
      spawnSync('cmd', ['/c', 'start', '', 'Docker Desktop'], { stdio: 'inherit' });
    } else {
      // Linux: try systemd, then snap
      if (!run('sudo systemctl start docker')) {
        run('sudo snap start docker');
      }
    }

    // Wait for Docker daemon to be ready
    const maxWait = 60;
    for (let i = 0; i < maxWait; i++) {
      if (isDockerRunning()) break;
      if (i === 0) process.stdout.write('Waiting for Docker daemon');
      process.stdout.write('.');
      await new Promise(r => setTimeout(r, 2000));
    }
    console.log();

    if (!isDockerRunning()) {
      console.error('Docker did not start in time.');
      process.exit(1);
    }
    console.log('Docker is ready.');
  }

  if (!(await isHostPostgresReady())) {
    if (isComposePostgresRunning()) {
      console.log(
        'PostgreSQL container is running but localhost:5432 is unavailable. Recreating the container to refresh port bindings...'
      );
      runRequired('docker compose -f server/docker-compose.yml up -d --force-recreate db');
    } else {
      console.log('Starting PostgreSQL container...');
      runRequired('docker compose -f server/docker-compose.yml up -d db');
    }

    console.log('Waiting for PostgreSQL to be reachable on localhost:5432...');
    const ready = await waitForHostPostgres();
    if (!ready) {
      throw new Error('PostgreSQL did not become reachable on localhost:5432 in time.');
    }
  }
  console.log('PostgreSQL is ready.');

  // 4. Elixir server setup
  console.log('\n--- Setting up Elixir server ---');
  runRequired('mix deps.get', { cwd: path.join(ROOT, 'server') });
  runRequired('mix ecto.create', { cwd: path.join(ROOT, 'server') });
  runRequired('mix ecto.migrate', { cwd: path.join(ROOT, 'server') });
  console.log('\n=== Setup complete ===\n');
}

main().catch(e => {
  console.error('Setup failed:', e);
  process.exit(1);
});
