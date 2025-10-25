$ErrorActionPreference = "Stop"

# Create binaries directory
$binariesDir = Join-Path $PSScriptRoot "binaries"
New-Item -ItemType Directory -Force -Path $binariesDir | Out-Null

$ffmpegExe = Join-Path $binariesDir "ffmpeg-x86_64-pc-windows-msvc.exe"

# Check if already exists
if (Test-Path $ffmpegExe) {
    Write-Host "ffmpeg already exists at: $ffmpegExe"
    exit 0
}

Write-Host "Downloading ffmpeg for Windows..."
$ffmpegUrl = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
$zipFile = Join-Path $env:TEMP "ffmpeg.zip"
$extractDir = Join-Path $env:TEMP "ffmpeg-extract"

# Download
Invoke-WebRequest -Uri $ffmpegUrl -OutFile $zipFile -UseBasicParsing

# Extract
Write-Host "Extracting ffmpeg..."
Expand-Archive -Path $zipFile -DestinationPath $extractDir -Force

# Find ffmpeg.exe in extracted files
$ffmpegSource = Get-ChildItem -Path $extractDir -Recurse -Filter "ffmpeg.exe" | Select-Object -First 1

if ($null -eq $ffmpegSource) {
    Write-Error "Could not find ffmpeg.exe in downloaded archive"
    exit 1
}

# Copy to binaries directory with correct name
Copy-Item -Path $ffmpegSource.FullName -Destination $ffmpegExe

# Cleanup
Remove-Item -Path $zipFile -Force
Remove-Item -Path $extractDir -Recurse -Force

Write-Host "ffmpeg successfully downloaded to: $ffmpegExe"
Write-Host "File size: $((Get-Item $ffmpegExe).Length / 1MB) MB"
