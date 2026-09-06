/**
 * Installs embedded FFmpeg CLI bits for ffmpeg-expo on Android + iOS.
 *
 * Android: keeps package shared libs (HLS/filters) and adds libexpo_ffmpeg.a
 *          from the embed release (required for expo_ffmpeg_execute).
 * iOS: replaces Frameworks/FFmpeg.xcframework with the embed release that
 *      includes expo_ffmpeg_execute inside libffmpeg.a.
 *
 * Note: patches/ffmpeg-expo must NOT ship these binaries (binary patch hunks
 * without content leave CI without a valid .a). Always install via this script.
 */
import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const CLI_RELEASE_TAG = 'ffmpeg-6.1.1-embed-96ed6ff'
const ABIS = ['arm64-v8a', 'armeabi-v7a', 'x86_64']
const MIN_ARCHIVE_BYTES = 100_000
const REQUIRED_SYMBOL = 'expo_ffmpeg_execute'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageRoot = path.join(root, 'node_modules/ffmpeg-expo')
const jniLibs = path.join(packageRoot, 'android/jniLibs')
const iosFrameworksRoot = path.join(packageRoot, 'ios/Frameworks')
const iosXcframework = path.join(iosFrameworksRoot, 'FFmpeg.xcframework')
const iosCliMarker = path.join(iosXcframework, 'ios-arm64/Headers/expo_ffmpeg.h')
const iosHeaderCopy = path.join(packageRoot, 'ios/expo_ffmpeg.h')

if (process.env.SKIP_FFMPEG_DOWNLOAD === '1') {
  console.log('[setup-ffmpeg-cli] Skipping download (SKIP_FFMPEG_DOWNLOAD=1)')
  assertAndroidCliOrThrow('skip-download mode still requires valid libexpo_ffmpeg.a')
  process.exit(0)
}

if (!fs.existsSync(packageRoot)) {
  console.warn('[setup-ffmpeg-cli] ffmpeg-expo not installed — skip')
  process.exit(0)
}

await setupAndroid()
await setupIos()
assertAndroidCliOrThrow('Android CLI install incomplete')
console.log('[setup-ffmpeg-cli] Done')

function androidCliPath(abi) {
  return path.join(jniLibs, abi, 'libexpo_ffmpeg.a')
}

function isValidAndroidCli(filePath) {
  if (!fs.existsSync(filePath)) return false
  const stat = fs.statSync(filePath)
  if (stat.size < MIN_ARCHIVE_BYTES) return false
  const fd = fs.openSync(filePath, 'r')
  try {
    const magic = Buffer.alloc(8)
    fs.readSync(fd, magic, 0, 8, 0)
    if (magic.toString('latin1') !== '!<arch>\n') return false
  } finally {
    fs.closeSync(fd)
  }
  // Symbol name is enough to reject empty/stub archives from broken patches.
  const bytes = fs.readFileSync(filePath)
  return bytes.includes(Buffer.from(REQUIRED_SYMBOL))
}

function assertAndroidCliOrThrow(context) {
  const bad = ABIS.filter((abi) => !isValidAndroidCli(androidCliPath(abi)))
  if (bad.length === 0) return
  throw new Error(
    `[setup-ffmpeg-cli] ${context}: invalid/missing libexpo_ffmpeg.a for ${bad.join(', ')}. ` +
      `Expected a real static archive exporting ${REQUIRED_SYMBOL}. Re-run without SKIP_FFMPEG_DOWNLOAD.`,
  )
}

async function setupAndroid() {
  if (!fs.existsSync(path.join(jniLibs, 'arm64-v8a', 'libavcodec.so'))) {
    throw new Error(
      '[setup-ffmpeg-cli] Android jniLibs missing — run ffmpeg-expo postinstall first',
    )
  }

  if (ABIS.every((abi) => isValidAndroidCli(androidCliPath(abi)))) {
    console.log('[setup-ffmpeg-cli] Android libexpo_ffmpeg.a already valid')
    return
  }

  console.log('[setup-ffmpeg-cli] Installing Android libexpo_ffmpeg.a from embed release…')
  const tmp = fs.mkdtempSync(path.join(process.env.TEMP ?? '/tmp', 'ffmpeg-cli-android-'))
  try {
    const archive = path.join(tmp, 'ffmpeg-android.tar.gz')
    const url = `https://github.com/kingjnr4/ffmpeg-expo/releases/download/${CLI_RELEASE_TAG}/ffmpeg-android.tar.gz`
    await download(url, archive)
    execSync(`tar -xzf "${archive}" -C "${tmp}"`, { stdio: 'pipe' })

    for (const abi of ABIS) {
      const src = path.join(tmp, abi, 'libexpo_ffmpeg.a')
      const dest = androidCliPath(abi)
      if (!fs.existsSync(src)) {
        throw new Error(`[setup-ffmpeg-cli] missing ${abi}/libexpo_ffmpeg.a in embed archive`)
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.copyFileSync(src, dest)
      if (!isValidAndroidCli(dest)) {
        throw new Error(`[setup-ffmpeg-cli] installed ${abi}/libexpo_ffmpeg.a failed validation`)
      }
      console.log(`[setup-ffmpeg-cli] installed ${abi}/libexpo_ffmpeg.a (${fs.statSync(dest).size} bytes)`)
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

async function setupIos() {
  // xcframework is only useful for local iOS builds; GNU tar on Linux also
  // cannot extract .zip (macOS tar can), which broke ubuntu CI postinstall.
  if (process.platform !== 'darwin') {
    console.log('[setup-ffmpeg-cli] Skipping iOS embed (non-macOS)')
    return
  }

  if (fs.existsSync(iosCliMarker) && fs.existsSync(iosHeaderCopy)) {
    console.log('[setup-ffmpeg-cli] iOS embed FFmpeg.xcframework already present')
    return
  }

  const tmp = fs.mkdtempSync(path.join(process.env.TEMP ?? '/tmp', 'ffmpeg-cli-ios-'))
  try {
    const archive = path.join(tmp, 'ffmpeg-ios.zip')
    const url = `https://github.com/kingjnr4/ffmpeg-expo/releases/download/${CLI_RELEASE_TAG}/ffmpeg-ios.zip`
    console.log('[setup-ffmpeg-cli] downloading iOS embed FFmpeg.xcframework…')
    await download(url, archive)
    const extractDir = path.join(tmp, 'extract')
    fs.mkdirSync(extractDir, { recursive: true })
    execSync(`unzip -qo "${archive}" -d "${extractDir}"`, { stdio: 'pipe' })

    const src =
      findFile(extractDir, 'FFmpeg.xcframework') ??
      (fs.existsSync(path.join(extractDir, 'FFmpeg.xcframework'))
        ? path.join(extractDir, 'FFmpeg.xcframework')
        : null)
    if (!src) {
      throw new Error('[setup-ffmpeg-cli] FFmpeg.xcframework missing from iOS archive')
    }

    fs.mkdirSync(iosFrameworksRoot, { recursive: true })
    fs.rmSync(iosXcframework, { recursive: true, force: true })
    copyDir(src, iosXcframework)

    const headerSrc = path.join(iosXcframework, 'ios-arm64/Headers/expo_ffmpeg.h')
    if (fs.existsSync(headerSrc)) {
      fs.copyFileSync(headerSrc, iosHeaderCopy)
    }

    if (!fs.existsSync(iosCliMarker)) {
      throw new Error('[setup-ffmpeg-cli] iOS embed install incomplete (expo_ffmpeg.h missing)')
    }
    console.log('[setup-ffmpeg-cli] installed iOS embed FFmpeg.xcframework')
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

function findFile(dir, name) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.name === name) return full
    if (entry.isDirectory()) {
      const nested = findFile(full, name)
      if (nested) return nested
    }
  }
  return null
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(from, to)
    } else {
      fs.copyFileSync(from, to)
    }
  }
}

function download(fileUrl, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    const request = (current) => {
      https
        .get(current, (response) => {
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            request(response.headers.location)
            return
          }
          if (response.statusCode !== 200) {
            reject(new Error(`Failed to download CLI archive: ${response.statusCode}`))
            return
          }
          response.pipe(file)
          file.on('finish', () => {
            file.close()
            resolve()
          })
        })
        .on('error', (err) => {
          fs.unlink(dest, () => {})
          reject(err)
        })
    }
    request(fileUrl)
  })
}
