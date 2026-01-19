# LLVM/Clang Setup for FFmpeg Rust Bindings
Write-Host "Installing LLVM/Clang for FFmpeg bindings..." -ForegroundColor Cyan

$llvmUrl = "https://github.com/llvm/llvm-project/releases/download/llvmorg-17.0.1/LLVM-17.0.1-win64.exe"
$downloadPath = "$env:TEMP\llvm-installer.exe"
$installPath = "C:\Program Files\LLVM"

# Download LLVM
Write-Host "Downloading LLVM..." -ForegroundColor Green
Invoke-WebRequest -Uri $llvmUrl -OutFile $downloadPath -UseBasicParsing

# Install LLVM silently
Write-Host "Installing LLVM to $installPath..." -ForegroundColor Green
Start-Process -FilePath $downloadPath -ArgumentList "/S" -Wait

# Set environment variable
Write-Host "Setting LIBCLANG_PATH environment variable..." -ForegroundColor Green
$libclangPath = "$installPath\bin"
[Environment]::SetEnvironmentVariable("LIBCLANG_PATH", $libclangPath, "User")
$env:LIBCLANG_PATH = $libclangPath

# Add to PATH
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*$libclangPath*") {
    $newPath = $currentPath + ";" + $libclangPath
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    $env:Path = $env:Path + ";" + $libclangPath
}

# Clean up
Remove-Item $downloadPath -Force

Write-Host "`nLLVM/Clang installed successfully!" -ForegroundColor Green
Write-Host "LIBCLANG_PATH = $libclangPath" -ForegroundColor Gray
Write-Host "`nClose this terminal and open a NEW one, then run: yarn dev" -ForegroundColor Yellow
