/**
 * Installs embedded FFmpeg CLI bits for ffmpeg-expo on Android + iOS.
 *
 * Android: keeps package shared libs (HLS/filters) and adds libexpo_ffmpeg.a
 *          from the embed release.
 * iOS: replaces Frameworks/FFmpeg.xcframework with the embed release that
 *      includes expo_ffmpeg_execute inside libffmpeg.a.
 */
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CLI_RELEASE_TAG = 'ffmpeg-6.1.1-embed-96ed6ff';
const ABIS = ['arm64-v8a', 'armeabi-v7a', 'x86_64'];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = path.join(root, 'node_modules/ffmpeg-expo');
const jniLibs = path.join(packageRoot, 'android/jniLibs');
const iosFrameworksRoot = path.join(packageRoot, 'ios/Frameworks');
const iosXcframework = path.join(iosFrameworksRoot, 'FFmpeg.xcframework');
const iosCliMarker = path.join(iosXcframework, 'ios-arm64/Headers/expo_ffmpeg.h');
const iosHeaderCopy = path.join(packageRoot, 'ios/expo_ffmpeg.h');

if (process.env.SKIP_FFMPEG_DOWNLOAD === '1') {
  console.log('[setup-ffmpeg-cli] Skipping (SKIP_FFMPEG_DOWNLOAD=1)');
  process.exit(0);
}

if (!fs.existsSync(packageRoot)) {
  console.warn('[setup-ffmpeg-cli] ffmpeg-expo not installed — skip');
  process.exit(0);
}

await setupAndroid();
await setupIos();
console.log('[setup-ffmpeg-cli] Done');

async function setupAndroid() {
  if (!fs.existsSync(path.join(jniLibs, 'arm64-v8a', 'libavcodec.so'))) {
    console.warn('[setup-ffmpeg-cli] Android jniLibs missing — run ffmpeg-expo postinstall first');
    return;
  }

  if (ABIS.every((abi) => fs.existsSync(path.join(jniLibs, abi, 'libexpo_ffmpeg.a')))) {
    console.log('[setup-ffmpeg-cli] Android libexpo_ffmpeg.a already present');
    return;
  }

  const tmp = fs.mkdtempSync(path.join(process.env.TEMP ?? '/tmp', 'ffmpeg-cli-android-'));
  try {
    const archive = path.join(tmp, 'ffmpeg-android.tar.gz');
    const url = `https://github.com/kingjnr4/ffmpeg-expo/releases/download/${CLI_RELEASE_TAG}/ffmpeg-android.tar.gz`;
    await download(url, archive);
    execSync(`tar -xzf "${archive}" -C "${tmp}"`, { stdio: 'pipe' });

    for (const abi of ABIS) {
      const src = path.join(tmp, abi, 'libexpo_ffmpeg.a');
      const destDir = path.join(jniLibs, abi);
      const dest = path.join(destDir, 'libexpo_ffmpeg.a');
      if (!fs.existsSync(src)) {
        console.warn(`[setup-ffmpeg-cli] missing ${abi}/libexpo_ffmpeg.a in archive`);
        continue;
      }
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(src, dest);
      console.log(`[setup-ffmpeg-cli] installed ${abi}/libexpo_ffmpeg.a`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function setupIos() {
  // xcframework is only useful for local iOS builds; GNU tar on Linux also
  // cannot extract .zip (macOS tar can), which broke ubuntu CI postinstall.
  if (process.platform !== 'darwin') {
    console.log('[setup-ffmpeg-cli] Skipping iOS embed (non-macOS)');
    return;
  }

  if (fs.existsSync(iosCliMarker) && fs.existsSync(iosHeaderCopy)) {
    console.log('[setup-ffmpeg-cli] iOS embed FFmpeg.xcframework already present');
    return;
  }

  const tmp = fs.mkdtempSync(path.join(process.env.TEMP ?? '/tmp', 'ffmpeg-cli-ios-'));
  try {
    const archive = path.join(tmp, 'ffmpeg-ios.zip');
    const url = `https://github.com/kingjnr4/ffmpeg-expo/releases/download/${CLI_RELEASE_TAG}/ffmpeg-ios.zip`;
    console.log('[setup-ffmpeg-cli] downloading iOS embed FFmpeg.xcframework…');
    await download(url, archive);
    const extractDir = path.join(tmp, 'extract');
    fs.mkdirSync(extractDir, { recursive: true });
    execSync(`unzip -qo "${archive}" -d "${extractDir}"`, { stdio: 'pipe' });

    const src =
      findFile(extractDir, 'FFmpeg.xcframework') ??
      (fs.existsSync(path.join(extractDir, 'FFmpeg.xcframework'))
        ? path.join(extractDir, 'FFmpeg.xcframework')
        : null);
    if (!src) {
      console.warn('[setup-ffmpeg-cli] FFmpeg.xcframework missing from iOS archive');
      return;
    }

    fs.mkdirSync(iosFrameworksRoot, { recursive: true });
    fs.rmSync(iosXcframework, { recursive: true, force: true });
    copyDir(src, iosXcframework);

    const headerSrc = path.join(iosXcframework, 'ios-arm64/Headers/expo_ffmpeg.h');
    if (fs.existsSync(headerSrc)) {
      fs.copyFileSync(headerSrc, iosHeaderCopy);
    }

    if (!fs.existsSync(iosCliMarker)) {
      console.warn('[setup-ffmpeg-cli] iOS embed install incomplete (expo_ffmpeg.h missing)');
      return;
    }
    console.log('[setup-ffmpeg-cli] installed iOS embed FFmpeg.xcframework');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function findFile(dir, name) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.name === name) return full;
    if (entry.isDirectory()) {
      const nested = findFile(full, name);
      if (nested) return nested;
    }
  }
  return null;
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function download(fileUrl, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const request = (current) => {
      https
        .get(current, (response) => {
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            request(response.headers.location);
            return;
          }
          if (response.statusCode !== 200) {
            reject(new Error(`Failed to download CLI archive: ${response.statusCode}`));
            return;
          }
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        })
        .on('error', (err) => {
          fs.unlink(dest, () => {});
          reject(err);
        });
    };
    request(fileUrl);
  });
}
