# Enhanced build script for Tauri with FFmpeg support
# This script bypasses pkg-config by setting explicit paths

$ErrorActionPreference = "Stop"

$FFMPEG_ROOT = Join-Path $PSScriptRoot "ffmpeg-dev\ffmpeg-master-latest-win64-gpl-shared"
$INCLUDE_DIR = Join-Path $FFMPEG_ROOT "include"
$LIB_DIR = Join-Path $FFMPEG_ROOT "lib"
$BIN_DIR = Join-Path $FFMPEG_ROOT "bin"

# Set environment variables
$env:FFMPEG_DIR = $FFMPEG_ROOT
$env:FFMPEG_INCLUDE_DIR = $INCLUDE_DIR
$env:FFMPEG_LIB_DIR = $LIB_DIR

# Add include path to INCLUDE environment variable for MSVC
$env:INCLUDE = "$INCLUDE_DIR;$env:INCLUDE"
$env:LIB = "$LIB_DIR;$env:LIB"
$env:PATH = "$BIN_DIR;$env:PATH"

# Set VCPKG_ROOT to empty to avoid conflicts
$env:VCPKG_ROOT = ""

Write-Host "=== FFmpeg Build Configuration ===" -ForegroundColor Cyan
Write-Host "FFMPEG_DIR: $env:FFMPEG_DIR"
Write-Host "FFMPEG_INCLUDE_DIR: $env:FFMPEG_INCLUDE_DIR"
Write-Host "FFMPEG_LIB_DIR: $env:FFMPEG_LIB_DIR"
Write-Host ""

# Clean previous build artifacts
Write-Host "Cleaning previous build..." -ForegroundColor Yellow
cargo clean 2>&1 | Out-Null

Write-Host "Building with FFmpeg support..." -ForegroundColor Green
cargo build 2>&1 | Tee-Object -Variable buildOutput

$buildOutput | Out-String | Write-Host

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n=== Build Successful! ===" -ForegroundColor Green
    
    # Copy FFmpeg DLLs
    $TARGET_DIR = Join-Path $PSScriptRoot "target\debug"
    Write-Host "Copying FFmpeg DLLs to $TARGET_DIR..." -ForegroundColor Yellow
    
    Get-ChildItem "$BIN_DIR\*.dll" | ForEach-Object {
        Copy-Item $_.FullName $TARGET_DIR -Force
        Write-Host "  Copied: $($_.Name)" -ForegroundColor Gray
    }
    
    Write-Host "`n=== Setup Complete! ===" -ForegroundColor Green
    Write-Host "The professional playback engine is ready to use." -ForegroundColor Cyan
    Write-Host "Canvas playback will eliminate black screens during video transitions." -ForegroundColor Cyan
} else {
    Write-Host "`n=== Build Failed ===" -ForegroundColor Red
    Write-Host "Exit code: $LASTEXITCODE" -ForegroundColor Red
    exit 1
}
