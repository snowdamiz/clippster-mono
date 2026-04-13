#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAURI_ROOT="$(dirname "$SCRIPT_DIR")"
DIARIZE_DIR="$TAURI_ROOT/sidecars/diarize"
BINARIES_DIR="$TAURI_ROOT/binaries"

cd "$DIARIZE_DIR"
python3 -m pip install -r requirements.txt pyinstaller
pyinstaller --clean --noconfirm diarize.spec

BUILT="$DIARIZE_DIR/dist/diarize"
if [[ "$(uname -s)" == Darwin ]]; then
  BUILT="$DIARIZE_DIR/dist/diarize"
fi
if [[ ! -f "$BUILT" ]]; then
  echo "PyInstaller output not found at $BUILT" >&2
  exit 1
fi

mkdir -p "$BINARIES_DIR"
if [[ "$(uname -s)" == Darwin ]]; then
  if [[ "$(uname -m)" == arm64 ]]; then
    TRIPLE="aarch64-apple-darwin"
  else
    TRIPLE="x86_64-apple-darwin"
  fi
else
  TRIPLE="x86_64-unknown-linux-gnu"
fi

DEST="$BINARIES_DIR/diarize-$TRIPLE"
cp -f "$BUILT" "$DEST"
chmod +x "$DEST"
echo "Copied diarize sidecar to $DEST"
