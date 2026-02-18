# macOS Production Livestream Watching Bug

**Status:** FIXES IMPLEMENTED - PENDING VERIFICATION
**Severity:** Critical - All livestream watching broken on macOS production builds
**Affected:** PumpFun, Kick, Twitch - ALL platforms, macOS production only
**Works in:** Dev mode (all platforms), Windows production, Linux production
**Version:** 0.1.95+

---

## Symptom

When watching any livestream on macOS production build, the video never loads. The viewer opens but shows a blank/loading state indefinitely.

### Key Log Evidence

```
[Error] Refused to connect to ipc://localhost/get_platform because it does not appear in the connect-src directive of the Content Security Policy.
[Warning] IPC custom protocol failed, Tauri will now use the postMessage interface instead – TypeError: Load failed
[Debug] [LiveViewer] No segments returned from get_hls_segments (x34+)
```

The `get_hls_segments` Tauri command returns empty results 34+ times (polled every 2s = ~68 seconds of no segments). This means the output directory either doesn't exist or contains no `.ts` segments and no `.m3u8` playlist.

---

## Architecture Overview

### Livestream Recording Pipeline (per platform)

**PumpFun:**
1. Frontend calls `start_hls_recording` Tauri command
2. Rust creates output dir: `~/Library/Application Support/Clippster/videos/hls_live/{mint_id}/{session_id}/`
3. Rust spawns **Node.js sidecar** via `app.shell().sidecar("node")` with `record-livestream.mjs`
4. Node.js connects to PumpFun's LiveKit server, receives WebRTC media, pipes to FFmpeg, outputs HLS segments

**Kick/Twitch:**
1. Frontend calls `start_kick_recording` / `start_twitch_recording`
2. Rust creates output dir: `~/Library/Application Support/Clippster/livestream_recordings/{session_id}/`
3. Rust spawns **yt-dlp** (piped to **FFmpeg**) via `tokio::process::Command`
4. yt-dlp captures stream, FFmpeg re-encodes to HLS segments

### HLS Playback Pipeline
1. `updateHlsSegments()` polls `get_hls_segments` every 2 seconds
2. `get_hls_segments` reads the output directory for `.m3u8` playlist and `.ts` files
3. Once segments exist, hls.js initializes with custom `TauriHlsLoader` (reads files via Tauri IPC)
4. Video plays in `<video>` element with DVR rewind capability

### Key Files
- `client/src/composables/useLivestreamViewer.ts` - Main viewer logic, segment polling
- `client/src/composables/useHlsPlayback.ts` - hls.js configuration and playback
- `client/src/composables/useTauriHlsLoader.ts` - Custom HLS loader using Tauri IPC
- `client/src/components/LivestreamWatchDialog.vue` - Watch dialog UI
- `client/src-tauri/src/hls.rs` - `start_hls_recording`, `get_hls_segments` commands
- `client/src-tauri/src/hls_proxy.rs` - `read_hls_playlist`, `read_hls_segment` commands
- `client/src-tauri/src/kick.rs` - Kick recording with yt-dlp + FFmpeg, `resolve_sidecar_binary()`
- `client/src-tauri/src/twitch.rs` - Twitch recording with yt-dlp + FFmpeg
- `client/src-tauri/pumpfun-service/record-livestream.mjs` - Node.js LiveKit recorder
- `client/src-tauri/tauri.conf.json` - CSP and security config
- `client/src-tauri/entitlements/node.entitlements.plist` - Node.js hardened runtime entitlements (NOT APPLIED)
- `client/src-tauri/entitlements/yt-dlp.entitlements.plist` - yt-dlp hardened runtime entitlements (NOT APPLIED)

---

## CONFIRMED Root Causes

### Root Cause 1: Entitlements NOT Applied - Sidecar Binaries Crash (CONFIRMED)

**Entitlements check (`codesign -d --entitlements -`) shows ZERO entitlements on ALL binaries:**
- `clippster-ui` - No entitlements
- `node` - No entitlements (needs `allow-jit`, `disable-library-validation`, `allow-unsigned-executable-memory`)
- `yt-dlp` - No entitlements (needs `disable-library-validation`, `allow-unsigned-executable-memory`)
- `ffmpeg` - No entitlements (doesn't need any - static binary)

All binaries ARE signed with hardened runtime (`flags=0x10000(runtime)`) by `Developer ID Application: OpenWorth Technologies, LLC (CD2RXM358N)`.

The entitlements `.plist` files exist in `client/src-tauri/entitlements/` but are **never referenced by any build script, CI config, or Tauri config**. They are dead files.

#### Node.js Crash (kills PumpFun recording)

```
$ /Applications/Clippster.app/Contents/MacOS/node -e "console.log(1+1)"

#
# Fatal process OOM in Failed to reserve virtual memory for CodeRange
#

Exit code: 133
```

V8 JIT engine cannot allocate executable memory for its CodeRange without `com.apple.security.cs.allow-jit`. Node.js crashes **immediately** on ANY JavaScript execution. Even `node -e "1+1"` fails. Only `node --version` works (no JS execution).

#### yt-dlp Crash (kills Kick/Twitch recording)

```
$ /Applications/Clippster.app/Contents/MacOS/yt-dlp --version

[PYI-9617:ERROR] Failed to load Python shared library
'...Python.framework/Versions/3.14/Python' not valid for use in process:
mapping process and mapped file (non-platform) have different Team IDs
```

PyInstaller extracts Python runtime to temp dir. Without `com.apple.security.cs.disable-library-validation`, macOS blocks loading the extracted Python library because it has a different Team ID than the signed yt-dlp binary.

#### FFmpeg Works

```
$ /Applications/Clippster.app/Contents/MacOS/ffmpeg -version
ffmpeg version 6.0 Copyright (c) 2000-2023 the FFmpeg developers
```

Static binary, no JIT or dynamic library loading needed. Works fine under hardened runtime.

### Root Cause 2: Binary Naming Mismatch in Bundle (CONFIRMED)

**`resolve_sidecar_binary()` in `kick.rs:299` expects triple-suffixed names, but bundle has bare names:**

| Expected by code | Actual in bundle |
|---|---|
| `ffmpeg-aarch64-apple-darwin` | `ffmpeg` |
| `yt-dlp-aarch64-apple-darwin` | `yt-dlp` |
| `node-aarch64-apple-darwin` | `node` |

Tauri strips the target triple suffix when bundling sidecars into the `.app`. The custom `resolve_sidecar_binary()` doesn't account for this. It falls back to returning the bare name (e.g., `"ffmpeg"`), but then `Path::new("ffmpeg").exists()` fails because it's a relative path that doesn't match any file in the working directory.

**Impact:** Even if yt-dlp/ffmpeg were properly entitled, Kick/Twitch recording would STILL fail because the binaries can't be found by `resolve_sidecar_binary()`.

**Note:** PumpFun's Node.js sidecar uses `app.shell().sidecar("node")` (Tauri's API) which handles the naming correctly. Kick/Twitch use the custom `resolve_sidecar_binary()` which does not.

### Root Cause 3: CSP Missing `ipc://localhost` (CONFIRMED - Secondary)

**The error:**
```
Refused to connect to ipc://localhost/get_platform because it does not appear in the connect-src directive of the Content Security Policy.
```

CSP has `http://ipc.localhost` but macOS production uses `ipc://localhost` protocol scheme. Tauri falls back to `postMessage` interface. This is a performance/reliability issue but NOT the primary cause of the segment failure (sidecar spawning happens on the Rust side, not via IPC).

---

## Diagnostic Results

### Step 1: Binary Existence in Bundle
```
$ ls -la /Applications/Clippster.app/Contents/MacOS/
clippster-ui    53MB   (main app)
ffmpeg          45MB   (static binary - WORKS)
node            93MB   (V8 JIT binary - CRASHES)
yt-dlp          36MB   (PyInstaller binary - CRASHES)
```
Binaries present but named WITHOUT target triple suffix.

### Step 2: Entitlements Check
```
$ codesign -d --entitlements - /Applications/Clippster.app/Contents/MacOS/node
Executable=/Applications/Clippster.app/Contents/MacOS/node
(NO ENTITLEMENTS OUTPUT - empty)
```
Same for all binaries. Zero entitlements applied.

### Step 3: Codesign Details
All binaries signed with:
- Authority: `Developer ID Application: OpenWorth Technologies, LLC (CD2RXM358N)`
- Hardened runtime: `flags=0x10000(runtime)` - **ENABLED**
- Properly validated

### Step 4: Direct Binary Execution Tests
| Binary | Command | Result |
|---|---|---|
| `node` | `--version` | `v20.11.0` (no JS executed) |
| `node` | `-e "console.log(1)"` | `Fatal process OOM in Failed to reserve virtual memory for CodeRange` (exit 133) |
| `yt-dlp` | `--version` | `[PYI-9617:ERROR] Failed to load Python shared library ... different Team IDs` |
| `ffmpeg` | `-version` | `ffmpeg version 6.0` (works) |

### Step 5: Bundle Resources
```
$ ls /Applications/Clippster.app/Contents/Resources/pumpfun-service/
fetch-clips.mjs
node_modules/
record-livestream.mjs
package.json
...
```
PumpFun service scripts are present in the bundle.

---

## Required Fixes

### Fix 1: Apply Entitlements During Build (CRITICAL)

The entitlements `.plist` files exist but must be applied during codesigning. After `tauri build` completes the bundle, re-sign the sidecar binaries with entitlements:

```bash
# Re-sign node with JIT + library validation entitlements
codesign --force --options runtime --sign "$APPLE_SIGNING_IDENTITY" \
  --entitlements src-tauri/entitlements/node.entitlements.plist \
  "target/release/bundle/macos/Clippster.app/Contents/MacOS/node"

# Re-sign yt-dlp with library validation entitlements
codesign --force --options runtime --sign "$APPLE_SIGNING_IDENTITY" \
  --entitlements src-tauri/entitlements/yt-dlp.entitlements.plist \
  "target/release/bundle/macos/Clippster.app/Contents/MacOS/yt-dlp"
```

This must happen AFTER Tauri bundles the app but BEFORE notarization.

**Implementation options:**
- Add a post-build script that runs after `tauri build`
- Use Tauri's `beforeBundleCommand` or a custom build hook
- Add to CI/CD pipeline after the build step

### Fix 2: Fix Binary Path Resolution for Kick/Twitch (CRITICAL)

`resolve_sidecar_binary()` in `kick.rs:299` looks for `{name}-{target_triple}` but the production bundle has just `{name}`. Fix:

```rust
fn resolve_sidecar_binary(base_name: &str) -> Result<String, String> {
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?;
    let exe_dir = exe_path.parent().ok_or("Failed to get parent directory")?;
    let target_triple = get_target_triple();

    // Try triple-suffixed name first (dev mode)
    #[cfg(target_os = "windows")]
    let binary_name_with_triple = format!("{}-{}.exe", base_name, target_triple);
    #[cfg(not(target_os = "windows"))]
    let binary_name_with_triple = format!("{}-{}", base_name, target_triple);

    let prod_path = exe_dir.join(&binary_name_with_triple);
    if prod_path.exists() {
        return Ok(prod_path.to_string_lossy().to_string());
    }

    // Try bare name (production macOS bundle - Tauri strips the triple)
    #[cfg(target_os = "windows")]
    let bare_name = format!("{}.exe", base_name);
    #[cfg(not(target_os = "windows"))]
    let bare_name = base_name.to_string();

    let bare_path = exe_dir.join(&bare_name);
    if bare_path.exists() {
        return Ok(bare_path.to_string_lossy().to_string());
    }

    // Development mode: check src-tauri/binaries/
    // ... (existing dev fallback logic)

    Err(format!("Binary '{}' not found in bundle or PATH", base_name))
}
```

The same fix is needed in `twitch.rs` if it has a similar `resolve_sidecar_binary()`.

### Fix 3: Add `ipc://localhost` to CSP (RECOMMENDED)

In `tauri.conf.json`, add `ipc://localhost` to `connect-src`:

```
connect-src 'self' asset: https://asset.localhost tauri: http://ipc.localhost ipc://localhost http://localhost:* ...
```

Prevents the IPC fallback to `postMessage` and eliminates the CSP warning.

### Fix 4: Add Sidecar Failure Detection (RECOMMENDED)

Currently, `start_hls_recording` returns `Ok(...)` immediately after spawning. If Node.js crashes (exit 133), the frontend never knows. Consider:
1. Emit a `recorder-error` event when the sidecar process exits with non-zero code
2. Frontend should listen for this and show a meaningful error to the user
3. Optionally: wait for first stdout line before returning success from `start_hls_recording`

---

## Root Cause 4: `--deep` Re-sign Strips Entitlements from All Sidecars (TRUE ROOT CAUSE - ALL PLATFORMS)

**Affects:** Kick, Twitch, AND PumpFun — all platforms broken on macOS production.

**The bug in `.github/workflows/release.yml`:**
```bash
# OLD (BROKEN) order:
codesign --entitlements node.plist ... node      # ✅ applied
codesign --entitlements yt-dlp.plist ... yt-dlp  # ✅ applied
codesign --force --deep ... "$APP_BUNDLE"         # ❌ --deep re-signs ALL inner binaries
                                                  #    WITHOUT entitlements, wiping steps above
```

`codesign --deep` recursively re-signs every binary inside the `.app` bundle using only the outer identity, with **no entitlements**. It overwrites the carefully applied `node` and `yt-dlp` entitlements from the lines above.

The verification step ran *after* `--deep` and showed empty entitlements, but the CI logs were never checked — so this went unnoticed.

**Result:** Every production build shipped with `node` and `yt-dlp` having zero entitlements:
- `node` → V8 JIT fails with OOM (exit 133) → PumpFun recording never starts
- `yt-dlp` → Python runtime fails to load (exit 1) → Kick/Twitch recording never starts

**Fix:** Use Apple's recommended **inside-out signing order**:
1. Sign all inner binaries first (deepest components first)
2. Sign `node` and `yt-dlp` with their entitlements
3. Sign the outer `.app` **last, WITHOUT `--deep`** — all inner binaries are already correctly signed

Applied in: `.github/workflows/release.yml`

---

## Root Cause 5: FFmpeg Not Found in macOS Bundle (PumpFun-specific)

**Symptom from v0.2.x logs:**
```
[LiveViewer] PumpFun recorder resumed in existing dir: ...
[Debug] [LiveViewer] No segments returned from get_hls_segments (x44+)
```

Node.js is now running (entitlements fix worked — no more OOM crash). But `get_hls_segments` still returns empty because **FFmpeg is never found** by `record-livestream.mjs`.

**Root Cause:** `resolveFfmpegBinary()` in `record-livestream.mjs` looked for `ffmpeg-aarch64-apple-darwin` next to the node binary. In the macOS `.app` bundle, Tauri strips the target triple — the binary is just `ffmpeg`. The function fell through to `return 'ffmpeg'` (system PATH), which doesn't exist in a sandboxed app. FFmpeg never starts → no HLS segments ever produced.

**Fix:** Updated `resolveFfmpegBinary()` to check the bare name `ffmpeg` next to the node binary (same approach already used in `kick.rs` / `resolve_sidecar_binary()`). Added comprehensive logging of all candidate paths tried.

---

## Fix History

| Date | Version | Change | Result |
|------|---------|--------|--------|
| v0.1.95 | d75abf02 | Added entitlements `.plist` files to repo | Files created but never applied during build. Node.js and yt-dlp still crash. |
| v0.1.95 | applied | Added entitlements `.plist` files + CI re-sign step | Files created and CI step added, but `--deep` wipes them — all platforms still broken. |
| v0.1.95 | applied | Bare-name sidecar fallback in kick.rs, twitch.rs | Resolves binary naming mismatch for Kick/Twitch recording. |
| v0.1.95 | applied | Added `ipc://localhost` to CSP connect-src | Prevents IPC fallback to postMessage. |
| v0.2.x | **FIXED** | **`--deep` signing order bug** — moved `--deep` BEFORE sidecar entitlement re-signs | True root cause for ALL platforms. node/yt-dlp now keep their entitlements. |
| v0.2.x | applied | `resolveFfmpegBinary()` bare-name fallback in record-livestream.mjs | FFmpeg now found in macOS bundle (PumpFun). |
| v0.2.x | applied | `recorder-error` Tauri event + full stdout/stderr forwarding to frontend | Node.js exit codes and all recorder logs now visible in browser console. |

---

## Investigation State

- [x] Identified symptom: `get_hls_segments` returns empty arrays
- [x] Traced recording pipeline for all platforms
- [x] Found entitlements files exist but are not referenced by build system
- [x] Found CSP mismatch (`http://ipc.localhost` vs `ipc://localhost`)
- [x] Verified sidecar binary existence in production .app bundle (present, bare names)
- [x] Checked actual codesign entitlements on production binaries (ZERO entitlements on all)
- [x] Confirmed Node.js crashes: `Fatal process OOM in Failed to reserve virtual memory for CodeRange` (exit 133)
- [x] Confirmed yt-dlp crashes: `Failed to load Python shared library ... different Team IDs`
- [x] Confirmed ffmpeg works (static binary, no entitlements needed)
- [x] Confirmed binary naming mismatch (`resolve_sidecar_binary()` looks for triple suffix, bundle has bare names)
- [x] Apply Fix 1: Entitlements during build — CI post-build re-sign step added to `.github/workflows/release.yml`
- [x] Apply Fix 2: Binary path resolution — Bare-name fallback added to `kick.rs`, `twitch.rs`, `sidecar/mod.rs`
- [x] Apply Fix 3: CSP fix — Added `ipc://localhost` to `connect-src` in `tauri.conf.json`
- [x] Apply Fix 4: `resolveFfmpegBinary()` in `record-livestream.mjs` — bare name fallback for macOS bundle
- [x] Apply Fix 5: `recorder-error` event + full stdout/stderr forwarding to frontend console
- [ ] Rebuild, re-sign, and verify
