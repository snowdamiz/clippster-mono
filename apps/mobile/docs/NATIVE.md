# Native modules (Phase 0)

## FFmpeg (`ffmpeg-expo`)

Phase 0 only verifies native FFmpeg is linked. Settings → **FFmpeg (dev build)** calls `getVersion()`.

- **Expo Go:** not supported — shows `Unavailable (requires dev build)`
- **Dev client:** rebuild after changing `ffmpeg-expo` or `app.config.ts` plugins

```bash
cd apps/mobile
eas build --profile development --platform ios
eas build --profile development --platform android
```

### LGPL note

`ffmpeg-expo` ships LGPL-compliant builds without GPL codecs (see plugin `enableEncoders` / `enableDecoders` in `app.config.ts`). Product distribution must comply with FFmpeg LGPL obligations (provide license notice, allow library relinking).

## SQLite (`expo-sqlite`)

Local DB file: `clippster_mobile.db`. Migrations live in `@clippster/sqlite-schema`.

## Secure storage

JWT and user JSON use `expo-secure-store` (Keychain / EncryptedSharedPreferences).
