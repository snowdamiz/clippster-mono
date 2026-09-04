# @clippster/editor-native

Clean-room native Editor V2 engine for Clippster mobile.

## Layout

| Path | Role |
|------|------|
| `cpp/` | Shared scene graph, clock, capabilities, GraphEvaluator, CPU reference renderer |
| `android/` | Expo module, MediaCodec preview, MediaCodec/MediaMuxer export |
| `ios/` | Expo module, AVFoundation preview, VideoToolbox/AVAssetWriter export |
| `src/` | JS bridge + native preview view |

## Integration

1. Depend on `@clippster/editor-native` from `apps/mobile`
2. Register `@clippster/editor-native` in `app.config.ts` plugins
3. Rebuild the dev client (`yarn mobile:android` / `yarn mobile:ios`)

## Capability registry

A tool is user-visible only when graph node, Android renderer, iOS renderer,
export, validation, and golden fixtures are all true. See `capabilities.cpp`.

LUT remains intentionally gated until audited LUT assets ship (see
`provenance/NOTICE.md`).

## License boundary

No FFmpeg inside this package. See `provenance/NOTICE.md`.
