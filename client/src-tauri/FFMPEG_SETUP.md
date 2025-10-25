# FFmpeg Bundling Setup

This Tauri app bundles ffmpeg so users don't need to install it separately.

## Setup Instructions

### Windows

Run the PowerShell script to download ffmpeg:

```powershell
cd client/src-tauri
.\download-ffmpeg.ps1
```

This will download and extract ffmpeg to `client/src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe`

### macOS

Run the shell script to download ffmpeg (automatically detects Intel vs Apple Silicon):

```bash
cd client/src-tauri
chmod +x download-ffmpeg.sh
./download-ffmpeg.sh
```

This will download ffmpeg to:
- Intel Macs: `binaries/ffmpeg-x86_64-apple-darwin`
- Apple Silicon: `binaries/ffmpeg-aarch64-apple-darwin`

### Linux

Download static build from https://johnvansickle.com/ffmpeg/

```bash
cd client/src-tauri
mkdir -p binaries
wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
tar -xf ffmpeg-release-amd64-static.tar.xz
mv ffmpeg-*-amd64-static/ffmpeg binaries/ffmpeg-x86_64-unknown-linux-gnu
chmod +x binaries/ffmpeg-x86_64-unknown-linux-gnu
```

## Using ffmpeg in your Rust code

Use Tauri's sidecar API to access the bundled ffmpeg:

```rust
use tauri::Manager;

#[tauri::command]
async fn run_ffmpeg(app: tauri::AppHandle, args: Vec<String>) -> Result<String, String> {
    let sidecar = app.shell().sidecar("ffmpeg")
        .map_err(|e| e.to_string())?;
    
    let output = sidecar
        .args(args)
        .output()
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
```

## Build Process

When you build the Tauri app:

1. The `build.rs` script checks for the ffmpeg binary
2. If found, Tauri bundles it into the installer/app bundle
3. At runtime, access it via `app.shell().sidecar("ffmpeg")`

The bundled binary will be extracted to the appropriate location based on the platform.
