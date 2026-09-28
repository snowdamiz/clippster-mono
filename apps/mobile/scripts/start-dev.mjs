import net from 'net';
import fs from 'fs';
import { execFileSync, execSync, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');

/** Pin Metro to one port so the dev client does not keep a stale bundler URL. Override with METRO_PORT. */
const DEFAULT_METRO_PORT = Number(process.env.METRO_PORT) || 8082;
const METRO_PORTS = [DEFAULT_METRO_PORT, 8083, 8084, 8085];

/** Android emulator loopback to the host machine (LAN IPs are unreliable from the AVD). */
const ANDROID_EMULATOR_HOST = '10.0.2.2';

function resolveAdb() {
  const candidates = [
    process.env.ADB_EXECUTABLE,
    process.env.ANDROID_HOME && path.join(process.env.ANDROID_HOME, 'platform-tools', 'adb.exe'),
    process.env.ANDROID_SDK_ROOT && path.join(process.env.ANDROID_SDK_ROOT, 'platform-tools', 'adb.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
    'adb',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate === 'adb' || fs.existsSync(candidate)) return candidate;
  }
  return null;
}

const adb = resolveAdb();

if (adb && adb !== 'adb') {
  const adbDir = path.dirname(adb);
  process.env.PATH = `${adbDir}${path.delimiter}${process.env.PATH ?? ''}`;
}

function runAdb(args, options = {}) {
  if (!adb) throw new Error('Android Debug Bridge (adb) was not found');
  return execFileSync(adb, args, options);
}

function resolveEmulator() {
  const sdkRoots = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk')].filter(Boolean);
  for (const root of sdkRoots) {
    const candidate = path.join(root, 'emulator', process.platform === 'win32' ? 'emulator.exe' : 'emulator');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function listAndroidAvds(emulator) {
  try {
    return execFileSync(emulator, ['-list-avds'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

async function startAndroidEmulatorIfNeeded() {
  if (!adb) return;
  try {
    runAdb(['start-server'], { stdio: 'ignore' });
  } catch {
    // The first adb invocation can fail while the daemon is starting.
  }
  if (listAndroidDevices().length > 0) return;
  const emulator = resolveEmulator();
  if (!emulator) return;
  const avds = listAndroidAvds(emulator);
  const avd = process.env.MOBILE_ANDROID_AVD || avds[0];
  if (!avd) return;

  console.log(`No Android device detected — starting emulator ${avd}`);
  const child = spawn(emulator, ['-avd', avd], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();

  const startedAt = Date.now();
  let restartedAdb = false;
  while (Date.now() - startedAt < 180_000) {
    if (listAndroidDevices().length > 0) return;
    if (!restartedAdb && Date.now() - startedAt > 15_000) {
      try {
        runAdb(['kill-server'], { stdio: 'ignore' });
        runAdb(['start-server'], { stdio: 'ignore' });
      } catch {
        // Continue polling; the emulator may still be reconnecting.
      }
      restartedAdb = true;
    }
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  console.warn('Android emulator did not become available to adb within 180 seconds. Metro will continue running.');
}

async function waitForAndroidBoot() {
  if (!adb) return;
  const startedAt = Date.now();
  while (Date.now() - startedAt < 180_000) {
    try {
      if (listAndroidDevices().length === 0) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        continue;
      }
      const booted = runAdb(['shell', 'getprop', 'sys.boot_completed'], { encoding: 'utf8' }).trim();
      if (booted === '1') return;
    } catch {
      // ADB may report the emulator before Android services are ready.
    }
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  console.warn('Android emulator connected but did not report boot completion within 180 seconds.');
}

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
    if (await isMetroReady(port)) return true;
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  return false;
}

async function isMetroReady(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/status`, { signal: AbortSignal.timeout(1000) });
    if (!response.ok) return false;
    const body = await response.text();
    return body.includes('packager-status:running');
  } catch {
    return false;
  }
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
    runAdb(['shell', 'am', 'force-stop', 'app.clippster.mobile'], { stdio: 'ignore' });
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
    const output = runAdb(['devices'], {
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
    const output = runAdb(['shell', 'pm', 'list', 'packages', 'app.clippster.mobile'], {
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
    runAdb(['reverse', `tcp:${port}`, `tcp:${port}`], { stdio: 'ignore' });
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

await startAndroidEmulatorIfNeeded();
await waitForAndroidBoot();
const androidDevices = listAndroidDevices();
const launchAndroid = androidDevices.length > 0;
const hasEmulator = androidDevices.some(isEmulatorSerial);
/** Emulator must use 10.0.2.2; Expo's default LAN IP is unreachable from the AVD. */
const emulatorBundlerHost = hasEmulator ? ANDROID_EMULATOR_HOST : null;

console.log(`Starting Expo dev server on port ${port}`);

if (!adb) {
  console.warn(
    'Android SDK platform-tools (adb) was not found. Metro will run without opening an emulator. Set ANDROID_HOME or ADB_EXECUTABLE to your Android SDK.',
  );
}

if (launchAndroid) {
  setupAndroidPortReverse(getPhoenixDevPort(), 'emulator localhost → host Phoenix for Google OAuth');
  setupAndroidPortReverse(port, 'emulator localhost → host Metro');
  console.log(`Android device detected (${androidDevices[0]}) — launching app`);
} else {
  console.log('No Android device detected — Metro only (start an emulator or run yarn mobile:android)');
}

const willRebuildAndroid = launchAndroid && (rebuildAndroid || !isDevClientInstalled());

const childEnv = { ...process.env };
delete childEnv.CI;
if (emulatorBundlerHost) {
  // Forces Metro + any Expo-opened deep link to advertise the emulator-reachable host.
  childEnv.REACT_NATIVE_PACKAGER_HOSTNAME = emulatorBundlerHost;
}

function startMetro() {
  const expoArgs = ['expo', 'start', '--dev-client', '--clear', '--port', String(port)];
  if (launchAndroid && !hasEmulator) expoArgs.push('--android');
  return spawn('yarn', expoArgs, {
    cwd: mobileRoot,
    stdio: 'inherit',
    shell: true,
    env: childEnv,
  });
}

let child;
if (willRebuildAndroid) {
  console.log('Building and installing the Android dev client before starting Metro…');
  const build = spawn('yarn', ['expo', 'run:android', '--no-bundler'], {
    cwd: mobileRoot,
    stdio: 'inherit',
    shell: true,
    env: childEnv,
  });
  build.once('exit', code => {
    if (code !== 0) process.exit(code ?? 1);
    child = startMetro();
    child.on('exit', childCode => process.exit(childCode ?? 1));
  });
} else {
  child = startMetro();
}

if (launchAndroid && hasEmulator) {
  // Do not pass Expo `--android` for emulators — it deep-links the host LAN IP and
  // overwrites a working 10.0.2.2 connection. Wait for Metro, then open ourselves.
  void (async () => {
    const ready = await waitForPort(port, 300_000);
    if (!ready) {
      console.warn(
        `Metro did not listen on ${port} in time. Open Clippster and set bundler to http://${ANDROID_EMULATOR_HOST}:${port}`,
      );
      return;
    }
    launchAndroidDevClient(port, ANDROID_EMULATOR_HOST);
  })();
}

