import net from 'net';
import fs from 'fs';
import { execSync, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');

/** First choice matches the port we used interactively when 8081 was taken. */
const METRO_PORTS = [8082, 8083, 8084, 8085];

function killProcessOnPort(port) {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });

      const pids = new Set(
        output
          .split('\n')
          .map(line => line.trim().split(/\s+/).pop())
          .filter(pid => pid && /^\d+$/.test(pid))
      );

      for (const pid of pids) {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
      }
      return;
    }

    const output = execSync(`lsof -ti tcp:${port}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    for (const pid of output.split('\n').filter(Boolean)) {
      execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
    }
  } catch {
    // Port was already free or process could not be stopped.
  }
}

function cleanupStaleMetroPorts() {
  for (const port of METRO_PORTS) {
    killProcessOnPort(port);
  }
}

function isPortInUse(port, host = '127.0.0.1', timeoutMs = 500) {
  return new Promise(resolve => {
    const socket = new net.Socket();
    let settled = false;

    const finish = inUse => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(inUse);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

async function findMetroPort() {
  for (const port of METRO_PORTS) {
    if (!(await isPortInUse(port))) {
      return port;
    }
  }

  return null;
}

function listAndroidDevices() {
  try {
    const output = execSync('adb devices', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    return output
      .split(/\r?\n/)
      .filter(line => /\tdevice\s*$/.test(line))
      .map(line => line.split('\t')[0]);
  } catch {
    return [];
  }
}

function isDevClientInstalled() {
  try {
    const output = execSync('adb shell pm list packages app.clippster.mobile', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return output.includes('app.clippster.mobile');
  } catch {
    return false;
  }
}

function getPhoenixDevPort() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) {
    try {
      return new URL(fromEnv).port || '4000';
    } catch {
      // fall through
    }
  }

  try {
    const envPath = path.join(mobileRoot, '.env.development');
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('EXPO_PUBLIC_API_URL=')) continue;
      const value = trimmed.slice('EXPO_PUBLIC_API_URL='.length).trim();
      return new URL(value).port || '4000';
    }
  } catch {
    // fall through
  }

  return process.env.PORT || '4000';
}

function setupAndroidPortReverse(port) {
  try {
    execSync(`adb reverse tcp:${port} tcp:${port}`, { stdio: 'ignore' });
    console.log(`adb reverse tcp:${port} tcp:${port} (emulator localhost → host Phoenix for Google OAuth)`);
  } catch {
    console.warn(`Could not run adb reverse for port ${port}`);
  }
}

function clearMetroBundlerCache() {
  const targets = [
    path.join(mobileRoot, '.expo', 'metro'),
    path.join(mobileRoot, 'node_modules', '.cache'),
  ];

  for (const target of targets) {
    try {
      fs.rmSync(target, { recursive: true, force: true });
    } catch {
      // Cache dir may not exist yet.
    }
  }
}

const rebuildAndroid =
  process.argv.includes('--rebuild-android') || process.env.MOBILE_REBUILD_ANDROID === '1';

cleanupStaleMetroPorts();
clearMetroBundlerCache();

let port = await findMetroPort();
if (port == null) {
  throw new Error(
    `No free Metro port found (${METRO_PORTS.join(', ')}). Stop stale Expo/Metro processes and retry.`
  );
}

const androidDevices = listAndroidDevices();
const launchAndroid = androidDevices.length > 0;

console.log(`Starting Expo dev server on port ${port}`);

if (launchAndroid) {
  setupAndroidPortReverse(getPhoenixDevPort());
  console.log(`Android device detected (${androidDevices[0]}) — launching app`);
} else {
  console.log('No Android device detected — Metro only (start an emulator or run yarn mobile:android)');
}

const expoArgs = ['expo', 'start', '--dev-client', '--clear', '--port', String(port)];

if (launchAndroid) {
  if (rebuildAndroid || !isDevClientInstalled()) {
    if (rebuildAndroid) {
      console.log('Rebuilding Android dev client (ffmpeg-expo and other native modules)…');
    }
    expoArgs.length = 0;
    expoArgs.push('expo', 'run:android', '--port', String(port));
  } else {
    expoArgs.push('--android');
  }
}

const childEnv = { ...process.env };
delete childEnv.CI;

const child = spawn('yarn', expoArgs, {
  cwd: mobileRoot,
  stdio: 'inherit',
  shell: true,
  env: childEnv,
});

child.on('exit', code => {
  process.exit(code ?? 1);
});
