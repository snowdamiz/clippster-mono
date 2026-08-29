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

## Google OAuth on Android emulator

Before our mobile OAuth work, Google sign-in already used `http://localhost:4000/api/auth/google/callback` (same as Tauri/desktop). That URI **must stay as `localhost`** — Google treats `127.0.0.1` and `10.0.2.2` as different redirect URIs and will return `redirect_uri_mismatch` or block private IPs.

The original problem was only **after** Google auth: the emulator browser hit `localhost:4000` on the device itself instead of your PC. Fix: **`adb reverse`**.

`yarn dev` runs `adb reverse tcp:4000 tcp:4000` when an Android emulator is connected. API calls still use `10.0.2.2`; only the Google OAuth callback uses `localhost`.

Ensure this redirect URI is in **Google Cloud Console** (likely already there for desktop dev):

```
http://localhost:4000/api/auth/google/callback
```

## CORS

React Native `fetch` is **not** subject to browser CORS. CORS in `server/lib/clippster_server_web/router.ex` mainly affects WebView OAuth and future web targets. `exp://` origins are allowlisted for Expo dev WebViews.

## EAS profiles

See `eas.json`:

- `development` — dev client, internal distribution
- `preview` — staging API
- `production` — production API
