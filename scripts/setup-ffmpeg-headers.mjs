import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const includeDir = path.join(root, 'node_modules/ffmpeg-expo/android/include');
const marker = path.join(includeDir, 'libavcodec/avcodec.h');

if (fs.existsSync(marker)) {
  writeGeneratedHeaders(includeDir);
  process.exit(0);
}

const tmp = fs.mkdtempSync(path.join(process.env.TEMP ?? '/tmp', 'ffmpeg-headers-'));
const archive = path.join(tmp, 'ffmpeg-6.1.1.tar.xz');

fs.mkdirSync(includeDir, { recursive: true });

const downloadCmd =
  process.platform === 'win32'
    ? `curl -fsSL "https://ffmpeg.org/releases/ffmpeg-6.1.1.tar.xz" -o "${archive}"`
    : `curl -fsSL "https://ffmpeg.org/releases/ffmpeg-6.1.1.tar.xz" -o "${archive}"`;

execSync(downloadCmd, { stdio: 'inherit' });

for (const dir of [
  'libavcodec',
  'libavformat',
  'libavutil',
  'libswresample',
  'libswscale',
  'libavfilter',
  'libavdevice',
]) {
  execSync(`tar -xJf "${archive}" -C "${tmp}" "ffmpeg-6.1.1/${dir}"`, { stdio: 'inherit' });
  copyHeadersOnly(path.join(tmp, 'ffmpeg-6.1.1', dir), path.join(includeDir, dir));
}

writeGeneratedHeaders(includeDir);
console.log('[setup-ffmpeg-headers] Installed FFmpeg 6.1.1 headers for ffmpeg-expo');

function copyHeadersOnly(sourceDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyHeadersOnly(sourcePath, destPath);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.h')) {
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

function writeGeneratedHeaders(targetDir) {
  const avconfig = path.join(targetDir, 'libavutil/avconfig.h');
  const ffversion = path.join(targetDir, 'libavutil/ffversion.h');
  fs.mkdirSync(path.dirname(avconfig), { recursive: true });
  fs.writeFileSync(
    avconfig,
    `/* Generated for Android/ffmpeg-expo local builds */
#ifndef AVUTIL_AVCONFIG_H
#define AVUTIL_AVCONFIG_H
#define AV_HAVE_BIGENDIAN 0
#define AV_HAVE_FAST_UNALIGNED 1
#endif
`,
  );
  fs.writeFileSync(
    ffversion,
    `/* Generated for Android/ffmpeg-expo local builds */
#ifndef AVUTIL_FFVERSION_H
#define AVUTIL_FFVERSION_H
#define FFMPEG_VERSION "6.1.1"
#endif
`,
  );
}
