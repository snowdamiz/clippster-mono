# Native modules

## Editor engine (`@clippster/editor-native`)

Clean-room native preview + hardware export for Editor V2.

- Shared C++ scene graph / `GraphEvaluator` in `packages/clippster-editor-native/cpp`
- Android: MediaCodec decode → Surface preview; MediaCodec + MediaMuxer H.264/AAC export
- iOS: AVFoundation / VideoToolbox / AVAssetWriter
- JS bridge: `apps/mobile/src/editor/engine/NativeMobileEditorEngine.ts`
- Provenance: `packages/clippster-editor-native/provenance/NOTICE.md`

Metro alone does **not** link native code. After changing the package:

```bash
yarn mobile:android
yarn mobile:ios
# or
MOBILE_REBUILD_ANDROID=1 yarn mobile
```

## FFmpeg (`ffmpeg-expo`) — audited utilities only

FFmpeg remains for ingest/probe/HLS/remux compatibility. Editor preview and
final export use `@clippster/editor-native`, not the multi-stage FFmpeg
re-encode plan.

- Production encoder allow-list: **AAC only** (no `libx264` / GPL encoders)
- Mobile still rewrites any accidental `libx264` args to `h264_mediacodec` /
  `h264_videotoolbox` in `apps/mobile/src/lib/ffmpegArgs.ts`
- LGPL obligations still apply for the utility build (license notice + relinking)

Settings → **FFmpeg (dev build)** calls `getVersion()` for the utility module.

### Rebuild after FFmpeg patch changes

```bash
yarn mobile:android
yarn mobile:ios
```

## SQLite (`expo-sqlite`)

Local DB file: `clippster_mobile.db`. Migrations live in `@clippster/sqlite-schema`.

## Secure storage

JWT and user JSON use `expo-secure-store` (Keychain / EncryptedSharedPreferences).
