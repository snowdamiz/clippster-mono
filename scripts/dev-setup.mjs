import { execSync, spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
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

function isPostgresContainerRunning() {
  // Try docker compose ps (without --status flag which is unreliable on Windows)
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

function isPostgresReady() {
  // Try via docker compose exec first
  try {
    execSync(
      'docker compose -f server/docker-compose.yml exec -T db pg_isready -U postgres',
      { cwd: ROOT, stdio: 'ignore' }
    );
    return true;
  } catch {}

  // Fallback: try connecting directly (handles non-compose postgres)
  try {
    execSync('docker run --rm --network host postgres:15 pg_isready -h localhost -U postgres',
      { stdio: 'ignore' });
    return true;
  } catch {}

  return false;
}

async function waitForPostgres(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    if (isPostgresReady()) return true;
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  console.log('=== Clippster Dev Setup ===\n');

  // 1. Install root + workspace dependencies
  console.log('--- Installing dependencies ---');
  removePackageLock(ROOT);
  run('yarn install');

  // 2. Install non-workspace dependencies
  console.log('\n--- Installing non-workspace dependencies ---');
  removePackageLock(path.join(ROOT, 'client/src-tauri/pumpfun-service'));
  run('yarn install', { cwd: path.join(ROOT, 'client/src-tauri/pumpfun-service') });
  removePackageLock(path.join(ROOT, 'server'));
  run('yarn install', { cwd: path.join(ROOT, 'server') });

  // 3. Install & build remotion-renderer sidecar
  console.log('\n--- Building remotion-renderer sidecar ---');
  const sidecarDir = path.join(ROOT, 'client/src-tauri/sidecars/remotion-renderer');
  const bundlePath = path.join(sidecarDir, 'dist/bundle.js');

  if (!fs.existsSync(bundlePath)) {
    removePackageLock(sidecarDir);
    run('yarn install', { cwd: sidecarDir });
    run('yarn build', { cwd: sidecarDir });
  } else {
    console.log('remotion-renderer bundle already exists, skipping build.');
  }

  // 3. Docker Postgres
  console.log('\n--- Checking PostgreSQL ---');
  if (!isDockerRunning()) {
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

  if (isPostgresContainerRunning()) {
    console.log('PostgreSQL container is already running.');
  } else {
    console.log('Starting PostgreSQL container...');
    run('docker compose -f server/docker-compose.yml up -d');
  }

  console.log('Waiting for PostgreSQL to be ready...');
  const ready = await waitForPostgres();
  if (!ready) {
    console.error('PostgreSQL did not become ready in time.');
    process.exit(1);
  }
  console.log('PostgreSQL is ready.');

  // 4. Elixir server setup
  console.log('\n--- Setting up Elixir server ---');
  run('mix deps.get', { cwd: path.join(ROOT, 'server') });
  run('mix ecto.create', { cwd: path.join(ROOT, 'server') });
  run('mix ecto.migrate', { cwd: path.join(ROOT, 'server') });
  console.log('\n=== Setup complete ===\n');
}

main().catch(e => {
  console.error('Setup failed:', e);
  process.exit(1);
});
