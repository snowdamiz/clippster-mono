# FFmpeg Setup Script for Windows
Write-Host "FFmpeg Setup for Clippster Development" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

$ffmpegUrl = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl-shared.zip"
$downloadPath = "$env:TEMP\ffmpeg.zip"
$extractPath = "C:\ffmpeg"

# Check admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "WARNING: Not running as Administrator. Will set user environment variables." -ForegroundColor Yellow
}

$envTarget = if ($isAdmin) { "Machine" } else { "User" }

# Download FFmpeg
Write-Host "`nStep 1: Downloading FFmpeg..." -ForegroundColor Green
Invoke-WebRequest -Uri $ffmpegUrl -OutFile $downloadPath -UseBasicParsing
Write-Host "Download complete!" -ForegroundColor Green

# Extract
Write-Host "`nStep 2: Extracting FFmpeg..." -ForegroundColor Green
if (Test-Path $extractPath) {
    Remove-Item $extractPath -Recurse -Force
}
Expand-Archive -Path $downloadPath -DestinationPath "$env:TEMP\ffmpeg-temp" -Force
$extractedFolder = Get-ChildItem "$env:TEMP\ffmpeg-temp" | Select-Object -First 1
Move-Item $extractedFolder.FullName $extractPath -Force
Remove-Item "$env:TEMP\ffmpeg-temp" -Recurse -Force
Remove-Item $downloadPath -Force
Write-Host "Extraction complete!" -ForegroundColor Green

# Create pkg-config directory
Write-Host "`nStep 3: Creating pkg-config files..." -ForegroundColor Green
$pkgConfigDir = "$extractPath\lib\pkgconfig"
New-Item -ItemType Directory -Path $pkgConfigDir -Force | Out-Null

# Create pkg-config files
$libraries = @("libavutil", "libavcodec", "libavformat", "libavfilter", "libswscale", "libswresample")
foreach ($lib in $libraries) {
    $content = "prefix=$extractPath`nexec_prefix=`${prefix}`nlibdir=`${prefix}/lib`nincludedir=`${prefix}/include`n`nName: $lib`nDescription: FFmpeg library`nVersion: 6.0`nRequires:`nConflicts:`nLibs: -L`${libdir} -l$($lib.Replace('lib', ''))`nCflags: -I`${includedir}"
    Set-Content -Path "$pkgConfigDir\$lib.pc" -Value $content
}
Write-Host "pkg-config files created!" -ForegroundColor Green

# Set environment variables
Write-Host "`nStep 4: Setting environment variables..." -ForegroundColor Green
[Environment]::SetEnvironmentVariable("FFMPEG_DIR", $extractPath, $envTarget)
[Environment]::SetEnvironmentVariable("PKG_CONFIG_PATH", "$extractPath\lib\pkgconfig", $envTarget)

$currentPath = [Environment]::GetEnvironmentVariable("Path", $envTarget)
$ffmpegBin = "$extractPath\bin"
if ($currentPath -notlike "*$ffmpegBin*") {
    $newPath = $currentPath + ";" + $ffmpegBin
    [Environment]::SetEnvironmentVariable("Path", $newPath, $envTarget)
}

# Update current session
$env:FFMPEG_DIR = $extractPath
$env:PKG_CONFIG_PATH = "$extractPath\lib\pkgconfig"
$env:Path = $env:Path + ";" + $ffmpegBin

Write-Host "Environment variables set!" -ForegroundColor Green

# Verify
Write-Host "`nStep 5: Verifying installation..." -ForegroundColor Green
$version = & "$extractPath\bin\ffmpeg.exe" -version 2>&1 | Select-Object -First 1
Write-Host $version -ForegroundColor Gray

Write-Host "`n=======================================" -ForegroundColor Cyan
Write-Host "FFmpeg Setup Complete!" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "`nIMPORTANT: Close this terminal and open a NEW one for changes to take effect!" -ForegroundColor Yellow
Write-Host "`nNext steps:" -ForegroundColor White
Write-Host "1. Open a NEW terminal" -ForegroundColor White
Write-Host "2. Uncomment video renderer in Cargo.toml and lib.rs" -ForegroundColor White
Write-Host "3. Run: yarn dev" -ForegroundColor White
