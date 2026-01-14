# Over-the-Air (OTA) Updates

This document describes the build and OTA update pipeline for the Clippster desktop application. The system uses Tauri's official updater plugin to deliver mandatory updates to users.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [How It Works](#how-it-works)
- [Release Workflow](#release-workflow)
- [Configuration](#configuration)
- [Required Secrets](#required-secrets)
- [Triggering an OTA Update](#triggering-an-ota-update)
- [User Experience](#user-experience)
- [Troubleshooting](#troubleshooting)

## Overview

Clippster uses **mandatory updates** - when a new version is available, users must install it before they can continue using the app. This ensures all users are on the latest version with the newest features and security patches.

### Key Features

- **Mandatory Updates**: Users cannot skip or defer updates
- **Automatic Detection**: App checks for updates on every startup
- **Signed Artifacts**: All updates are cryptographically signed for security
- **Cross-Platform**: Works on Windows and macOS
- **Progress Tracking**: Users see download progress during updates

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GitHub Actions                                  │
│                                                                             │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐   │
│  │  Build App for  │───▶│  Sign Artifacts  │───▶│  Generate latest.json│  │
│  │  Each Platform  │    │  with Private Key│    │  Upload to Release   │   │
│  └─────────────────┘    └──────────────────┘    └─────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GitHub Releases                                    │
│                                                                             │
│  • latest.json (update manifest)                                            │
│  • Clippster_x.x.x_x64-setup.nsis.zip + .sig (Windows)                     │
│  • Clippster_x.x.x_aarch64.app.tar.gz + .sig (macOS ARM)                   │
│  • Clippster_x.x.x_x64.app.tar.gz + .sig (macOS Intel)                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Desktop Application                                │
│                                                                             │
│  1. App starts                                                              │
│  2. Checks endpoint for latest.json                                         │
│  3. Compares current version vs available version                           │
│  4. If update available → Show blocking update dialog                       │
│  5. Download update with progress                                           │
│  6. Verify signature with public key                                        │
│  7. Install and restart                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## How It Works

### 1. Build Phase (CI/CD)

When code is pushed to the `release` branch or manually triggered:

1. GitHub Actions builds the app for each platform (Windows, macOS ARM, macOS Intel)
2. The `TAURI_SIGNING_PRIVATE_KEY` signs each update artifact
3. A `latest.json` manifest is generated with version info and download URLs
4. Everything is uploaded to a GitHub Release (as draft)

### 2. Distribution Phase

After reviewing the draft release:

1. Manually publish the GitHub Release
2. The `latest.json` becomes available at the configured endpoint
3. All signed artifacts are downloadable

### 3. Update Phase (Client)

When a user opens the app:

1. **Update Check**: App fetches `latest.json` from the endpoint
2. **Version Compare**: Compares `latest.json` version with current app version
3. **Blocking Dialog**: If newer version exists, shows mandatory update dialog
4. **Download**: User clicks "Update Now", downloads begin with progress
5. **Verification**: Signature is verified using the embedded public key
6. **Installation**: Update is installed automatically
7. **Restart**: App restarts with new version

## Release Workflow

### Step 1: Update Version

Edit `client/src-tauri/tauri.conf.json`:

```json
{
  "version": "0.2.0"  // Increment this
}
```

Also update `client/src-tauri/Cargo.toml` to match:

```toml
[package]
version = "0.2.0"
```

### Step 2: Commit and Push to Release Branch

```bash
git add .
git commit -m "Release v0.2.0"
git push origin release
```

### Step 3: Wait for CI/CD

GitHub Actions will:
- Build for all platforms
- Sign all artifacts
- Create a draft release with `latest.json`

### Step 4: Review and Publish

1. Go to GitHub Releases
2. Review the draft release
3. Edit release notes if needed
4. Click "Publish release"

### Step 5: Users Get Updated

- Existing users will see the update dialog on next app launch
- New users download the latest version directly

## Configuration

### `tauri.conf.json` Updater Configuration

```json
{
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6...",
      "endpoints": [
        "https://github.com/snowdamiz/clippster-mono/releases/latest/download/latest.json"
      ]
    }
  },
  "bundle": {
    "createUpdaterArtifacts": true
  }
}
```

| Field | Description |
|-------|-------------|
| `pubkey` | Public key for verifying signatures (generated with `tauri signer generate`) |
| `endpoints` | URLs to check for `latest.json` |
| `createUpdaterArtifacts` | Enables generation of update bundles (.tar.gz, .zip) |

### Capabilities (`capabilities/default.json`)

```json
{
  "permissions": [
    "updater:default",
    "process:allow-restart"
  ]
}
```

## Required Secrets

Configure these in GitHub repository settings under **Settings → Secrets and variables → Actions**:

| Secret | Required | Description |
|--------|----------|-------------|
| `TAURI_SIGNING_PRIVATE_KEY` | **Yes** | Private key for signing updates |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | If encrypted | Password to decrypt the private key |
| `APPLE_ID` | For notarization | Apple Developer email |
| `APPLE_PASSWORD` | For notarization | App-specific password |
| `APPLE_TEAM_ID` | For notarization | Apple Developer Team ID |
| `WINDOWS_CERTIFICATE` | For signing | Windows code signing certificate (base64) |
| `WINDOWS_CERTIFICATE_PASSWORD` | For signing | Certificate password |

### Generating Signing Keys

```bash
# Generate a new key pair
cd client
npx tauri signer generate -w ~/.tauri/clippster.key

# Output:
# - Private key saved to ~/.tauri/clippster.key
# - Public key displayed (copy to tauri.conf.json pubkey field)
# - Set private key as TAURI_SIGNING_PRIVATE_KEY secret
```

## Triggering an OTA Update

### For Developers

1. **Bump the version** in `tauri.conf.json` and `Cargo.toml`
2. **Push to release branch**:
   ```bash
   git checkout release
   git merge main
   git push
   ```
3. **Or trigger manually**: Go to Actions → Release → Run workflow

### What Gets Built

| Platform | Target | Artifacts |
|----------|--------|-----------|
| Windows | x64 | `.nsis.zip`, `.msi.zip` + signatures |
| macOS | aarch64 (ARM) | `.app.tar.gz` + signature |
| macOS | x86_64 (Intel) | `.app.tar.gz` + signature |

### The `latest.json` Format

```json
{
  "version": "0.2.0",
  "notes": "See assets to download and install.",
  "pub_date": "2024-01-15T12:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "url": "https://github.com/.../Clippster_0.2.0_aarch64.app.tar.gz",
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6..."
    },
    "darwin-x86_64": {
      "url": "https://github.com/.../Clippster_0.2.0_x64.app.tar.gz",
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6..."
    },
    "windows-x86_64": {
      "url": "https://github.com/.../Clippster_0.2.0_x64-setup.nsis.zip",
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6..."
    }
  }
}
```

## User Experience

### Update Flow

1. **App Launch**: User opens Clippster
2. **Checking**: "Checking for updates..." screen appears
3. **Update Found**: Dialog shows new version and release notes
4. **Mandatory Notice**: User sees "This update is required to continue using Clippster"
5. **Download**: User clicks "Update Now", progress bar shows download status
6. **Install**: "Installing Update..." message appears
7. **Restart**: App automatically restarts with new version

### Key UX Decisions

- **No Skip Button**: Updates are mandatory
- **No Defer Option**: Cannot postpone to later
- **Blocks App**: Cannot access any features until updated
- **Auto-Restart**: App restarts automatically after install

## Troubleshooting

### Update Check Fails

**Symptoms**: App shows error or continues without checking

**Solutions**:
1. Check internet connectivity
2. Verify the endpoint URL in `tauri.conf.json` is correct
3. Ensure the GitHub release is published (not draft)
4. Check if `latest.json` exists in the release

### Signature Verification Fails

**Symptoms**: Download completes but installation fails

**Solutions**:
1. Verify `pubkey` in `tauri.conf.json` matches the key used to sign
2. Ensure `TAURI_SIGNING_PRIVATE_KEY` secret is correct
3. Re-generate signing keys if compromised

### Build Fails in CI

**Symptoms**: GitHub Actions workflow fails

**Solutions**:
1. Check that all required secrets are set
2. Verify Rust toolchain targets are installed
3. Check for compilation errors in the Rust code
4. Ensure frontend builds successfully

### macOS Notarization Issues

**Symptoms**: macOS users see "app is damaged" or security warnings

**Solutions**:
1. Ensure Apple Developer secrets are configured
2. Verify Apple Team ID is correct
3. Check that the app identifier matches Apple Developer settings

### Windows SmartScreen Warnings

**Symptoms**: Windows shows "Unknown publisher" warning

**Solutions**:
1. Configure Windows code signing certificate
2. Submit app to Microsoft for reputation (takes time)
3. Users can click "More info" → "Run anyway"

## Files Reference

| File | Purpose |
|------|---------|
| `client/src-tauri/tauri.conf.json` | Updater configuration |
| `client/src-tauri/Cargo.toml` | Rust dependencies including updater plugin |
| `client/src-tauri/capabilities/default.json` | Permissions for updater |
| `client/src-tauri/src/lib.rs` | Plugin registration |
| `client/src/composables/useAppUpdater.ts` | Frontend update logic |
| `client/src/components/MandatoryUpdateDialog.vue` | Update UI |
| `client/src/App.vue` | Update check integration |
| `.github/workflows/release.yml` | CI/CD pipeline |

