# Native modules

## Editor engine (`@clippster/editor-native`)

Clean-room native preview + hardware export for Editor V2.

- Shared C++ scene graph / `GraphEvaluator` in `packages/clippster-editor-native/cpp`
- Android: **sticky** MediaCodec → Surface preview (one decoder session per source; seek/flush on scrub, advance-only during play)
- iOS: **sticky** AVAssetReader → AVSampleBufferDisplayLayer (reuse reader; recreate on seek)
- JS bridge: `apps/mobile/src/editor/engine/NativeMobileEditorEngine.ts`
- Provenance: `packages/clippster-editor-native/provenance/NOTICE.md`

Heavy sources get an FFmpeg preview proxy via `prepareEditorProxy` + `decideEditorProxy`. Preview prefers `asset.proxy.uri`; export still uses `sourceUri`.

Metro alone does **not** link native code. After changing the package:

```bash
yarn mobile:android
yarn mobile:ios
# or
MOBILE_REBUILD_ANDROID=1 yarn mobile
```

### Playback decode gate

`apps/mobile/src/lib/mediaDecodeGate.ts` pauses filmstrip/clip thumbnail decode while a user-facing player is active (`beginPlaybackCritical`).

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
