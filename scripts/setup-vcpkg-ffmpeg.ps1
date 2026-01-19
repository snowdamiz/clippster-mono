# Install vcpkg and FFmpeg for Rust FFmpeg bindings
Write-Host "Setting up vcpkg and FFmpeg..." -ForegroundColor Cyan

$vcpkgRoot = "C:\vcpkg"

# Clone vcpkg if not exists
if (-not (Test-Path $vcpkgRoot)) {
    Write-Host "Cloning vcpkg..." -ForegroundColor Green
    git clone https://github.com/Microsoft/vcpkg.git $vcpkgRoot
}

# Bootstrap vcpkg
Write-Host "Bootstrapping vcpkg..." -ForegroundColor Green
Set-Location $vcpkgRoot
.\bootstrap-vcpkg.bat

# Install FFmpeg
Write-Host "Installing FFmpeg via vcpkg (this will take 10-15 minutes)..." -ForegroundColor Yellow
.\vcpkg install ffmpeg[core,avcodec,avdevice,avfilter,avformat,swresample,swscale]:x64-windows

# Set environment variable
Write-Host "Setting VCPKG_ROOT environment variable..." -ForegroundColor Green
[Environment]::SetEnvironmentVariable("VCPKG_ROOT", $vcpkgRoot, "User")
$env:VCPKG_ROOT = $vcpkgRoot

# Integrate vcpkg
Write-Host "Integrating vcpkg..." -ForegroundColor Green
.\vcpkg integrate install

Write-Host "`nvcpkg and FFmpeg installed successfully!" -ForegroundColor Green
Write-Host "VCPKG_ROOT = $vcpkgRoot" -ForegroundColor Gray
Write-Host "`nNow you can build your Rust project with FFmpeg support." -ForegroundColor Yellow
