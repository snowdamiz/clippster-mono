# Native modules (Phase 0)

## FFmpeg (`ffmpeg-expo`)

Desktop Clippster runs FFmpeg as a **Tauri sidecar** (a separate `ffmpeg` binary next to the app). Mobile cannot use that pattern — iOS/Android do not allow shipping and spawning arbitrary binaries the way desktop does.

Mobile uses **`ffmpeg-expo`**: FFmpeg is compiled into the app as a native Expo module (same role as the desktop sidecar, different packaging).

Settings → **FFmpeg (dev build)** calls `getVersion()`. If it says `Unavailable (requires dev build)`, the installed APK was built before `ffmpeg-expo` was linked.

### Rebuild after adding or changing native modules

Metro/`expo start --android` only reloads JavaScript. It does **not** rebuild native code. After adding `ffmpeg-expo` or editing `app.config.ts` plugins:

```bash
# From repo root (recommended)
yarn mobile:android

# Or force rebuild when starting dev
MOBILE_REBUILD_ANDROID=1 yarn mobile

# Or from apps/mobile
yarn dev --rebuild-android
```

EAS development builds also work:

```bash
cd apps/mobile
eas build --profile development --platform android
```

- **Expo Go:** not supported — no native FFmpeg
- **Dev client:** must be rebuilt when native dependencies change

### LGPL note

`ffmpeg-expo` ships LGPL-compliant builds without GPL codecs (see plugin `enableEncoders` / `enableDecoders` in `app.config.ts`). Product distribution must comply with FFmpeg LGPL obligations (provide license notice, allow library relinking).

## SQLite (`expo-sqlite`)

Local DB file: `clippster_mobile.db`. Migrations live in `@clippster/sqlite-schema`.

## Secure storage

JWT and user JSON use `expo-secure-store` (Keychain / EncryptedSharedPreferences).
