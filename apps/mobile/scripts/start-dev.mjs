import net from 'net';
import fs from 'fs';
import { execSync, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');

/** Pin Metro to one port so the dev client does not keep a stale bundler URL. Override with METRO_PORT. */
const DEFAULT_METRO_PORT = Number(process.env.METRO_PORT) || 8082;
const METRO_PORTS = [DEFAULT_METRO_PORT, 8083, 8084, 8085];

/** Android emulator loopback to the host machine (LAN IPs are unreliable from the AVD). */
const ANDROID_EMULATOR_HOST = '10.0.2.2';

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

async function waitForPort(port, timeoutMs = 120_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isPortInUse(port)) return true;
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  return false;
}

async function findMetroPort() {
  if (!(await isPortInUse(DEFAULT_METRO_PORT))) {
    return DEFAULT_METRO_PORT;
  }

  for (const port of METRO_PORTS) {
    if (port === DEFAULT_METRO_PORT) continue;
    if (!(await isPortInUse(port))) {
      console.warn(
        `Port ${DEFAULT_METRO_PORT} is busy — using ${port}. Reload the dev client if it still points at ${DEFAULT_METRO_PORT}.`,
      );
      return port;
    }
  }

  return null;
}

function isEmulatorSerial(serial) {
  return /^emulator-\d+$/i.test(serial);
}

function launchAndroidDevClient(port, host) {
  const bundlerUrl = `http://${host}:${port}`;
  const deepLink = `exp+clippster://expo-development-client/?url=${encodeURIComponent(bundlerUrl)}`;
  try {
    execSync(`adb shell am start -a android.intent.action.VIEW -d "${deepLink}"`, {
      stdio: 'ignore',
    });
    console.log(`Opened dev client → ${bundlerUrl}`);
  } catch {
    console.warn(
      `Could not open dev client (${bundlerUrl}). Open Clippster on the device and set the bundler URL manually.`,
    );
  }
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

function setupAndroidPortReverse(port, reason) {
  try {
    execSync(`adb reverse tcp:${port} tcp:${port}`, { stdio: 'ignore' });
    console.log(`adb reverse tcp:${port} tcp:${port} (${reason})`);
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
    `No free Metro port found (${METRO_PORTS.join(', ')}). Stop stale Expo/Metro processes and retry.`,
  );
}

const androidDevices = listAndroidDevices();
const launchAndroid = androidDevices.length > 0;
const hasEmulator = androidDevices.some(isEmulatorSerial);
/** Emulator must use 10.0.2.2; Expo's default LAN IP is unreachable from the AVD. */
const emulatorBundlerHost = hasEmulator ? ANDROID_EMULATOR_HOST : null;

console.log(`Starting Expo dev server on port ${port}`);

if (launchAndroid) {
  setupAndroidPortReverse(getPhoenixDevPort(), 'emulator localhost → host Phoenix for Google OAuth');
  setupAndroidPortReverse(port, 'emulator localhost → host Metro');
  console.log(`Android device detected (${androidDevices[0]}) — launching app`);
} else {
  console.log('No Android device detected — Metro only (start an emulator or run yarn mobile:android)');
}

const willRebuildAndroid = launchAndroid && (rebuildAndroid || !isDevClientInstalled());
const expoArgs = ['expo', 'start', '--dev-client', '--clear', '--port', String(port)];

if (willRebuildAndroid) {
  if (rebuildAndroid) {
    console.log('Rebuilding Android dev client (ffmpeg-expo and other native modules)…');
  }
  expoArgs.length = 0;
  expoArgs.push('expo', 'run:android', '--port', String(port));
} else if (launchAndroid && !hasEmulator) {
  // Physical device: Expo's LAN hostname is correct.
  expoArgs.push('--android');
}

const childEnv = { ...process.env };
delete childEnv.CI;
if (emulatorBundlerHost) {
  // Forces Metro + any Expo-opened deep link to advertise the emulator-reachable host.
  childEnv.REACT_NATIVE_PACKAGER_HOSTNAME = emulatorBundlerHost;
}

const child = spawn('yarn', expoArgs, {
  cwd: mobileRoot,
  stdio: 'inherit',
  shell: true,
  env: childEnv,
});

if (launchAndroid && !willRebuildAndroid && hasEmulator) {
  // Do not pass Expo `--android` for emulators — it deep-links the host LAN IP and
  // overwrites a working 10.0.2.2 connection. Wait for Metro, then open ourselves.
  void (async () => {
    const ready = await waitForPort(port);
    if (!ready) {
      console.warn(
        `Metro did not listen on ${port} in time. Open Clippster and set bundler to http://${ANDROID_EMULATOR_HOST}:${port}`,
      );
      return;
    }
    launchAndroidDevClient(port, ANDROID_EMULATOR_HOST);
  })();
}

child.on('exit', code => {
  process.exit(code ?? 1);
});
