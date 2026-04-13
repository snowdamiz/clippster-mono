# Build PyInstaller diarize sidecar into client/src-tauri/binaries/
# Requires: Python 3.10+, pip, PyInstaller (`pip install pyinstaller`)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$TauriRoot = Split-Path -Parent $ScriptDir
$DiarizeDir = Join-Path $TauriRoot "sidecars/diarize"
$BinariesDir = Join-Path $TauriRoot "binaries"

if (-not (Test-Path $DiarizeDir)) {
    Write-Error "Missing diarize folder: $DiarizeDir"
}

New-Item -ItemType Directory -Force -Path $BinariesDir | Out-Null

Push-Location $DiarizeDir
try {
    python -m pip install -r requirements.txt pyinstaller
    pyinstaller --clean --noconfirm diarize.spec
} finally {
    Pop-Location
}

$Built = Join-Path $DiarizeDir "dist/diarize.exe"
if (-not (Test-Path $Built)) {
    Write-Error "PyInstaller did not produce dist/diarize.exe"
}

# Match Tauri externalBin naming (see youtube.rs get_target_triple)
$Triple = "x86_64-pc-windows-msvc"
$Dest = Join-Path $BinariesDir "diarize-$Triple.exe"
Copy-Item -Force $Built $Dest
Write-Host "Copied diarize sidecar to $Dest"
