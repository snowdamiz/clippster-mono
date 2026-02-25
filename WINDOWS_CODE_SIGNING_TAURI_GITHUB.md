# Windows Code Signing for Tauri + GitHub Actions (Cheapest Reliable Path)

## What is the cheapest way to code-sign a Windows app so it avoids trust warnings?

The cheapest reliable option for a US-based developer is **Microsoft Azure Artifact Signing** (formerly "Trusted Signing"), at **$9.99/month** for the Basic plan.

It is a fully managed Microsoft cloud service and gives you:

- No hardware token/dongle required.
- Automatic short-lived certificates (no annual renewal hassle).
- Direct integration with `signtool.exe`, Visual Studio, and GitHub Actions.
- Signatures that Windows treats as highly trusted because issuance is Microsoft-backed.

This removes **"Unknown Publisher"** and gives a strong base for SmartScreen reputation. In many cases it reduces or avoids the blue **"Windows protected your PC"** prompt much faster than low-cost third-party cert options.

## Pricing

- **Basic**: `$9.99/month` for up to `5,000` signatures/month, then `$0.005` per extra signature.
- **Premium**: `$99.99/month` (only needed for heavy volume).

For many indie/small projects: about **$120/year** total.

## Availability and setup

- Available to individual developers in the **USA and Canada**.
- Identity verification is typically quick (ID + selfie in Azure portal).
- Quickstart docs: [Azure Artifact Signing Quickstart](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart)
- You can start with a free Azure account, then enable the paid signing service.

## Signing an `.exe`/`.msi`

```text
signtool sign /fd SHA256 /tr http://timestamp.acs.microsoft.com /td SHA256 /d "Your App Name" /v yourfile.exe
```

Azure handles certificate issuance/management when configured.

## Cheaper traditional alternatives (annual purchase model)

All providers now effectively operate on 1-year max validity windows.

| Provider / Type | Price (1 year) | Notes | Best for |
| --- | --- | --- | --- |
| SSL.com Code Signing (individual/OV) | ~$129 | Cloud signing (eSigner), easy for solo devs | Cheapest traditional option |
| Certum SimplySign (via resellers) | ~$119-$189 | Cloud signing, generally good feedback | Sometimes slightly cheaper |
| Sectigo / Comodo resellers | ~$212-$280 | Common and mature, but pricier | Standard enterprise preference |
| EV Code Signing (various sellers) | ~$280+ | Highest trust/reputation acceleration | Fastest reputation needs |

Avoid:

- Self-signed/free certs (will still trigger SmartScreen warnings).
- Unknown low-trust resellers with questionable root-chain trust.

## Quick tips to reduce SmartScreen warnings faster

- Always include RFC3161 timestamping (Azure or trusted timestamp authority).
- Submit signed installer samples to Microsoft Defender and optionally VirusTotal.
- Host downloads from clean HTTPS origins (GitHub Releases, your domain, etc.).

---

## Will this work for a Tauri app using GitHub Actions CI/CD?

Yes. This is one of the cleanest modern setups.

Best path: **post-build signing** in GitHub Actions with the Microsoft action.

- Keep Tauri build unchanged.
- Sign generated Windows artifacts after build.

## Recommended approach: post-build signing with official Azure GitHub Action

### 1) One-time Azure setup

Create:

- Artifact Signing account (Basic tier).
- Public Trust certificate profile.

Capture these values:

- `endpoint` (example: `https://eus.codesigning.azure.net/`)
- `signing-account-name`
- `certificate-profile-name`

### 2) Configure OIDC auth (recommended)

In Azure:

- Create/reuse App Registration.
- Add federated credentials for GitHub repo + branch/tag scope.
- Assign the **Artifact Signing Certificate Profile Signer** role to that app identity on the certificate profile.

### 3) GitHub Actions workflow snippet

```yaml
name: Release

on:
  push:
    tags: ["v*"]

permissions:
  contents: write
  id-token: write

jobs:
  release:
    strategy:
      matrix:
        platform: [macos-latest, ubuntu-22.04, windows-latest]

    runs-on: ${{ matrix.platform }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node & Rust
        uses: ./.github/actions/setup

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: ${{ github.ref }}
          releaseName: "Release ${{ github.ref }}"
          includeRelease: true

      - name: Azure Login (OIDC)
        if: matrix.platform == 'windows-latest'
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Sign Windows binaries with Azure Artifact Signing
        if: matrix.platform == 'windows-latest'
        uses: azure/artifact-signing-action@v1
        with:
          endpoint: https://eus.codesigning.azure.net/
          signing-account-name: your-account-name
          certificate-profile-name: your-profile-name
          files-folder: ./src-tauri/target/release/bundle/nsis
          files-folder-filter: exe,msi
          files-folder-recurse: true
          file-digest: SHA256
          timestamp-rfc3161: http://timestamp.acs.microsoft.com
          timestamp-digest: SHA256
          description: "Your App Name"
```

### What gets signed?

- NSIS installer `.exe`
- `.msi` installers (if generated)
- Any additional `.exe` you include via folder filters

If you ship raw binaries separately, add another signing step targeting `./src-tauri/target/release`.

## Alternative: sign during Tauri build with `trusted-signing-cli`

`src-tauri/tauri.conf.json`:

```json
{
  "bundle": {
    "windows": {
      "signCommand": "trusted-signing-cli -e https://eus.codesigning.azure.net/ -a your-account -c your-profile --file %1"
    }
  }
}
```

Workflow addition (Windows job):

```yaml
- name: Install trusted-signing-cli
  run: cargo install trusted-signing-cli

- name: Build (auto-signs)
  uses: tauri-apps/tauri-action@v0
```

## Final recommendation

For a US-based solo developer shipping a Tauri app with GitHub Actions:

1. Start with Azure Artifact Signing Basic (`$9.99/month`).
2. Use OIDC + `azure/artifact-signing-action` post-build signing.
3. Timestamp every signature.
4. Build SmartScreen reputation by distributing consistently signed releases.
