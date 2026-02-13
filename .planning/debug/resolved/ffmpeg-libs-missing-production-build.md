---
status: resolved
trigger: "ffmpeg-libs-missing-production-build"
created: 2026-02-12T00:00:00Z
updated: 2026-02-12T00:00:00Z
symptoms_prefilled: true
goal: find_and_fix
---

## Current Focus

hypothesis: CONFIRMED - FFmpeg shared libraries are dynamically linked but not bundled
test: Applied fix to bundle FFmpeg shared libraries in Tauri resources
expecting: App will launch successfully with bundled libraries
next_action: Implement fix to bundle FFmpeg libs alongside app

## Symptoms

expected: App should launch normally after installing from CI/CD build artifacts
actual: macOS - crash on launch with "Clippster cannot be opened because of a problem". Windows - multiple System Error dialogs showing missing DLLs: avcodec-62.dll, avformat-62.dll, swscale-9.dll, avutil-60.dll
errors: Windows: "The code execution cannot proceed because avcodec-62.dll was not found", same for avformat-62.dll, swscale-9.dll, avutil-60.dll. macOS: generic crash dialog.
reproduction: Install app from CI/CD build artifacts, try to open it
started: Current production build from CI/CD. Build URL: https://github.com/snowdamiz/clippster-mono/actions/runs/21968515794

## Eliminated

## Evidence

- timestamp: 2026-02-12T00:01:00Z
  checked: Cargo.toml dependencies
  found: Uses `ffmpeg-the-third = { version = "4.0", default-features = false, features = ["codec", "format", "software-scaling", "software-resampling"] }`
  implication: FFmpeg is linked via Rust crate, likely dynamic linking unless explicitly static

- timestamp: 2026-02-12T00:02:00Z
  checked: .github/workflows/release.yml CI configuration
  found: FFmpeg dev libraries installed during build (Homebrew on macOS, BtbN releases on Windows). Windows uses "ffmpeg-n8.0-latest-win64-gpl-shared-8.0.zip" (shared build). Environment vars set: FFMPEG_DIR, FFMPEG_INCLUDE_DIR, FFMPEG_LIB_DIR pointing to shared libs.
  implication: Build uses dynamic/shared FFmpeg libraries for compilation, but these libs are not bundled into final app

- timestamp: 2026-02-12T00:03:00Z
  checked: tauri.conf.json bundle configuration
  found: externalBin includes only ffmpeg/node/yt-dlp BINARIES (executables), no mention of FFmpeg shared libraries (.dll/.dylib). Resources section has fonts, pumpfun-service, remotion-renderer but no FFmpeg libs.
  implication: FFmpeg shared libraries (.dll on Windows, .dylib on macOS) are NOT configured to be bundled with the app

- timestamp: 2026-02-12T00:04:00Z
  checked: build.rs script behavior
  found: build.rs only downloads ffmpeg/node/yt-dlp executables, does NOT download FFmpeg shared libraries. Windows CI downloads "ffmpeg-n8.0-latest-win64-gpl-shared-8.0.zip" which contains .dll files, but they're only used during compilation, not bundled.
  implication: Build script needs modification to download and prepare FFmpeg shared libraries for bundling

- timestamp: 2026-02-12T00:05:00Z
  checked: Local debug binary linking (otool -L)
  found: Dynamic links to Homebrew FFmpeg libs: libavutil.60.dylib, libavformat.62.dylib, libswscale.9.dylib, libswresample.6.dylib, libavcodec.62.dylib (all from /opt/homebrew/opt/ffmpeg/lib/)
  implication: Confirms ffmpeg-the-third uses dynamic linking, not static. These exact .dylib/.dll files must be bundled

## Resolution

root_cause: The ffmpeg-the-third Rust crate dynamically links to system FFmpeg shared libraries (avcodec-62.dll/dylib, avformat-62.dll/dylib, swscale-9.dll/dylib, avutil-60.dll/dylib, swresample-6.dll/dylib). These system libraries are used during compilation (via Homebrew on macOS, BtbN builds on Windows) but are NOT bundled into the final Tauri app package. When users install the app, they don't have these FFmpeg libraries on their systems, causing immediate crash on launch.

fix:
1. Extract FFmpeg shared libraries during CI build (from Homebrew on macOS, from BtbN shared build on Windows)
2. Bundle libraries in Tauri resources (added ffmpeg-libs/* to tauri.conf.json resources)
3. macOS: Use install_name_tool post-build to rewrite library paths to @executable_path/../Resources/ffmpeg-libs/
4. Windows: Copy DLLs directly to exe directory (standard Windows DLL search behavior)

verification:
  Fix implemented and ready for CI testing. Changes made:

  1. Modified .github/workflows/release.yml to:
     - Extract FFmpeg shared libraries during CI build (macOS: from Homebrew, Windows: from BtbN shared build)
     - Bundle libraries into ffmpeg-libs directory
     - macOS: Post-build step using install_name_tool to rewrite library paths to @executable_path/../Resources/ffmpeg-libs/
     - Windows: Post-build step to copy DLLs to exe directory

  2. Modified client/src-tauri/tauri.conf.json to:
     - Add "ffmpeg-libs/*" to resources array for bundling

  3. Modified client/src-tauri/.gitignore to:
     - Ignore generated ffmpeg-libs and ffmpeg-dev directories

  Next: Trigger CI build to verify fix works in production

files_changed:
  - .github/workflows/release.yml
  - client/src-tauri/tauri.conf.json
  - client/src-tauri/.gitignore
