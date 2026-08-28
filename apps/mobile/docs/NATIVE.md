# Native modules (Phase 0)

## FFmpeg (`ffmpeg-expo`)

Desktop Clippster runs FFmpeg as a **Tauri sidecar** (a separate `ffmpeg` binary next to the app). Mobile cannot use that pattern — iOS/Android do not allow shipping and spawning arbitrary binaries the way desktop does.

Mobile uses **`ffmpeg-expo`**: FFmpeg is compiled into the app as a native Expo module (same role as the desktop sidecar, different packaging).

Settings → **FFmpeg (dev build)** calls `getVersion()`. If it says `Unavailable (requires dev build)`, the installed app was built before `ffmpeg-expo` was linked.

### Rebuild after adding or changing native modules

Metro/`expo start` only reloads JavaScript. It does **not** rebuild native code. After adding `ffmpeg-expo`, changing `patches/ffmpeg-expo+0.0.2.patch`, or editing `app.config.ts` plugins, rebuild **both** platforms you use:

```bash
# From repo root
yarn mobile:android
yarn mobile:ios

# Force Android rebuild when starting Metro
MOBILE_REBUILD_ANDROID=1 yarn mobile
# or: yarn workspace mobile dev --rebuild-android

# From apps/mobile
yarn android
yarn ios
```

EAS development builds:

```bash
cd apps/mobile
eas build --profile development --platform android
eas build --profile development --platform ios
```

- **Expo Go:** not supported — no native FFmpeg
- **Dev client:** must be rebuilt when native dependencies / patches change

### LGPL note

`ffmpeg-expo` ships LGPL-compliant builds without GPL codecs (see plugin `enableEncoders` / `enableDecoders` in `app.config.ts`). Product distribution must comply with FFmpeg LGPL obligations (provide license notice, allow library relinking).

### Full CLI (Android + iOS)

Both platforms call the embedded FFmpeg CLI (`expo_ffmpeg_execute`), so full argument lists work: `-filter_complex`, multi-input maps, AAC encode, JPEG frame extract, and stream-copy remux.

| Platform | Shared / framework libs | CLI entry |
|----------|-------------------------|-----------|
| Android | Package `binaryReleaseTag` `.so` (HLS + filters) + `libexpo_ffmpeg.a` from embed release | `ffmpeg_session.cpp` → `expo_ffmpeg_execute` |
| iOS | Embed-release `FFmpeg.xcframework` (CLI baked into `libffmpeg.a`) | `FFmpegBridge.swift` → `expo_ffmpeg_execute` |

`scripts/setup-ffmpeg-cli.mjs` runs on `postinstall` (after `ffmpeg-expo`’s own postinstall) and installs those CLI bits. Skip with `SKIP_FFMPEG_DOWNLOAD=1`.

Desktop export plans use `libx264`. Mobile rewrites that in `apps/mobile/src/lib/ffmpegArgs.ts`:

- Android → `h264_mediacodec` (fallback `mpeg4`)
- iOS → `h264_videotoolbox` (fallback `mpeg4`)

If burned-in ASS captions fail (no libass), `runFfmpeg` retries without the `ass=` filter.

When regenerating `patches/ffmpeg-expo+0.0.2.patch`, exclude downloaded artifacts (`android/include`, `android/jniLibs/**/libexpo_ffmpeg.a`, `ios/Frameworks`, `.cxx`) so the patch stays source-only (~35KB).

After changing the patch or CLI setup, rebuild the Android **and** iOS dev clients. Metro reload is not enough.

## SQLite (`expo-sqlite`)

Local DB file: `clippster_mobile.db`. Migrations live in `@clippster/sqlite-schema`.

## Secure storage

JWT and user JSON use `expo-secure-store` (Keychain / EncryptedSharedPreferences).
