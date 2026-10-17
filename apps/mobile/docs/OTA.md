# Mobile OTA updates (EAS Update)

Push JavaScript / asset changes to installed apps without rebuilding the native binary.

## Automatic publish (release branch)

Merging `main` into `release` runs `.github/workflows/release.yml`, which deploys server/landing/desktop **and** publishes a mobile OTA:

```text
deploy-mobile-ota → eas update --channel production --environment production
```

Requires the `EXPO_TOKEN` GitHub Actions secret (Expo personal access token from https://expo.dev/settings/access-tokens).

## Requirements

- Native binary built with `expo-updates` and matching `runtimeVersion`
- `runtimeVersion` policy is **`appVersion`** — OTA targets `version` in `app.config.ts` (currently `1.0.0`)
- Native / Expo module changes still need a new APK / store build; bump `version` when you ship that build

## Channels

| Channel | Who gets it | Typical build |
|---------|-------------|----------------|
| `production` | Sideload / store production builds | Local release APK, EAS `production` |
| `preview` | Staging / internal QA | EAS `preview` (APK) |
| `development` | Dev client only (updates disabled in app config) | EAS `development` |

EAS project: `@120356aa/clippster` (`ccd1a52f-5004-4490-9dc1-78731281fe6a`).

Local Gradle / sideload builds bake the channel via `updates.requestHeaders["expo-channel-name"]` (defaults to `production`). Override with `UPDATE_CHANNEL=preview` when prebuilding.

## Manual publish

From the repo root (must be logged in: `eas whoami`):

```bash
yarn mobile:update:production -- --message "Fix download error"
yarn mobile:update:preview -- --message "QA: captions polish"
```

## Sideload APK

Current OTA-capable APK:

https://github.com/snowdamiz/clippster-mono/releases/download/mobile-v1.0.0/Clippster-mobile-1.0.0.apk

Release page: https://github.com/snowdamiz/clippster-mono/releases/tag/mobile-v1.0.0

1. Install that APK
2. Merge to `release` (or publish manually) for JS updates
3. Open the app → **Check for updates** / restart when prompted

## Config reference

| File | Role |
|------|------|
| `apps/mobile/app.config.ts` | `updates.url`, `runtimeVersion`, channel headers |
| `apps/mobile/eas.json` | Build profile → channel mapping |
| `apps/mobile/src/services/appUpdates.ts` | Check / fetch / reload UX |
| `.github/workflows/release.yml` (`deploy-mobile-ota`) | Auto-publish on `release` pushes |
