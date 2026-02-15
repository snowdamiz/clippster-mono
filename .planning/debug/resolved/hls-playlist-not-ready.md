---
status: resolved
trigger: "hls-playlist-not-ready"
created: 2026-02-15T00:00:00Z
updated: 2026-02-15T00:07:00Z
---

## Current Focus

hypothesis: waitForPlaylist aborts early because hlsUrl is set to OLD URL, doesn't match new expectedUrl
test: Check if hlsUrl variable is updated when checking new output directory
expecting: hlsUrl is still the old asset:// URL when waitForPlaylistReady is called, causing early abort on line 153
next_action: Confirm hlsUrl variable state and when it gets updated

## Symptoms

expected: After recorder restart, once segments start flowing, HLS playback should reinitialize and resume
actual: Segments flow (1, 2, 3... up to 42+) but "Playlist ready result: false" every time, playback never resumes
errors: "[LiveViewer] Playlist/segments not ready, skipping HLS init" repeated indefinitely
reproduction: Watch a live Twitch stream, wait for segments to stall (30s), recorder auto-restarts, then playback never resumes
started: Reported 2/15/26 by tester

## Eliminated

## Evidence

- timestamp: 2026-02-15T00:01:00Z
  checked: useLivestreamViewer.ts line 1399 - waitForPlaylistReady call
  found: Uses hlsOutputDir.value which IS updated on line 2027 after recorder restart
  implication: The output directory is being updated correctly after restart

- timestamp: 2026-02-15T00:02:00Z
  checked: useHlsPlayback.ts line 1046 - waitForPlaylistReady implementation
  found: Calls waitForPlaylist then waitForFirstSegment, both use extractOutputDirFromAssetUrl
  implication: Needs to extract outputDir from asset:// URL for Tauri protocol checks

- timestamp: 2026-02-15T00:03:00Z
  checked: useHlsPlayback.ts line 127-144 - extractOutputDirFromAssetUrl function
  found: Uses atob to decode base64 encoded directory from asset:// URL
  implication: If hlsOutputDir.value is updated to new directory, but asset:// URL still points to OLD directory, extraction would return OLD directory

- timestamp: 2026-02-15T00:04:00Z
  checked: useHlsPlayback.ts line 150-153 - waitForPlaylist early abort condition
  found: "if (expectedUrl && hlsUrl && hlsUrl !== expectedUrl) return false;"
  implication: hlsUrl is a module-level variable set during initialize(). If HLS was previously initialized with OLD directory, hlsUrl still points to OLD asset:// URL. When waitForPlaylistReady generates NEW asset:// URL for new directory and passes it as expectedUrl, the condition hlsUrl !== expectedUrl is TRUE, causing immediate abort!

## Resolution

root_cause: waitForPlaylist/waitForFirstSegment abort early when hlsUrl (OLD directory) doesn't match expectedUrl (NEW directory) after recorder restart. The hlsUrl variable is only updated during initialize(), but waitForPlaylistReady() is called BEFORE cleanup happens, causing immediate false return on line 153/187.
fix:
1. Modified waitForPlaylistReady to pass outputDirOrUrl as 3rd parameter to both waitForPlaylist and waitForFirstSegment
2. Modified early abort check in both functions to skip when outputDir is provided: "if (!outputDir && expectedUrl && hlsUrl && hlsUrl !== expectedUrl)"
This allows waitForPlaylistReady to check new directory after recorder restart without being blocked by stale hlsUrl from previous initialization.
verification: Code review confirms fix addresses root cause - when outputDir is provided, functions skip URL mismatch check and use provided directory directly
files_changed: [client/src/composables/useHlsPlayback.ts]
