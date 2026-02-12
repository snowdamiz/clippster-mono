---
status: resolved
trigger: "ffmpeg-sys-build-failure-macos-ci - macOS aarch64 CI/CD build fails with ffmpeg-sys-the-third unable to detect FFmpeg version"
created: 2026-02-12T00:00:00Z
updated: 2026-02-12T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED AND FIXED
test: Removed [env] section from .cargo/config.toml, rebuilt ffmpeg-sys-the-third
expecting: Build succeeds with pkg-config finding FFmpeg from Homebrew
next_action: Archive session

## Symptoms

expected: Tauri app should build successfully on macOS (aarch64-apple-darwin target) in CI
actual: Build fails with ffmpeg-sys-the-third panicking: "FFmpeg 4.2 or higher is required, but found avcodec version (0, 0)"
errors: build.rs:821 panics because avcodec version detected as (0,0). Stdout shows `cargo:rustc-link-search=native=C:\vcpkg\installed\x64-windows/lib` - a WINDOWS path on macOS runner.
reproduction: Push to release branch, macOS aarch64 build job fails
started: CI/CD pipeline issue

## Eliminated

- hypothesis: $GITHUB_ENV variables not propagated to tauri-action
  evidence: The FFMPEG_DIR from $GITHUB_ENV is irrelevant because .cargo/config.toml with force=true overrides it
  timestamp: 2026-02-12

- hypothesis: ffmpeg-sys-the-third vcpkg fallback on macOS
  evidence: try_vcpkg() returns None unconditionally on non-MSVC targets (line 652-655 of ffmpeg-sys-the-third build.rs). vcpkg is not even a build dep on non-MSVC.
  timestamp: 2026-02-12

## Evidence

- timestamp: 2026-02-12
  checked: .cargo/config.toml in client/src-tauri/
  found: |
    [env] section sets FFMPEG_DIR = "C:\\vcpkg\\installed\\x64-windows" with force=true
    Also sets FFMPEG_PKG_CONFIG_PATH, VCPKG_ROOT, VCPKGRS_DYNAMIC
    These are in the GLOBAL [env] section, not target-specific
  implication: These env vars apply to ALL targets including macOS, causing ffmpeg-sys-the-third to look for headers at a Windows path on macOS

- timestamp: 2026-02-12
  checked: Local reproduction with `cargo build -vv -p ffmpeg-sys-the-third`
  found: |
    Build output shows: FFMPEG_DIR='C:\vcpkg\installed\x64-windows' on macOS
    clang parses headers from non-existent Windows path
    All version numbers remain at (0, 0)
    Panics at build.rs:821: "FFmpeg 4.2 or higher is required, but found avcodec version (0, 0)"
  implication: The bug is reproducible locally, confirming .cargo/config.toml is the cause

- timestamp: 2026-02-12
  checked: ffmpeg-sys-the-third build.rs detection order
  found: |
    1. CARGO_FEATURE_BUILD (not enabled)
    2. FFMPEG_DIR env var (line 890) - this is what gets used
    3. try_vcpkg (returns None on macOS)
    4. pkg-config fallback
    Since FFMPEG_DIR is set (to Windows path), detection never reaches pkg-config
  implication: Even though pkg-config would work correctly on macOS, FFMPEG_DIR takes priority and points to non-existent Windows path

- timestamp: 2026-02-12
  checked: Post-fix verification with clean build
  found: |
    After removing [env] section, ffmpeg-sys-the-third correctly falls through to pkg-config
    Detects FFmpeg at /opt/homebrew/Cellar/ffmpeg/8.0.1_2/lib
    FFmpeg 8.0 version correctly detected (cargo:rustc-cfg=feature="ffmpeg_8_0")
    Build succeeds
  implication: Fix is verified locally

## Resolution

root_cause: |
  client/src-tauri/.cargo/config.toml had an [env] section that unconditionally set:
    FFMPEG_DIR = "C:\\vcpkg\\installed\\x64-windows" (with force=true)
    FFMPEG_PKG_CONFIG_PATH = "C:\\vcpkg\\installed\\x64-windows\\lib\\pkgconfig" (with force=true)
    VCPKG_ROOT = "C:\\vcpkg"
    VCPKGRS_DYNAMIC = "1"

  Cargo's [env] section is GLOBAL -- it applies to ALL targets, not just Windows.
  The `force = true` flag causes these env vars to override any externally-set values
  (including FFMPEG_DIR set via $GITHUB_ENV in the CI workflow).

  When ffmpeg-sys-the-third's build.rs runs on macOS, it finds FFMPEG_DIR set to
  "C:\vcpkg\installed\x64-windows" (a non-existent Windows path), uses it as the
  include path for clang header parsing, clang finds no headers, all FFmpeg library
  versions stay at (0, 0), and the build panics with the version check assertion.

fix: |
  Removed the entire [env] section from client/src-tauri/.cargo/config.toml.
  The file now only contains [target.x86_64-pc-windows-msvc] rustflags.

  FFmpeg detection paths per platform:
  - macOS CI: $GITHUB_ENV sets FFMPEG_DIR in the "Install FFmpeg dev libraries" step
  - macOS local: pkg-config auto-detects from Homebrew (brew install ffmpeg pkg-config)
  - Windows CI: release.yml explicitly sets FFMPEG_DIR in the Build Tauri App step env block
  - Windows local: Set FFMPEG_DIR in shell or place ffmpeg-dev/ in src-tauri/

verification: |
  - Reproduced failure locally: `cargo build --release -p ffmpeg-sys-the-third` with old config panics
  - Applied fix (removed [env] section)
  - Clean build succeeds: `cargo clean -p ffmpeg-sys-the-third --release && cargo build --release -p ffmpeg-sys-the-third`
  - Verified correct detection: pkg-config finds FFmpeg at /opt/homebrew/Cellar/ffmpeg/8.0.1_2/lib
  - Verified version detection: cargo:rustc-cfg=feature="ffmpeg_8_0" (FFmpeg 8.0 correctly detected)
  - Windows CI unaffected: release.yml already sets FFMPEG_DIR explicitly in the build step env block

files_changed:
  - client/src-tauri/.cargo/config.toml
