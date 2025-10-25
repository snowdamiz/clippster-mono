#!/bin/bash
set -e

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ]; then
    BINARY_NAME="ffmpeg-x86_64-apple-darwin"
elif [ "$ARCH" = "arm64" ]; then
    BINARY_NAME="ffmpeg-aarch64-apple-darwin"
else
    echo "Unsupported architecture: $ARCH"
    exit 1
fi

# Create binaries directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BINARIES_DIR="$SCRIPT_DIR/binaries"
mkdir -p "$BINARIES_DIR"

FFMPEG_PATH="$BINARIES_DIR/$BINARY_NAME"

# Check if already exists
if [ -f "$FFMPEG_PATH" ]; then
    echo "ffmpeg already exists at: $FFMPEG_PATH"
    exit 0
fi

echo "Downloading ffmpeg for macOS ($ARCH)..."
FFMPEG_URL="https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip"
TEMP_ZIP="/tmp/ffmpeg.zip"
TEMP_DIR="/tmp/ffmpeg-extract"

# Download
curl -L "$FFMPEG_URL" -o "$TEMP_ZIP"

# Extract
echo "Extracting ffmpeg..."
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"
unzip -q "$TEMP_ZIP" -d "$TEMP_DIR"

# Copy to binaries directory with correct name
cp "$TEMP_DIR/ffmpeg" "$FFMPEG_PATH"
chmod +x "$FFMPEG_PATH"

# Cleanup
rm -f "$TEMP_ZIP"
rm -rf "$TEMP_DIR"

echo "ffmpeg successfully downloaded to: $FFMPEG_PATH"
ls -lh "$FFMPEG_PATH"
