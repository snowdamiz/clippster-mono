# Source provenance — @clippster/editor-native

Clean-room Clippster native editor engine. Do not embed proprietary SDKs,
BytePlus/CapCut binaries, MLT, GStreamer, OpenShot, libplacebo, or GPL code.

## Components

| Component | License | Notes |
|-----------|---------|-------|
| Shared C++ graph core | Proprietary (Clippster) | Original |
| Android MediaCodec / GLES / MediaMuxer | Android SDK | Platform APIs |
| iOS AVFoundation / VideoToolbox / Metal / AVAssetWriter | Apple SDK | Platform APIs |
| Expo Modules Core | MIT | Peer runtime |

## FFmpeg boundary

This package does **not** link FFmpeg. Mobile FFmpeg (`ffmpeg-expo`) remains an
audited utility for ingest/probe/proxy compatibility only and must not use
`libx264` or other GPL encoders in production artifacts.

## Intentionally gated capabilities

| Capability | Status | Reason |
|------------|--------|--------|
| `lut` | Hidden | Requires audited LUT asset packaging + provenance hashes before ship |
| AI/ML tools | Hidden | Not part of deterministic graph-backed editor surface |
