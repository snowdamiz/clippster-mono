# Mobile ship checklist (issue #660)

Replaces the stale Phase 0 checklist. Track production readiness for App Store / Play Store.

## P0 — Ship blockers

- [x] `organization_assets_cache` SQLite migration (009)
- [x] PostForMe OAuth for native (`return_mode: mobile` + poll after dismiss)
- [x] Wire `downloadCloudVod` for `pending://` media after cloud pull
- [x] Auto-queue cloud sync after downloads / imports / exports
- [x] Enforce Wi-Fi-only sync
- [x] EAS projectId `ccd1a52f-5004-4490-9dc1-78731281fe6a` + store compliance fields
- [x] Account deletion in Settings (`POST /subscription/deactivate`)
- [x] Privacy Policy + Terms links
- [x] Crash reporting via Sentry (`EXPO_PUBLIC_SENTRY_DSN`)
- [x] Tokend downloads, connect, and distribution platform
- [ ] Physical device E2E (TestFlight + internal Play) against production API
- [ ] Fill real ASC App ID / Apple Team ID / Play service account for `eas submit`

## P1 — Credible v1

- [x] Credits balance + block transcribe when insufficient + buy path
- [x] Cloud storage billing opens web checkout portal (no silent free tier upgrade)
- [x] Camera-roll import via `expo-image-picker`
- [x] Save / share exported MP4
- [x] Password reset flow
- [x] CI: lint + clip-export tests + mobile unit tests
- [x] Mobile unit tests (Tokend URL helpers, auth storage helpers)
- [ ] Authenticate progress WebSocket if server requires it

## Store submission

- [ ] Apple Developer + Google Play accounts ready
- [ ] Screenshots / privacy nutrition labels / reviewer notes
- [ ] Confirm EAS secrets (Sentry DSN, API URLs) — no secrets in source
- [ ] `eas build --profile production` + `eas submit` for both stores
