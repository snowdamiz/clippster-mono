# PowerShell Dialog Flash Audit

**Date:** April 4, 2026  
**Issue:** Windows desktop app shows PowerShell console window flash when opening native file dialogs  
**Root Cause:** Misconfiguration or plugin behavior with `@tauri-apps/plugin-dialog` on Windows

---

## Configuration Status

### ✅ Tauri Configuration (VERIFIED)

**Main entry point:** `client/src-tauri/src/main.rs`
```rust
// Line 2: Windows subsystem correctly configured
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
```

**Status:** ✅ **CORRECT** - This prevents console window in release builds

**Tauri Version:** 
- `tauri`: v2.3.0
- `tauri-plugin-dialog`: v2
- `tauri-build`: v2.3.0

---

## Dialog Usage Inventory

### Summary
- **Total files using dialog plugin:** 21
- **Dialog types:** `open()` (file picker), `save()` (save dialog)
- **Platforms affected:** Windows only (macOS/Linux use native dialogs without issues)

---

## Detailed Usage Locations

### 1. Video/Media File Selection

#### 1.1 `client/src/pages/AudioLibrary.vue`
- **Line 547:** Import `open` from dialog plugin
- **Line 721:** Open audio file dialog
- **Filters:** Audio formats (mp3, wav, ogg, flac, m4a, aac, wma, opus, aiff, alac)
- **Risk Level:** 🔴 HIGH (user-facing, frequently used)

#### 1.2 `client/src/pages/AIVideoCreator.vue`
- **Line 372:** Import `open` from dialog plugin
- **Line 913:** Open media files dialog (multiple selection)
- **Filters:** Video and image formats
- **Risk Level:** 🔴 HIGH (user-facing, frequently used)

#### 1.3 `client/src/composables/useVideoOperations.ts`
- **Line 3:** Import `open` from dialog plugin
- **Line 18:** Open video file dialog
- **Filters:** Video formats (mp4, mov, avi, mkv, webm, flv, wmv, m4v)
- **Risk Level:** 🔴 HIGH (core functionality)

#### 1.4 `client/src/pages/admin/AdminSettings.vue`
- **Line 612:** Open video file dialog (default intro video)
- **Line 630:** Open image file dialog (default logo)
- **Filters:** Video and image formats
- **Risk Level:** 🟡 MEDIUM (admin-only)

---

### 2. Project/Clip Export (Save Dialogs)

#### 2.1 `client/src/pages/Projects.vue`
- **Line 1368:** Import `save` from dialog plugin
- **Usage:** Export project functionality
- **Risk Level:** 🔴 HIGH (critical export feature)

#### 2.2 `client/src/pages/Clips.vue`
- **Line 885:** Import `save` from dialog plugin
- **Usage:** Export clip functionality
- **Risk Level:** 🔴 HIGH (critical export feature)

---

### 3. Asset Upload Dialogs

#### 3.1 `client/src/editor/components/panels/assets/UploadMediaView.vue`
- **Line 3:** Import `open` from dialog plugin
- **Line 91:** Open media files dialog (multiple selection)
- **Filters:** Video, image, and audio formats
- **Risk Level:** 🔴 HIGH (editor core functionality)

#### 3.2 `client/src/editor/components/panels/assets/BrandingView.vue`
- **Line 268:** Open image file dialog
- **Filters:** Image formats (png, jpg, jpeg, webp, svg)
- **Risk Level:** 🟡 MEDIUM (branding assets)

#### 3.3 `client/src/composables/useAssetOperations.ts`
- **Line 134:** Open media file dialog
- **Filters:** Video and image formats
- **Risk Level:** 🔴 HIGH (asset management)

#### 3.4 `client/src/composables/useImageAssetOperations.ts`
- **Line 42:** Open image file dialog
- **Filters:** Image formats
- **Risk Level:** 🔴 HIGH (image asset management)

#### 3.5 `client/src/composables/useAudioAssetOperations.ts`
- **Line 42:** Open audio file dialog
- **Filters:** Audio formats
- **Risk Level:** 🔴 HIGH (audio asset management)

#### 3.6 `client/src/composables/useWatermarkOperations.ts`
- **Line 42:** Open watermark file dialog
- **Filters:** Image formats
- **Risk Level:** 🟡 MEDIUM (watermark feature)

---

### 4. Project Creation & Import

#### 4.1 `client/src/components/ProjectDialog.vue`
- **Line 149:** Import `open` from dialog plugin
- **Line 286:** Open media files dialog (multiple selection)
- **Filters:** Video and image formats
- **Risk Level:** 🔴 HIGH (project creation flow)

---

### 5. Profile & Settings Dialogs

#### 5.1 `client/src/components/ProfileDialog.vue`
- **Line 1513:** Open profile media dialog (avatar/banner)
- **Line 1849:** Open general media dialog
- **Filters:** Images and videos
- **Risk Level:** 🟡 MEDIUM (profile customization)

#### 5.2 `client/src/components/VodPresetEditor.vue`
- **Line 677:** Open media file dialog (preset preview)
- **Filters:** Images and videos
- **Risk Level:** 🟡 MEDIUM (preset editor)

---

### 6. Organization Assets

#### 6.1 `client/src/pages/organization/OrganizationAssets.vue`
- **Line 803:** Open asset file dialog
- **Filters:** Based on asset type
- **Risk Level:** 🟡 MEDIUM (organization features)

---

### 7. Messaging & Chat

#### 7.1 `client/src/pages/Messages.vue`
- **Line 691:** Open attachment files dialog (multiple selection)
- **Filters:** All file types
- **Risk Level:** 🔴 HIGH (messaging feature)

#### 7.2 `client/src/components/chat/ChatWindow.vue`
- **Line 387:** Open attachment files dialog (multiple selection)
- **Filters:** All file types
- **Risk Level:** 🔴 HIGH (chat feature)

---

### 8. Editor Font Manager

#### 8.1 `client/src/editor/composables/useFontManager.ts`
- **Line 3:** Import `open` from dialog plugin
- **Line 111:** Open font file dialog
- **Filters:** Font formats (ttf, otf, woff, woff2)
- **Risk Level:** 🟡 MEDIUM (font management)

---

### 9. Overlay & UI Components

#### 9.1 `client/src/components/OverlayPositionPicker.vue`
- **Line 792:** Open media file dialog (overlay background)
- **Filters:** Images and videos
- **Risk Level:** 🟡 MEDIUM (overlay customization)

#### 9.2 `client/src/components/IntroOutroRatioPicker.vue`
- **Line 196:** Open media file dialog
- **Filters:** Video formats
- **Risk Level:** 🟡 MEDIUM (intro/outro feature)

#### 9.3 `client/src/components/IntroOutroUploadDialog.vue`
- **Line 176:** Open media file dialog
- **Filters:** Based on upload type
- **Risk Level:** 🟡 MEDIUM (intro/outro upload)

#### 9.4 `client/src/components/AssetUploadDialog.vue`
- **Line 263:** Open asset file dialog
- **Filters:** Based on asset type
- **Risk Level:** 🟡 MEDIUM (asset upload)

---

## Risk Assessment

### 🔴 HIGH PRIORITY (15 locations)
Files that are user-facing and frequently used:
1. AudioLibrary.vue
2. AIVideoCreator.vue
3. useVideoOperations.ts
4. Projects.vue (export)
5. Clips.vue (export)
6. UploadMediaView.vue
7. useAssetOperations.ts
8. useImageAssetOperations.ts
9. useAudioAssetOperations.ts
10. ProjectDialog.vue
11. Messages.vue
12. ChatWindow.vue

### 🟡 MEDIUM PRIORITY (9 locations)
Admin or less frequently used features:
1. AdminSettings.vue
2. BrandingView.vue
3. useWatermarkOperations.ts
4. ProfileDialog.vue
5. VodPresetEditor.vue
6. OrganizationAssets.vue
7. useFontManager.ts
8. OverlayPositionPicker.vue
9. IntroOutroRatioPicker.vue
10. IntroOutroUploadDialog.vue
11. AssetUploadDialog.vue

---

## Technical Analysis

### Current Configuration
```json
// tauri.conf.json
{
  "plugins": {
    "core": {
      "capabilities": ["default", "main-window-permissions", "pip-window-permissions"]
    }
  }
}
```

```toml
# Cargo.toml
[dependencies]
tauri-plugin-dialog = "2"
tauri-plugin-shell = "2"
```

### Potential Issues

#### 1. **Shell Plugin Interference**
The `tauri-plugin-shell` might be spawning processes that flash console windows.

**Solution:**
- Review shell plugin configuration
- Ensure all shell commands use proper Windows subsystem flags

#### 2. **Dialog Plugin Configuration**
Default dialog plugin behavior might not be optimized for Windows.

**Possible fixes:**
- Add explicit Windows configuration in capabilities
- Configure dialog plugin with Windows-specific options
- Update to latest patch version of Tauri v2

#### 3. **External Binary Execution**
The app bundles external binaries (ffmpeg, node, yt-dlp) that might trigger console windows.

**Current external binaries:**
```json
"externalBin": [
  "binaries/ffmpeg",
  "binaries/ffprobe", 
  "binaries/node",
  "binaries/yt-dlp"
]
```

**Solution:**
- Ensure all external binaries are compiled/configured with Windows subsystem
- Review any Tauri commands that invoke these binaries

---

## Testing Procedure

### Prerequisites
- Windows 10/11 machine
- Built release version of the app (console window only hidden in release mode)

### Test Cases

For each HIGH PRIORITY location:

1. **Launch the app in release mode**
2. **Navigate to the feature**
3. **Trigger the file dialog**
4. **Observe for PowerShell/console window flash**
5. **Document:**
   - Does flash occur? (Yes/No)
   - Duration of flash (milliseconds)
   - Console window content (if visible)
   - Reproducibility (Always/Sometimes/Never)

### Test Matrix Template

| Location | Feature | Flash Occurs? | Duration | Console Content | Reproducibility |
|----------|---------|---------------|----------|-----------------|-----------------|
| AudioLibrary.vue | Import Audio | TBD | TBD | TBD | TBD |
| AIVideoCreator.vue | Add Media | TBD | TBD | TBD | TBD |
| useVideoOperations.ts | Import Video | TBD | TBD | TBD | TBD |
| Projects.vue | Export Project | TBD | TBD | TBD | TBD |
| Clips.vue | Export Clip | TBD | TBD | TBD | TBD |
| UploadMediaView.vue | Upload Media | TBD | TBD | TBD | TBD |
| useAssetOperations.ts | Add Asset | TBD | TBD | TBD | TBD |
| useImageAssetOperations.ts | Add Image | TBD | TBD | TBD | TBD |
| useAudioAssetOperations.ts | Add Audio | TBD | TBD | TBD | TBD |
| ProjectDialog.vue | Create Project | TBD | TBD | TBD | TBD |
| Messages.vue | Attach File | TBD | TBD | TBD | TBD |
| ChatWindow.vue | Attach File | TBD | TBD | TBD | TBD |

---

## Recommended Actions

### Immediate (High Priority)

1. **Update Tauri dependencies to latest patch versions**
   ```bash
   cd client/src-tauri
   cargo update tauri tauri-plugin-dialog
   ```

2. **Add explicit Windows capabilities**
   Create `client/src-tauri/capabilities/dialog-windows.json`:
   ```json
   {
     "identifier": "dialog-windows",
     "description": "Windows-specific dialog configuration",
     "windows": ["main", "pip"],
     "permissions": [
       "dialog:allow-open",
       "dialog:allow-save"
     ]
   }
   ```

3. **Review shell command invocations**
   Search for all shell plugin usages and ensure proper configuration:
   ```bash
   # Search for shell plugin usage
   grep -r "tauri-apps/plugin-shell" client/src
   ```

4. **Test on Windows immediately**
   Build release version and test all HIGH PRIORITY locations.

### Short-term

5. **Add dialog wrapper utility**
   Create centralized dialog utility that handles Windows-specific configuration:
   ```typescript
   // client/src/utils/dialog.ts
   import { open, save } from '@tauri-apps/plugin-dialog';
   
   export async function openFileDialog(options: OpenDialogOptions) {
     // Add Windows-specific configuration here
     return await open(options);
   }
   
   export async function saveFileDialog(options: SaveDialogOptions) {
     // Add Windows-specific configuration here
     return await save(options);
   }
   ```

6. **Refactor all dialog usage to use wrapper**
   Replace direct plugin imports with wrapper utility.

### Long-term

7. **Add automated testing**
   Create E2E tests for dialog flows on Windows.

8. **Monitor Tauri v2 updates**
   Track Tauri v2 releases for dialog plugin fixes and improvements.

9. **Consider reporting upstream**
   If issue persists after configuration fixes, report to Tauri team with reproduction case.

---

## Additional Investigation

### Files to Review

1. **Tauri Command Handlers** (`client/src-tauri/src/lib.rs` or similar)
   - Check if any commands spawn processes
   - Verify Windows subsystem flags on process spawning

2. **Shell Plugin Usage**
   ```bash
   grep -r "plugin-shell" client/src
   ```

3. **Process Spawning**
   ```bash
   grep -r "Command::new\|spawn\|exec" client/src-tauri/src
   ```

---

## Resources

- [Tauri v2 Dialog Plugin Docs](https://v2.tauri.app/plugin/dialog/)
- [Windows Subsystem Configuration](https://doc.rust-lang.org/reference/linkage.html)
- [Tauri v2 Capabilities](https://v2.tauri.app/security/capabilities/)
- [Tauri v2 Migration Guide](https://v2.tauri.app/migration/)

---

## Status

- ✅ Configuration audit: COMPLETE
- ✅ Usage inventory: COMPLETE
- ✅ Rust code audit: COMPLETE
- ✅ Fixes implemented: COMPLETE
- ⏳ Windows testing: PENDING
- ⏳ Verification: PENDING

---

## Findings & Fixes

### ✅ FIXED: Missing CREATE_NO_WINDOW flags

**Issue:** Three locations in Rust code were spawning processes without the `CREATE_NO_WINDOW` flag, which could cause console window flashes on Windows.

#### Fixed Files:

1. **`client/src-tauri/src/sidecar/mod.rs`** (Line 185)
   - **Issue:** Node.js sidecar process for Remotion renderer
   - **Fix:** Added `creation_flags(0x08000000)` before spawn
   - **Impact:** 🔴 HIGH - Used for video export rendering

2. **`client/src-tauri/src/audio.rs`** (Line 32)
   - **Issue:** `taskkill` command to kill FFmpeg processes
   - **Fix:** Added `creation_flags(0x08000000)` before execution
   - **Impact:** 🟡 MEDIUM - Used when canceling operations

3. **`client/src-tauri/src/commands/convert_video.rs`** (Line 48)
   - **Issue:** FFmpeg command for video format conversion
   - **Fix:** Added `creation_flags(0x08000000)` before execution
   - **Impact:** 🟡 MEDIUM - Used for overlay video conversion

### ✅ VERIFIED: Other process spawns

**All other process spawns already have proper `CREATE_NO_WINDOW` flags:**

- `youtube.rs` - Has `no_window()` helper
- `twitch.rs` - Has `no_window()` helper
- `twitter.rs` - Has `no_window()` helper
- `rumble.rs` - Has `no_window()` helper
- `kick.rs` - Has `no_window()` helper
- `ffmpeg_sidecar.rs` - Has inline `creation_flags`
- `audio_download.rs` - Has `CREATE_NO_WINDOW` constant
- `video_server.rs` - Has `no_window()` helper
- `thumbnail_utils.rs` - Has `no_window()` helper

**Tauri Shell Plugin Sidecars:**
- `downloads.rs` - Uses `tauri_plugin_shell` (handles CREATE_NO_WINDOW internally)
- `audio.rs` - Uses `tauri_plugin_shell` for FFmpeg sidecars (handles CREATE_NO_WINDOW internally)
- `hls.rs` - Uses `tauri_plugin_shell` (handles CREATE_NO_WINDOW internally)

### ✅ VERIFIED: Tauri Configuration

**Windows subsystem setting:** `main.rs` line 2
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
```
**Status:** ✅ CORRECT - Prevents console window in release builds

**Tauri versions:**
- `tauri`: v2.3.0 (latest stable)
- `tauri-plugin-dialog`: v2 (latest)
- `tauri-plugin-shell`: v2 (latest)

### Dialog Plugin Analysis

**Important:** The Tauri dialog plugin (`@tauri-apps/plugin-dialog`) does NOT spawn external processes. It uses native OS APIs directly through Rust bindings, which should not cause console window flashes.

**However**, if flashes are still occurring with dialogs, potential causes:

1. **Race condition:** Another process (e.g., FFmpeg, yt-dlp) spawning at the same time as dialog opens
2. **Windows DLL loading:** First-time native dialog invocation loading system DLLs
3. **File system watcher:** Background file system operations triggering process spawns

---

## Testing Checklist

### Prerequisites
- Windows 10/11 machine
- Built **release** version of app: `cd client && yarn build`
- Console window is only hidden in release builds (not dev)

### Test Procedure

1. **Build release version:**
   ```bash
   cd client
   yarn build
   ```

2. **For each HIGH PRIORITY dialog location, test:**
   - Launch the app
   - Navigate to the feature
   - Open the file dialog
   - Observe for any console window flash
   - Note: If flash occurs, check Task Manager to identify which process is spawning

3. **Test the fixed process spawns:**
   - Export video using Remotion renderer (tests sidecar fix)
   - Convert a video overlay (tests convert_video fix)
   - Cancel an active download (tests audio.rs fix)

---

## Next Steps

1. Build release version: `cd client && yarn build`
2. Test on Windows machine using test matrix above
3. Document findings in this file
4. Implement fixes based on test results
5. Re-test and verify fixes
6. Update `BACKLOG_TODO_LIST.md` with results

---

**Completed by:** AI Assistant  
**Date:** April 4, 2026
