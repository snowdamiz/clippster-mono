# Mobile authentication

## Email + OTP

Email login uses the same Phoenix endpoints as desktop and landing:

- `POST /api/auth/email/login`
- `POST /api/auth/email/register`
- `POST /api/auth/email/verify-otp`

Tokens are stored in `expo-secure-store` under `auth_token`. On launch the app calls `GET /api/auth/me` to refresh the session.

## Google OAuth (mobile)

Mobile uses **server-hosted Google OAuth** with a deep-link callback — not Expo Go.

1. App opens `${API_URL}/auth/google?mobile=true&redirect_uri=clippster://auth/google/callback`
2. User signs in with Google in the system browser (`expo-web-browser`)
3. Phoenix completes OAuth and redirects to `clippster://auth/google/callback?token=...&user=...`
4. App parses the URL and stores the JWT in SecureStore

### Redirect URI

Generated with `Linking.createURL('auth/google/callback')` (scheme `clippster` from `app.config.ts`).

The server only allows `clippster://` redirect URIs whose path includes `google` (see `OAuthCallbackTarget.normalize_mobile_redirect_uri/1`).

### Dev builds required

Google OAuth and SecureStore require a **development client** build (`expo-dev-client`). Expo Go is not supported.

## Logout

Logout clears SecureStore keys (`auth_token`, `user`, `auth_provider`) and resets navigation to the login screen. API `401` responses also clear the session via the api-client interceptor.
