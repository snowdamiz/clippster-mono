# FFmpeg Setup for Windows Development

## Quick Setup (5 minutes)

### 1. Download FFmpeg Development Libraries

Download the **FFmpeg shared build** from:
https://github.com/BtbN/FFmpeg-Builds/releases

**Specific file needed:**
`ffmpeg-n6.0-latest-win64-gpl-shared-6.0.zip`

### 2. Extract and Set Environment Variables

1. Extract the ZIP to: `C:\ffmpeg`
2. Add to your **System Environment Variables**:

```
FFMPEG_DIR=C:\ffmpeg
PKG_CONFIG_PATH=C:\ffmpeg\lib\pkgconfig
PATH=%PATH%;C:\ffmpeg\bin
```

### 3. Verify Installation

Open a **new** PowerShell window and run:
```powershell
ffmpeg -version
```

You should see FFmpeg version information.

### 4. Re-enable Video Renderer

In `client/src-tauri/Cargo.toml`, uncomment the video renderer dependencies:

```toml
# Native GPU video renderer dependencies
wgpu = "0.19"
ffmpeg-next = "6.1"
lru = "0.12"
parking_lot = "0.12"
image = "0.24"
pollster = "0.3"
```

In `client/src-tauri/src/lib.rs`, uncomment:
```rust
mod video_renderer;
```

And re-enable the commands in the `.manage()` and `invoke_handler!` sections.

### 5. Build

```bash
yarn dev
```

---

## Alternative: Use vcpkg (More Complex)

If the above doesn't work, you can use vcpkg:

```powershell
# Install vcpkg
git clone https://github.com/Microsoft/vcpkg.git C:\vcpkg
cd C:\vcpkg
.\bootstrap-vcpkg.bat

# Install FFmpeg
.\vcpkg install ffmpeg:x64-windows

# Set environment variable
$env:VCPKG_ROOT="C:\vcpkg"
```

---

## For End Users (Production Builds)

**End users will NOT need to install FFmpeg manually.**

When you build the production app with `yarn tauri build`, the FFmpeg DLLs will be:
1. Bundled with the application installer
2. Automatically included in the app directory
3. No user setup required

The development setup is only needed for **you** to compile the Rust code during development.

---

## Troubleshooting

### Error: "pkg-config not found"

Install pkg-config for Windows:
```powershell
choco install pkgconfiglite
```

Or download from: http://ftp.gnome.org/pub/gnome/binaries/win32/dependencies/

### Error: "Cannot find libavutil"

Make sure `PKG_CONFIG_PATH` points to the correct location:
```powershell
$env:PKG_CONFIG_PATH="C:\ffmpeg\lib\pkgconfig"
```

### Still not working?

Use the "build from source" feature (takes 30+ minutes first time):
```toml
ffmpeg-next = { version = "6.1", features = ["build"] }
```

This will automatically download and compile FFmpeg during the Rust build.
