# Code Signing Setup Guide

This guide walks you through setting up code signing for Clippster on **macOS** and **Windows**. Code signing is essential for:

- **macOS**: Preventing the "damaged and can't be opened" Gatekeeper error
- **Windows**: Avoiding SmartScreen warnings and building user trust
- **Auto-updates**: Tauri's updater requires signed binaries

---

## Table of Contents

1. [macOS Code Signing & Notarization](#macos-code-signing--notarization)
   - [Prerequisites](#macos-prerequisites)
   - [Step 1: Create a Developer ID Certificate](#step-1-create-a-developer-id-certificate)
   - [Step 2: Export the Certificate](#step-2-export-the-certificate)
   - [Step 3: Convert to Base64](#step-3-convert-to-base64)
   - [Step 4: Create App-Specific Password](#step-4-create-app-specific-password)
   - [Step 5: Find Your Team ID](#step-5-find-your-team-id)
   - [Step 6: Add GitHub Secrets](#step-6-add-github-secrets-macos)
2. [Windows Code Signing](#windows-code-signing)
   - [Prerequisites](#windows-prerequisites)
   - [Option A: EV Code Signing Certificate (Recommended)](#option-a-ev-code-signing-certificate-recommended)
   - [Option B: Standard Code Signing Certificate](#option-b-standard-code-signing-certificate)
   - [Step-by-Step Setup](#windows-step-by-step-setup)
3. [Tauri Update Signing](#tauri-update-signing)
4. [GitHub Secrets Reference](#github-secrets-reference)
5. [Troubleshooting](#troubleshooting)

---

## macOS Code Signing & Notarization

### macOS Prerequisites

- **Apple Developer Program membership** ($99/year) - [Enroll here](https://developer.apple.com/programs/enroll/)
- **A Mac** with Keychain Access (required for certificate export)
- **Xcode Command Line Tools** installed (`xcode-select --install`)

### Step 1: Create a Developer ID Certificate

1. Go to [Apple Developer Certificates](https://developer.apple.com/account/resources/certificates/list)

2. Click the **+** button to create a new certificate

3. Select **"Developer ID Application"** (NOT "Mac App Distribution")
   
   > ⚠️ **Important**: "Developer ID Application" is for apps distributed outside the App Store. This is what Tauri needs.

4. Follow the prompts to create a Certificate Signing Request (CSR):
   
   a. Open **Keychain Access** on your Mac
   
   b. Go to **Keychain Access > Certificate Assistant > Request a Certificate From a Certificate Authority**
   
   c. Enter your email and select **"Saved to disk"**
   
   d. Save the `.certSigningRequest` file

5. Upload the CSR to Apple Developer portal

6. Download the generated certificate (`.cer` file)

7. Double-click the `.cer` file to install it in Keychain Access

### Step 2: Export the Certificate

1. Open **Keychain Access**

2. In the left sidebar, select **"login"** keychain and **"My Certificates"** category

3. Find your certificate named **"Developer ID Application: Your Name (TEAM_ID)"**

4. Right-click the certificate and select **"Export"**

5. Choose **Personal Information Exchange (.p12)** format

6. Save the file (e.g., `certificate.p12`)

7. **Create a strong password** when prompted - you'll need this later
   
   > 💡 **Tip**: Save this password securely. You'll add it as `APPLE_CERTIFICATE_PASSWORD` in GitHub secrets.

### Step 3: Convert to Base64

The GitHub Actions workflow needs the certificate as a base64 string.

**On macOS/Linux:**

```bash
# Convert .p12 to base64
base64 -i certificate.p12 -o certificate-base64.txt

# Or output directly (for copying)
base64 -i certificate.p12 | pbcopy
```

**On Windows (PowerShell):**

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.p12")) | Set-Clipboard
```

> ⚠️ **Security**: Delete the `certificate.p12` and `certificate-base64.txt` files after adding to GitHub secrets. Never commit these to your repository.

### Step 4: Create App-Specific Password

Apple requires an app-specific password for notarization (2FA accounts).

1. Go to [Apple ID Account](https://appleid.apple.com/account/manage)

2. Sign in with your Apple ID

3. In the **Sign-In and Security** section, click **"App-Specific Passwords"**

4. Click **"Generate an app-specific password"**

5. Name it something like `"Clippster Notarization"`

6. **Copy the generated password** (format: `xxxx-xxxx-xxxx-xxxx`)

> 💡 This password is your `APPLE_PASSWORD` secret.

### Step 5: Find Your Team ID

Your Team ID is a 10-character alphanumeric string.

**Method 1: From Apple Developer Portal**

1. Go to [Apple Developer Membership](https://developer.apple.com/account#MembershipDetailsCard)
2. Your Team ID is displayed under your name

**Method 2: From the Certificate**

Look at your certificate name: `Developer ID Application: Your Name (ABCD1234EF)`

The part in parentheses (`ABCD1234EF`) is your Team ID.

**Method 3: Command Line**

```bash
security find-identity -v -p codesigning
```

### Step 6: Add GitHub Secrets (macOS)

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these secrets:

| Secret Name | Value |
|-------------|-------|
| `APPLE_CERTIFICATE` | Contents of `certificate-base64.txt` (the base64 string) |
| `APPLE_CERTIFICATE_PASSWORD` | Password you set when exporting the .p12 |
| `APPLE_ID` | Your Apple ID email (e.g., `developer@example.com`) |
| `APPLE_PASSWORD` | App-specific password from Step 4 |
| `APPLE_TEAM_ID` | Your 10-character Team ID |

---

## Windows Code Signing

### Windows Prerequisites

- **Code signing certificate** from a trusted Certificate Authority (CA)
- **Business registration** (most CAs require legal entity verification)

### Option A: EV Code Signing Certificate (Recommended)

**Extended Validation (EV) certificates** provide:
- Immediate SmartScreen reputation (no warning period)
- Hardware token security (required by CAs)
- Higher trust level

**Recommended CAs:**
- [DigiCert](https://www.digicert.com/signing/code-signing-certificates) (~$474/year)
- [Sectigo](https://sectigo.com/ssl-certificates-tls/code-signing) (~$319/year)
- [GlobalSign](https://www.globalsign.com/en/code-signing-certificate) (~$249/year)

### Option B: Standard Code Signing Certificate

**Standard (OV) certificates** are cheaper but:
- Require reputation building with SmartScreen
- May show warnings for first few thousand downloads
- Software-based (no hardware token required)

**Budget options:**
- [Certum](https://shop.certum.eu/code-signing-certificates/) (~$59/year for open source)
- [SSL.com](https://www.ssl.com/certificates/code-signing/) (~$249/year)

### Windows Step-by-Step Setup

#### For EV Certificates (Hardware Token)

EV certificates use hardware tokens (USB devices) that cannot be easily used in CI/CD. You have several options:

**Option 1: Cloud-Based Signing Services**

Use services that host your certificate securely:

- [Azure SignTool](https://github.com/vcsjones/AzureSignTool) with Azure Key Vault
- [DigiCert KeyLocker](https://www.digicert.com/signing/keylocker)
- [SSL.com eSigner](https://www.ssl.com/esigner/)

**Option 2: Self-Hosted Signing Server**

Run a signing server on a machine with the hardware token attached.

#### For Standard (OV) Certificates

1. **Purchase and download** your certificate from the CA

2. **Export as .pfx/.p12** if not already in that format:
   
   ```powershell
   # If you have separate .crt and .key files:
   openssl pkcs12 -export -out certificate.pfx -inkey private.key -in certificate.crt
   ```

3. **Convert to Base64:**
   
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.pfx")) | Set-Clipboard
   ```

4. **Update your workflow** to include Windows signing:
   
   ```yaml
   - name: Build Tauri App (Windows)
     if: matrix.platform == 'windows-latest'
     uses: tauri-apps/tauri-action@v0
     env:
       GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
       TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
       TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
       # Windows code signing (optional)
       WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERTIFICATE }}
       WINDOWS_CERTIFICATE_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
     with:
       projectPath: client
       args: ${{ matrix.args }}
   ```

5. **Add GitHub Secrets:**
   
   | Secret Name | Value |
   |-------------|-------|
   | `WINDOWS_CERTIFICATE` | Base64-encoded .pfx file |
   | `WINDOWS_CERTIFICATE_PASSWORD` | Password for the .pfx file |

#### Configure Tauri for Windows Signing

Add to `src-tauri/tauri.conf.json`:

```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "YOUR_CERTIFICATE_THUMBPRINT",
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com"
    }
  }
}
```

Or use environment variables (Tauri will auto-detect `WINDOWS_CERTIFICATE`).

---

## Tauri Update Signing

Tauri's auto-updater requires separate signing keys for update verification. This is **different from code signing** - it's for cryptographically verifying updates.

### Generate Update Signing Keys

```bash
# Using Tauri CLI
npm run tauri signer generate -- -w ~/.tauri/clippster.key
```

This creates:
- `clippster.key` - Private key (keep secret!)
- `clippster.key.pub` - Public key (embed in app)

### Add to GitHub Secrets

| Secret Name | Value |
|-------------|-------|
| `TAURI_SIGNING_PRIVATE_KEY` | Contents of `clippster.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password set during generation |

### Configure in tauri.conf.json

```json
{
  "plugins": {
    "updater": {
      "pubkey": "YOUR_PUBLIC_KEY_HERE"
    }
  }
}
```

---

## GitHub Secrets Reference

### Complete Secrets Checklist

| Secret | Platform | Required | Purpose |
|--------|----------|----------|---------|
| `APPLE_CERTIFICATE` | macOS | ✅ | Base64-encoded .p12 certificate |
| `APPLE_CERTIFICATE_PASSWORD` | macOS | ✅ | Password for .p12 file |
| `APPLE_ID` | macOS | ✅ | Apple ID email for notarization |
| `APPLE_PASSWORD` | macOS | ✅ | App-specific password |
| `APPLE_TEAM_ID` | macOS | ✅ | 10-character team identifier |
| `WINDOWS_CERTIFICATE` | Windows | ❌ | Base64-encoded .pfx certificate |
| `WINDOWS_CERTIFICATE_PASSWORD` | Windows | ❌ | Password for .pfx file |
| `TAURI_SIGNING_PRIVATE_KEY` | All | ✅ | Private key for update signing |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | All | ✅ | Password for signing key |
| `RELEASES_PAT` | All | ✅ | GitHub PAT for releases repo |

---

## Troubleshooting

### macOS Issues

#### "Clippster is damaged and can't be opened"

**Cause**: App is not code signed or notarized.

**Solutions**:
1. Verify `APPLE_CERTIFICATE` secret is correct (no extra whitespace/newlines)
2. Check GitHub Actions logs for signing errors
3. Temporary workaround for users:
   ```bash
   xattr -cr /Applications/Clippster.app
   ```

#### "The signature of the certificate could not be verified"

**Cause**: Certificate chain issue or revoked certificate.

**Solution**: Re-download and re-export your certificate from Apple Developer portal.

#### Notarization Failed

**Common causes**:
- Wrong `APPLE_PASSWORD` (use app-specific password, not account password)
- `APPLE_TEAM_ID` doesn't match certificate
- Certificate is not "Developer ID Application" type

**Debug command**:
```bash
xcrun notarytool log <submission-id> --apple-id YOUR_EMAIL --password YOUR_APP_SPECIFIC_PASSWORD --team-id YOUR_TEAM_ID
```

### Windows Issues

#### SmartScreen Warning

**Cause**: Standard OV certificates need to build reputation.

**Solutions**:
- Consider upgrading to EV certificate
- Wait for reputation to build (thousands of downloads)
- Submit to Microsoft for review: [Windows Defender Security Intelligence](https://www.microsoft.com/wdsi/filesubmission)

#### "Windows cannot verify the publisher"

**Cause**: Missing or invalid code signature.

**Solution**: Verify certificate is properly configured and not expired.

### General Issues

#### Update Signature Invalid

**Cause**: `TAURI_SIGNING_PRIVATE_KEY` doesn't match public key in app.

**Solution**: Regenerate keys and update both the secret and `tauri.conf.json`.

---

## Security Best Practices

1. **Never commit certificates** to your repository
2. **Rotate app-specific passwords** periodically
3. **Use separate certificates** for development and production
4. **Enable 2FA** on all Apple and Microsoft accounts
5. **Audit secret access** in GitHub repository settings
6. **Delete local certificate files** after adding to secrets

---

## Additional Resources

- [Tauri Code Signing Documentation](https://tauri.app/distribute/sign/)
- [Apple Developer ID Documentation](https://developer.apple.com/developer-id/)
- [Apple Notarization Documentation](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Microsoft Authenticode Documentation](https://docs.microsoft.com/en-us/windows/win32/seccrypto/cryptography-tools)
