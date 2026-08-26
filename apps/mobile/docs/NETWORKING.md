# Environment & networking

## `EXPO_PUBLIC_API_URL`

| File | Purpose |
|------|---------|
| `.env.development` | Local Phoenix (`http://localhost:4000/api`) |
| `.env.staging` | Staging API |
| `.env.production` | `https://api.clippster.app/api` |

Expo loads `EXPO_PUBLIC_*` at bundle time. Restart Metro after changing env files.

## Local API from emulators

| Target | API base URL |
|--------|----------------|
| iOS Simulator | `http://localhost:4000/api` |
| Android Emulator | `http://10.0.2.2:4000/api` (host machine) |
| Physical device | Your machine LAN IP, e.g. `http://192.168.1.10:4000/api` |

`apps/mobile/src/lib/config.ts` falls back to `10.0.2.2` on Android when no env var is set in dev.

## CORS

React Native `fetch` is **not** subject to browser CORS. CORS in `server/lib/clippster_server_web/router.ex` mainly affects WebView OAuth and future web targets. `exp://` origins are allowlisted for Expo dev WebViews.

## EAS profiles

See `eas.json`:

- `development` — dev client, internal distribution
- `preview` — staging API
- `production` — production API
