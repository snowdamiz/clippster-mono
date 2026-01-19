# FFmpeg Setup Script for Windows
# This script downloads and configures FFmpeg for Rust development

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "FFmpeg Setup for Clippster Development" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$ffmpegUrl = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl-shared.zip"
$downloadPath = "$env:TEMP\ffmpeg.zip"
$extractPath = "C:\ffmpeg"
$pkgConfigUrl = "https://sourceforge.net/projects/pkgconfiglite/files/0.28-1/pkg-config-lite-0.28-1_bin-win32.zip/download"
$pkgConfigDownload = "$env:TEMP\pkg-config.zip"
$pkgConfigPath = "C:\pkg-config"

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "⚠️  This script should be run as Administrator to set system environment variables." -ForegroundColor Yellow
    Write-Host "   However, it will continue and set user environment variables instead." -ForegroundColor Yellow
    Write-Host ""
}

# Step 1: Download FFmpeg
Write-Host "📥 Step 1: Downloading FFmpeg..." -ForegroundColor Green
try {
    if (Test-Path $downloadPath) {
        Remove-Item $downloadPath -Force
    }
    
    Write-Host "   Downloading from: $ffmpegUrl" -ForegroundColor Gray
    Invoke-WebRequest -Uri $ffmpegUrl -OutFile $downloadPath -UseBasicParsing
    Write-Host "   ✅ Download complete!" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Failed to download FFmpeg: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Extract FFmpeg
Write-Host ""
Write-Host "📦 Step 2: Extracting FFmpeg..." -ForegroundColor Green
try {
    if (Test-Path $extractPath) {
        Write-Host "   Removing existing FFmpeg installation..." -ForegroundColor Gray
        Remove-Item $extractPath -Recurse -Force
    }
    
    Write-Host "   Extracting to: $extractPath" -ForegroundColor Gray
    Expand-Archive -Path $downloadPath -DestinationPath "$env:TEMP\ffmpeg-temp" -Force
    
    # Find the extracted folder (it has a version-specific name)
    $extractedFolder = Get-ChildItem "$env:TEMP\ffmpeg-temp" | Select-Object -First 1
    Move-Item $extractedFolder.FullName $extractPath -Force
    
    # Clean up temp folder
    Remove-Item "$env:TEMP\ffmpeg-temp" -Recurse -Force
    Remove-Item $downloadPath -Force
    
    Write-Host "   ✅ Extraction complete!" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Failed to extract FFmpeg: $_" -ForegroundColor Red
    exit 1
}

# Step 3: Download and install pkg-config
Write-Host ""
Write-Host "📥 Step 3: Downloading pkg-config..." -ForegroundColor Green
try {
    if (Test-Path $pkgConfigDownload) {
        Remove-Item $pkgConfigDownload -Force
    }
    
    Write-Host "   Downloading pkg-config-lite..." -ForegroundColor Gray
    Invoke-WebRequest -Uri $pkgConfigUrl -OutFile $pkgConfigDownload -UseBasicParsing
    
    Write-Host "   Extracting pkg-config..." -ForegroundColor Gray
    if (Test-Path $pkgConfigPath) {
        Remove-Item $pkgConfigPath -Recurse -Force
    }
    
    Expand-Archive -Path $pkgConfigDownload -DestinationPath "$env:TEMP\pkg-config-temp" -Force
    $pkgConfigFolder = Get-ChildItem "$env:TEMP\pkg-config-temp" | Select-Object -First 1
    Move-Item $pkgConfigFolder.FullName $pkgConfigPath -Force
    
    # Clean up
    Remove-Item "$env:TEMP\pkg-config-temp" -Recurse -Force
    Remove-Item $pkgConfigDownload -Force
    
    Write-Host "   ✅ pkg-config installed!" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  pkg-config download failed, but continuing..." -ForegroundColor Yellow
    Write-Host "   You may need to install it manually if compilation fails." -ForegroundColor Yellow
}

# Step 4: Create pkg-config files for FFmpeg
Write-Host ""
Write-Host "📝 Step 4: Creating pkg-config files..." -ForegroundColor Green
try {
    $pkgConfigDir = "$extractPath\lib\pkgconfig"
    if (-not (Test-Path $pkgConfigDir)) {
        New-Item -ItemType Directory -Path $pkgConfigDir -Force | Out-Null
    }
    
    # Get FFmpeg version
    $ffmpegExe = "$extractPath\bin\ffmpeg.exe"
    $versionOutput = & $ffmpegExe -version 2>&1 | Select-Object -First 1
    $version = "6.0"  # Default version
    if ($versionOutput -match "ffmpeg version (\d+\.\d+)") {
        $version = $matches[1]
    }
    
    # Create libavutil.pc
    $libavutilPc = @"
prefix=$extractPath
exec_prefix=`${prefix}
libdir=`${prefix}/lib
includedir=`${prefix}/include

Name: libavutil
Description: FFmpeg utility library
Version: $version
Requires:
Conflicts:
Libs: -L`${libdir} -lavutil
Cflags: -I`${includedir}
"@
    
    Set-Content -Path "$pkgConfigDir\libavutil.pc" -Value $libavutilPc
    
    # Create similar files for other FFmpeg libraries
    $libraries = @("libavcodec", "libavformat", "libavfilter", "libswscale", "libswresample")
    foreach ($lib in $libraries) {
        $libPc = @"
prefix=$extractPath
exec_prefix=`${prefix}
libdir=`${prefix}/lib
includedir=`${prefix}/include

Name: $lib
Description: FFmpeg library
Version: $version
Requires: libavutil
Conflicts:
Libs: -L`${libdir} -l$($lib.Replace('lib', ''))
Cflags: -I`${includedir}
"@
        Set-Content -Path "$pkgConfigDir\$lib.pc" -Value $libPc
    }
    
    Write-Host "   ✅ pkg-config files created!" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  Failed to create pkg-config files: $_" -ForegroundColor Yellow
}

# Step 5: Set Environment Variables
Write-Host ""
Write-Host "🔧 Step 5: Setting environment variables..." -ForegroundColor Green

$envTarget = if ($isAdmin) { "Machine" } else { "User" }

try {
    # Set FFMPEG_DIR
    [Environment]::SetEnvironmentVariable("FFMPEG_DIR", $extractPath, $envTarget)
    Write-Host "   ✅ FFMPEG_DIR = $extractPath" -ForegroundColor Green
    
    # Set PKG_CONFIG_PATH
    [Environment]::SetEnvironmentVariable("PKG_CONFIG_PATH", "$extractPath\lib\pkgconfig", $envTarget)
    Write-Host "   ✅ PKG_CONFIG_PATH = $extractPath\lib\pkgconfig" -ForegroundColor Green
    
    # Add to PATH
    $currentPath = [Environment]::GetEnvironmentVariable("Path", $envTarget)
    $ffmpegBin = "$extractPath\bin"
    $pkgConfigBin = "$pkgConfigPath\bin"
    
    if ($currentPath -notlike "*$ffmpegBin*") {
        $newPath = "$currentPath;$ffmpegBin"
        if (Test-Path $pkgConfigBin) {
            $newPath = "$newPath;$pkgConfigBin"
        }
        [Environment]::SetEnvironmentVariable("Path", $newPath, $envTarget)
        Write-Host "   ✅ Added to PATH: $ffmpegBin" -ForegroundColor Green
        if (Test-Path $pkgConfigBin) {
            Write-Host "   ✅ Added to PATH: $pkgConfigBin" -ForegroundColor Green
        }
    } else {
        Write-Host "   ℹ️  FFmpeg already in PATH" -ForegroundColor Cyan
    }
    
    # Update current session
    $env:FFMPEG_DIR = $extractPath
    $env:PKG_CONFIG_PATH = "$extractPath\lib\pkgconfig"
    $env:Path = "$env:Path;$ffmpegBin"
    if (Test-Path $pkgConfigBin) {
        $env:Path = "$env:Path;$pkgConfigBin"
    }
    
} catch {
    Write-Host "   ❌ Failed to set environment variables: $_" -ForegroundColor Red
    exit 1
}

# Step 6: Verify Installation
Write-Host ""
Write-Host "✅ Step 6: Verifying installation..." -ForegroundColor Green
try {
    $ffmpegVersion = & "$extractPath\bin\ffmpeg.exe" -version 2>&1 | Select-Object -First 1
    Write-Host "   $ffmpegVersion" -ForegroundColor Gray
    Write-Host "   ✅ FFmpeg is working!" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  Could not verify FFmpeg installation" -ForegroundColor Yellow
}

# Final Instructions
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ FFmpeg Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. CLOSE this PowerShell window" -ForegroundColor White
Write-Host "   2. OPEN A NEW PowerShell/Terminal window" -ForegroundColor White
Write-Host "   3. Navigate to your project: cd client" -ForegroundColor White
Write-Host "   4. Uncomment video renderer in Cargo.toml" -ForegroundColor White
Write-Host "   5. Uncomment video renderer in src/lib.rs" -ForegroundColor White
Write-Host "   6. Run: yarn dev" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  IMPORTANT: You MUST open a new terminal for environment variables to take effect!" -ForegroundColor Yellow
Write-Host ""
