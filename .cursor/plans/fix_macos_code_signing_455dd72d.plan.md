---
name: Fix macOS Code Signing
overview: ""
todos:
  - id: add-secrets
    content: Add APPLE_CERTIFICATE and APPLE_CERTIFICATE_PASSWORD secrets to GitHub repo
    status: pending
  - id: update-workflow
    content: Update release.yml to include APPLE_CERTIFICATE and APPLE_CERTIFICATE_PASSWORD env vars
    status: pending
---

# Fix macOS "Clippster is damaged" Error

## Problem

The macOS production build fails to open because the app is not code signed. macOS Gatekeeper blocks unsigned/unnotarized apps downloaded from the internet with the "damaged and can't be opened" error.

## Root Cause

The GitHub Actions workflow is missing the required environment variables for macOS code signing:

- `APPLE_CERTIFICATE` - Base64-encoded .p12 certificate file
- `APPLE_CERTIFICATE_PASSWORD` - Password for the .p12 certificate

Without these, the app cannot be code signed, and without code signing, notarization cannot occur.

## Solution

### Step 1: Create and Export Apple Signing Certificate

1. Create a "Developer ID Application" certificate from your [Apple Developer account](https://developer.apple.com/account/resources/certificates/list)
2. Export the certificate as a .p12 file from Keychain Access on a Mac
3. Convert to base64: `openssl base64 -in certificate.p12 -out certificate-base64.txt`

### Step 2: Add GitHub Secrets

Add these secrets to your GitHub repository:| Secret | Description |

|--------|-------------|

| `APPLE_CERTIFICATE` | Contents of certificate-base64.txt |

| `APPLE_CERTIFICATE_PASSWORD` | Password used when exporting .p12 |

### Step 3: Update Workflow

Modify [.github/workflows/release.yml](.github/workflows/release.yml) to add the missing environment variables to the macOS build step (lines 151-163):

```yaml
- name: Build Tauri App (macOS)
  if: matrix.platform == 'macos-latest'
  uses: tauri-apps/tauri-action@v0
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
    APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
  with:
    projectPath: client
    args: ${{ matrix.args }}
```



## Why This Fixes the Issue

- Local dev works because macOS doesn't quarantine locally-run apps
- Windows works because Windows doesn't require code signing like macOS
- Once `APPLE_CERTIFICATE` is provided, Tauri will:

1. Import the certificate to a temporary keychain
2. Code sign the app with the Developer ID certificate
3. Submit for notarization using APPLE_ID/PASSWORD/TEAM_ID
4. Staple the notarization ticket to the app