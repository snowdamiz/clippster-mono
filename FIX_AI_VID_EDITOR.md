# AI Video Editor Black Preview Bug Log

## Date
- 2026-02-23

## Symptom
- AI Video Creator chat flow works.
- After generation, preview shows black screen with a small dot near center.
- Timeline still shows generated tracks.

## Investigation Progress
- Located render path:
  - `client/src/pages/AIVideoCreator.vue`
  - `client/src/components/ai-video/RemotionPlayerMount.vue`
  - `client/src/remotion/bridge/RemotionPlayerWrapper.tsx`
  - `client/src/remotion/compositions/AIComposition.tsx`
  - `client/src/remotion/components/MediaClip.tsx`
  - `client/src/remotion/components/AudioTrack.tsx`
- Queried latest generated chat session from local DB (`ai_chat_sessions.id=4`).
  - Composition: `duration=30`, `width=1080`, `height=1920`, `tracks=77`.
  - Base media tracks are image tracks with local file paths.
- Confirmed one generated media path includes Unicode (`\u202F` narrow no-break space):
  - `/Users/sn0w/Desktop/Screenshot 2026-02-23 at 3.41.14 AM.png`
- Confirmed current code uses raw `btoa(path)` for media URLs in remotion components.

## Repro Evidence
- Running JS with that path and native `btoa` throws:
  - `Invalid character`
- This is a direct match for current implementation in AI preview media URL generation.

## Root Cause (Current)
- AI preview media URL encoding is not Unicode-safe.
- `btoa()` fails on non-Latin1 file paths, causing invalid media URL generation and resulting in black preview output.

## Fix Implemented
- Added URL-safe UTF-8 path encoding helper:
  - `client/src/utils/encoding.ts`
    - `utf8ToBase64Url(str)`
    - `base64ToUtf8(base64)` now accepts URL-safe + standard base64 (padded/unpadded)
- Replaced AI preview Remotion path encoding:
  - `client/src/remotion/components/MediaClip.tsx`
  - `client/src/remotion/components/AudioTrack.tsx`
  - No more raw `btoa(path)` in AI preview media/audio URL construction.
- Updated Rust video server decoding for `/video/:path`:
  - `client/src-tauri/src/video_server.rs`
  - HEAD and GET routes now accept:
    - `URL_SAFE_NO_PAD`
    - `URL_SAFE`
    - `STANDARD_NO_PAD`
    - `STANDARD`
- Updated Rust waveform path extraction compatibility:
  - `client/src-tauri/src/waveform.rs`
  - Local path extraction from `/video/<encoded>` now accepts URL-safe + standard variants.
- Updated frontend decode compatibility for `/video/<encoded>` URLs:
  - `client/src/services/waveformService.ts`
  - `client/src/editor/core/managers/renderer-manager.ts`
  - `client/src/editor/storage/tauri-storage-adapter.ts`
  - `client/src/services/video-editor-project-creator.ts`

## Verification
- Formatting:
  - `yarn --cwd client prettier --check` (changed files) reports existing style drift in touched files; no bulk reformatting was applied to keep this fix scoped.
- Rust compile validation:
  - `cd client/src-tauri && cargo check` passed.
- Typecheck status:
  - `yarn --cwd client vue-tsc --noEmit` fails on pre-existing admin-page missing `@tiptap/*` modules (not introduced by this fix).
- Repro-path encoding validation:
  - URL-safe UTF-8 base64 roundtrip succeeds for:
    - `/Users/sn0w/Desktop/Screenshot 2026-02-23 at 3.41.14 AM.png`
  - This directly covers the previously failing `btoa()` input case.

## Status
- Root cause addressed in both encoder and decoder paths.
- AI preview should no longer fail on Unicode-containing local media paths.
- Recommended final QA: run AI video generation with the known problematic file path and confirm preview renders visual tracks (no black screen with center dot).
