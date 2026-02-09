# Build script for Tauri with FFmpeg support
$ErrorActionPreference = "Stop"

$FFMPEG_ROOT = Join-Path $PSScriptRoot "ffmpeg-dev\ffmpeg-master-latest-win64-gpl-shared"

# Set environment variables for ffmpeg-sys-next
$env:FFMPEG_DIR = $FFMPEG_ROOT
$env:FFMPEG_INCLUDE_DIR = Join-Path $FFMPEG_ROOT "include"
$env:FFMPEG_LIB_DIR = Join-Path $FFMPEG_ROOT "lib"
$env:PKG_CONFIG_PATH = Join-Path $FFMPEG_ROOT "lib\pkgconfig"

# Add FFmpeg bin to PATH for DLLs
$env:PATH = (Join-Path $FFMPEG_ROOT "bin") + ";" + $env:PATH

Write-Host "Building with FFmpeg support..." -ForegroundColor Green
Write-Host "FFMPEG_DIR: $env:FFMPEG_DIR" -ForegroundColor Cyan
Write-Host "FFMPEG_INCLUDE_DIR: $env:FFMPEG_INCLUDE_DIR" -ForegroundColor Cyan
Write-Host "FFMPEG_LIB_DIR: $env:FFMPEG_LIB_DIR" -ForegroundColor Cyan

# Build
cargo build

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nBuild successful!" -ForegroundColor Green
    
    # Copy FFmpeg DLLs to target directory
    $TARGET_DIR = Join-Path $PSScriptRoot "target\debug"
    $BIN_DIR = Join-Path $FFMPEG_ROOT "bin"
    
    Write-Host "`nCopying FFmpeg DLLs to target directory..." -ForegroundColor Yellow
    Copy-Item (Join-Path $BIN_DIR "*.dll") $TARGET_DIR -Force
    Write-Host "DLLs copied successfully!" -ForegroundColor Green
} else {
    Write-Host "`nBuild failed!" -ForegroundColor Red
    exit 1
}
