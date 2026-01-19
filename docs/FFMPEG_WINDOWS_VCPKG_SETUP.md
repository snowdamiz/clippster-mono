# FFmpeg Setup for Windows (vcpkg Method)

## Problem

`ffmpeg-sys-next` (used by `ffmpeg-next`) has hardcoded `/usr/include` paths in its build script that cannot be overridden on Windows, even with environment variables. This causes compilation failures with the error:

```
fatal error: '/usr/include/libavcodec/avfft.h' file not found
```

## Solution: Use vcpkg

vcpkg is the officially supported method for installing FFmpeg on Windows for Rust projects.

## Setup Steps

### 1. Install vcpkg and FFmpeg

Run the automated setup script:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-vcpkg-ffmpeg.ps1
```

This script will:
- Clone vcpkg to `C:\vcpkg`
- Bootstrap vcpkg
- Install FFmpeg with all required components (takes 10-15 minutes)
- Set `VCPKG_ROOT` environment variable
- Integrate vcpkg with your system

### 2. Verify Installation

After the script completes, verify vcpkg is set up:

```powershell
$env:VCPKG_ROOT
# Should output: C:\vcpkg
```

### 3. Build Your Project

Open a **NEW terminal** and run:

```bash
cd c:\Users\brand\Documents\Dev\clippster-mono
yarn dev
```

The Rust compiler will now find FFmpeg through vcpkg automatically.

## How It Works

- vcpkg compiles FFmpeg from source with MSVC
- `ffmpeg-sys-next` detects vcpkg installation via `VCPKG_ROOT` environment variable
- Build script uses vcpkg's FFmpeg instead of trying to find system FFmpeg
- No manual path configuration needed

## Troubleshooting

### "Could not find Vcpkg tree"

Ensure `VCPKG_ROOT` environment variable is set:

```powershell
[Environment]::SetEnvironmentVariable("VCPKG_ROOT", "C:\vcpkg", "User")
```

Then restart your terminal.

### Build Still Fails

1. Ensure you're using a **NEW terminal** after running the setup script
2. Verify FFmpeg is installed: `C:\vcpkg\vcpkg list | Select-String ffmpeg`
3. Clean and rebuild: `cd client && cargo clean && yarn tauri dev`

## Alternative: Manual vcpkg Setup

If the script fails, you can set up vcpkg manually:

```powershell
# Clone vcpkg
git clone https://github.com/Microsoft/vcpkg.git C:\vcpkg
cd C:\vcpkg

# Bootstrap
.\bootstrap-vcpkg.bat

# Install FFmpeg
.\vcpkg install ffmpeg[core,avcodec,avdevice,avfilter,avformat,swresample,swscale]:x64-windows

# Set environment variable
[Environment]::SetEnvironmentVariable("VCPKG_ROOT", "C:\vcpkg", "User")

# Integrate
.\vcpkg integrate install
```

## For End Users

End users **do not** need vcpkg or any FFmpeg setup. The compiled application bundles all required FFmpeg DLLs automatically. This setup is only required for **development**.

## Next Steps

Once compilation succeeds, you can proceed with:
- Phase 2: GPU Rendering Pipeline (wgpu)
- Phase 3: Unified Compositor
- Phase 4: Text Rendering on GPU
- Phase 5: Vue Integration

See `docs/NATIVE_GPU_RENDERER_IMPLEMENTATION.md` for the full implementation plan.
