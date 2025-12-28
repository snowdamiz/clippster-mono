# Code Signing Setup Guide

This guide covers setting up code signing for macOS and Windows to distribute Clippster without security warnings.

---

## Apple Code Signing & Notarization

### Prerequisites

- **Apple Developer Account** ($99/year): https://developer.apple.com/programs/enroll/

### Step 1: Create Developer ID Certificate

1. Go to https://developer.apple.com/account/resources/certificates/list
2. Click the **+** button to create a new certificate
3. Select **"Developer ID Application"** (under Software section)
4. Follow the prompts to create a Certificate Signing Request (CSR):
   - Open **Keychain Access** on your Mac
   - Menu: **Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority**
   - Enter your email, leave CA Email empty, select "Saved to disk"
   - Upload this `.certSigningRequest` file to Apple
5. Download the certificate and double-click to install it in Keychain

### Step 2: Export Certificate as .p12

1. Open **Keychain Access**
2. Go to **My Certificates** (left sidebar)
3. Find **"Developer ID Application: Your Name (TEAM_ID)"**
4. Right-click → **Export**
5. Save as `.p12` format with a **strong password** (you'll need this password later)

### Step 3: Convert to Base64

Run in Terminal:

```bash
base64 -i ~/Desktop/Certificates.p12 | pbcopy
```

This copies the base64 string to your clipboard.

### Step 4: Create App-Specific Password

1. Go to https://appleid.apple.com/account/manage
2. Sign in with your Apple ID
3. Go to **Sign-In and Security → App-Specific Passwords**
4. Click **Generate an app-specific password**
5. Name it "Clippster Notarization"
6. **Save this password** - you'll only see it once!

### Step 5: Find Your Team ID

1. Go to https://developer.apple.com/account
2. Click **Membership Details** (left sidebar)
3. Your **Team ID** is a 10-character alphanumeric string

### Step 6: Add GitHub Secrets

Go to: `https://github.com/snowdamiz/clippster-mono/settings/secrets/actions`

Add these secrets:

| Secret Name                  | Value                                          |
| ---------------------------- | ---------------------------------------------- |
| `APPLE_CERTIFICATE`          | The base64 string from Step 3                  |
| `APPLE_CERTIFICATE_PASSWORD` | The password you set when exporting .p12       |
| `APPLE_ID`                   | Your Apple ID email (e.g., you@example.com)    |
| `APPLE_PASSWORD`             | App-specific password from Step 4              |
| `APPLE_TEAM_ID`              | Your 10-character Team ID from Step 5          |

---

## Windows Code Signing

### Option A: Skip for Now (Free)

Users will see SmartScreen warnings ("Windows protected your PC") but can click "More info" → "Run anyway". This is common for new/indie apps.

### Option B: Purchase a Certificate

**Certificate Providers** (prices vary, ~$70-300/year):

- **SSL.com** - https://www.ssl.com/certificates/ev-code-signing/ (cheapest EV option)
- **Sectigo** - https://sectigo.com/ssl-certificates-tls/code-signing
- **DigiCert** - https://www.digicert.com/signing/code-signing-certificates

**Types:**

- **Standard Code Signing** (~$70-200/year): Reduces warnings over time as your app builds reputation
- **EV Code Signing** (~$300-500/year): Immediate SmartScreen trust, requires hardware token or cloud signing

### Step 1: After Purchasing Certificate

You'll receive a `.pfx` file (or need to export it from your browser).

### Step 2: Convert to Base64

**PowerShell:**

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\certificate.pfx")) | Set-Clipboard
```

**Or Command Prompt:**

```cmd
certutil -encode certificate.pfx certificate.txt
```

Then open `certificate.txt` and copy the content between `-----BEGIN CERTIFICATE-----` and `-----END CERTIFICATE-----`.

### Step 3: Add GitHub Secrets

| Secret Name                      | Value                          |
| -------------------------------- | ------------------------------ |
| `WINDOWS_CERTIFICATE`            | The base64 string from Step 2  |
| `WINDOWS_CERTIFICATE_PASSWORD`   | Your .pfx password             |

---

## Summary Checklist

### Apple (Required for smooth macOS distribution)

- [ ] Apple Developer account enrolled
- [ ] Developer ID Application certificate created
- [ ] Certificate exported as .p12
- [ ] App-specific password generated
- [ ] All 5 secrets added to GitHub

### Windows (Optional but recommended)

- [ ] Code signing certificate purchased (or skip for now)
- [ ] Certificate converted to base64
- [ ] Both secrets added to GitHub

---

## Tauri Update Signing (Already Configured)

The Tauri update signing keys are separate from platform code signing. These are used to verify OTA updates are authentic.

| Secret Name                        | Purpose                    |
| ---------------------------------- | -------------------------- |
| `TAURI_SIGNING_PRIVATE_KEY`        | Signs OTA update packages  |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for the key     |

**Note:** These keys were generated with `yarn tauri signer generate` and are stored at:
- Private key: `~/.tauri/clippster.key`
- Public key: `~/.tauri/clippster.key.pub`

---

## Triggering a Release

1. Push to the `release` branch, OR
2. Manually trigger via GitHub Actions → Release → Run workflow

The workflow creates a **draft release** with all signed binaries.
