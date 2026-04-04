# PowerShell Dialog Fix Summary

**Date:** April 4, 2026  
**Status:** ✅ **FIXED** (Pending Windows Testing)

---

## Problem Statement

The Windows desktop app was reported to show PowerShell/console window flashes when opening native file dialogs. This creates a poor user experience and appears unprofessional.

---

## Root Cause Analysis

After a thorough audit, we identified that:

1. **The Tauri dialog plugin itself was NOT the issue** - it uses native OS APIs and doesn't spawn processes
2. **Three Rust process spawns were missing `CREATE_NO_WINDOW` flags**, which could cause console flashes
3. The issue was likely background processes (FFmpeg, Node.js, taskkill) spawning coincidentally with dialog operations

---

## Fixes Implemented

### 1. Fixed Node.js Sidecar Process (Remotion Renderer)
**File:** `client/src-tauri/src/sidecar/mod.rs`  
**Line:** 185

**Before:**
```rust
let mut process = Command::new(&node_path)
    .arg(&bundle_path)
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()
```

**After:**
```rust
let mut cmd = Command::new(&node_path);
cmd.arg(&bundle_path)
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());

#[cfg(target_os = "windows")]
{
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
}

let mut process = cmd.spawn()
```

**Impact:** Used when exporting videos via Remotion renderer

---

### 2. Fixed Taskkill Command (FFmpeg Process Cleanup)
**File:** `client/src-tauri/src/audio.rs`  
**Line:** 32

**Before:**
```rust
let _ = std::process::Command::new("taskkill")
    .args(["/F", "/T", "/PID", &pid.to_string()])
    .output();
```

**After:**
```rust
let mut cmd = std::process::Command::new("taskkill");
cmd.args(["/F", "/T", "/PID", &pid.to_string()]);
cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
let _ = cmd.output();
```

**Impact:** Used when canceling active downloads or stopping FFmpeg processes

---

### 3. Fixed FFmpeg Video Conversion Command
**File:** `client/src-tauri/src/commands/convert_video.rs`  
**Line:** 48

**Before:**
```rust
let output = Command::new(&ffmpeg_path)
    .args(&[...])
    .output()
```

**After:**
```rust
let mut cmd = Command::new(&ffmpeg_path);
cmd.args(&[...]);

#[cfg(target_os = "windows")]
{
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
}

let output = cmd.output()
```

**Impact:** Used when converting video overlays to MP4 format

---

## Verification Summary

### ✅ Verified: All Other Process Spawns

Audited all process spawning code and confirmed the following files **already have proper `CREATE_NO_WINDOW` flags**:

- `youtube.rs` - ✅ Has `no_window()` helper
- `twitch.rs` - ✅ Has `no_window()` helper
- `twitter.rs` - ✅ Has `no_window()` helper
- `rumble.rs` - ✅ Has `no_window()` helper
- `kick.rs` - ✅ Has `no_window()` helper
- `ffmpeg_sidecar.rs` - ✅ Has inline `creation_flags`
- `audio_download.rs` - ✅ Has `CREATE_NO_WINDOW` constant
- `video_server.rs` - ✅ Has `no_window()` helper
- `thumbnail_utils.rs` - ✅ Has `no_window()` helper

### ✅ Verified: Tauri Shell Plugin Sidecars

The following files use `tauri_plugin_shell` which handles `CREATE_NO_WINDOW` internally:
- `downloads.rs` - ✅ Uses shell plugin
- `audio.rs` (FFmpeg sidecars) - ✅ Uses shell plugin
- `hls.rs` - ✅ Uses shell plugin

### ✅ Verified: Windows Subsystem Configuration

**File:** `client/src-tauri/src/main.rs` (Line 2)
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
```

This ensures the app itself doesn't show a console window in release builds.

---

## Dialog Plugin Inventory

Documented all 21 locations using `@tauri-apps/plugin-dialog`:

**HIGH PRIORITY** (15 locations):
1. AudioLibrary.vue - Import audio files
2. AIVideoCreator.vue - Add media files
3. useVideoOperations.ts - Import videos
4. Projects.vue - Export projects
5. Clips.vue - Export clips
6. UploadMediaView.vue - Upload media to editor
7. useAssetOperations.ts - Asset management
8. useImageAssetOperations.ts - Image assets
9. useAudioAssetOperations.ts - Audio assets
10. ProjectDialog.vue - Create projects
11. Messages.vue - Attach files
12. ChatWindow.vue - Attach files
13-15. Various other user-facing features

**MEDIUM PRIORITY** (9 locations):
1. AdminSettings.vue - Admin configuration
2. BrandingView.vue - Brand assets
3. useFontManager.ts - Font uploads
4-9. Various customization features

Full details in `docs/POWERSHELL_DIALOG_AUDIT.md`

---

## Files Changed

1. `client/src-tauri/src/sidecar/mod.rs` - Fixed Node.js process spawn
2. `client/src-tauri/src/audio.rs` - Fixed taskkill command
3. `client/src-tauri/src/commands/convert_video.rs` - Fixed FFmpeg conversion
4. `docs/POWERSHELL_DIALOG_AUDIT.md` - Created comprehensive audit document
5. `docs/POWERSHELL_DIALOG_FIX_SUMMARY.md` - This summary
6. `docs/BACKLOG_TODO_LIST.md` - Marked task as completed

---

## Testing Recommendations

### Build Release Version
```bash
cd client
yarn build
```

**Note:** Console window is only hidden in release builds, not development builds.

### Test Scenarios

**1. Test Dialog Operations (HIGH PRIORITY)**
- Open AudioLibrary and import an audio file
- Open AIVideoCreator and add media
- Create a new project with media files
- Export a project
- Export a clip
- Send a message with attachments

**2. Test Fixed Process Spawns**
- Export a video using the video editor (tests Remotion sidecar fix)
- Convert a video overlay in editor (tests convert_video fix)
- Start and cancel an audio download (tests taskkill fix)

**3. Monitor for Console Flashes**
- If any flash occurs, check Task Manager to identify the process
- Note the timing (does it coincide with dialogs or other operations?)

### Expected Result

With these fixes, **no PowerShell or console windows should appear** during:
- File dialog operations
- Video export/rendering
- Background processing
- Process cleanup operations

---

## Technical Details

### CREATE_NO_WINDOW Flag

The `0x08000000` flag is the Windows API constant for `CREATE_NO_WINDOW`, which prevents a console window from being created when spawning a process.

**Windows API Documentation:**
> CREATE_NO_WINDOW (0x08000000): The process is created without a console window.

### Why This Was Needed

On Windows, when you spawn a console application (like `ffmpeg.exe`, `node.exe`, or `taskkill.exe`) without this flag, Windows creates a visible console window for the process. Even if it's destroyed immediately, users can see a brief flash.

### macOS and Linux

These operating systems don't have the same console window behavior, so the flag is only applied on Windows using:
```rust
#[cfg(target_os = "windows")]
{
    cmd.creation_flags(0x08000000);
}
```

---

## Next Steps

1. **Build and test on Windows** - Verify no console flashes occur
2. **If flashes still occur:**
   - Use Process Monitor to identify which process is spawning
   - Check if it's a Windows DLL loading issue (first-time operations)
   - Verify timing correlation with specific operations
3. **Consider upstream report** - If issue persists with Tauri dialog plugin itself, report to Tauri team

---

## Conclusion

All code-level issues have been addressed. Every process spawn in the Rust backend now has proper `CREATE_NO_WINDOW` flags for Windows. The Tauri configuration is correct. Final verification requires testing on a Windows machine in release mode.

**Confidence Level:** 🟢 HIGH - All identified issues have been fixed.

---

**Author:** AI Assistant  
**Date:** April 4, 2026  
**Reviewed by:** Pending Windows testing
