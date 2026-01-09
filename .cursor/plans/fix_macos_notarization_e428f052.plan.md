---
name: Fix macOS Notarization
overview: The build failure is caused by a mismatch between your Apple Developer secrets. The APPLE_TEAM_ID doesn't match the team the APPLE_ID belongs to, or the credentials are incorrectly formatted.
todos:
  - id: verify-team-id
    content: Verify APPLE_TEAM_ID matches developer.apple.com Membership page
    status: pending
  - id: verify-apple-id
    content: Confirm APPLE_ID is a member of the team and matches certificate owner
    status: pending
  - id: regenerate-app-password
    content: Generate fresh App-Specific Password if current one is invalid
    status: pending
---

# Fix macOS Notarization 403 Error

## Root Cause

The error occurs during **notarization** (not code signing):

```javascript
HTTP status code: 403. Invalid or inaccessible developer team ID for the provided Apple ID.
```

This means the `APPLE_TEAM_ID` secret doesn't match the team that `APPLE_ID` is a member of.

## Required GitHub Secrets Verification

You need to verify these 5 secrets in your repository settings:| Secret | Expected Format | Where to Find It ||--------|-----------------|------------------|| `APPLE_CERTIFICATE` | Base64-encoded .p12 | Export from Keychain, then `base64 -i cert.p12` || `APPLE_CERTIFICATE_PASSWORD` | Password used when exporting .p12 | You set this when exporting || `APPLE_ID` | Email address | Your Apple Developer account email || `APPLE_PASSWORD` | App-Specific Password (16 chars like `xxxx-xxxx-xxxx-xxxx`) | Generated at appleid.apple.com -> Security -> App-Specific Passwords || `APPLE_TEAM_ID` | 10-character alphanumeric (e.g., `ABC123XYZ9`) | developer.apple.com -> Membership -> Team ID |

## Most Likely Issues

1. **Wrong Team ID** - Go to [Apple Developer Membership](https://developer.apple.com/account) and copy the exact Team ID from the Membership section
2. **App-Specific Password** - The `APPLE_PASSWORD` must be an App-Specific Password (NOT your Apple ID password):

- Go to https://appleid.apple.com/account/manage
- Sign in -> Security -> App-Specific Passwords -> Generate

3. **Account Mismatch** - The `APPLE_ID` email must be the account that:

- Is a member of the team with `APPLE_TEAM_ID`
- Generated the App-Specific Password in `APPLE_PASSWORD`
- Has the "Developer ID Application" certificate in `APPLE_CERTIFICATE`

## Action Required

This is not a workflow code fix - you need to verify your secrets:

1. Log into https://developer.apple.com/account
2. Go to **Membership** and copy your **Team ID** exactly
3. Update the `APPLE_TEAM_ID` secret in GitHub with this value
4. Ensure `APPLE_ID` is the email of an account that belongs to this team