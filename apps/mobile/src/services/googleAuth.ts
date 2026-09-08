import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import type { AuthResult, AuthUser } from '@clippster/shared-types';
import { getApiBaseUrl, getDevServerPort } from '@/lib/config';
import { saveAuthSession } from './authStorage';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CALLBACK_PATH = 'auth/google/callback';
/** Server only accepts clippster:// redirects for mobile=true mode. */
const NATIVE_REDIRECT_URI = 'clippster://auth/google/callback';

/**
 * Auth session runs in Chrome Custom Tabs. On Android emulators that must use
 * `localhost` + `adb reverse`, not `10.0.2.2` (RN fetch still uses getApiBaseUrl).
 */
function getAuthBrowserApiBaseUrl(): string {
  if (__DEV__ && Platform.OS === 'android') {
    return `http://localhost:${getDevServerPort()}/api`;
  }
  return getApiBaseUrl();
}

/** HTTP origin Google redirects to after sign-in (must be reachable from the device browser). */
export function getOAuthCallbackBase(): string {
  if (__DEV__ && Platform.OS === 'android') {
    // Must match the redirect URI registered in Google Cloud Console (localhost, not
    // 127.0.0.1 or 10.0.2.2 — Google treats those as different URIs). yarn dev runs
    // `adb reverse` so emulator localhost reaches the host Phoenix server.
    return `http://localhost:${getDevServerPort()}`;
  }

  return getApiBaseUrl().replace(/\/api\/?$/, '');
}

export function getGoogleRedirectUri(): string {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/${GOOGLE_CALLBACK_PATH}`;
    }
    return Linking.createURL(GOOGLE_CALLBACK_PATH);
  }
  return NATIVE_REDIRECT_URI;
}

export function parseGoogleCallbackUrl(url: string): {
  token?: string;
  user?: AuthUser;
  error?: string;
} {
  const parsed = Linking.parse(url);
  const error = typeof parsed.queryParams?.error === 'string' ? parsed.queryParams.error : undefined;
  const token = typeof parsed.queryParams?.token === 'string' ? parsed.queryParams.token : undefined;
  const userParam = parsed.queryParams?.user;

  let user: AuthUser | undefined;
  if (typeof userParam === 'string') {
    try {
      user = JSON.parse(decodeURIComponent(userParam)) as AuthUser;
    } catch {
      try {
        user = JSON.parse(userParam) as AuthUser;
      } catch {
        user = undefined;
      }
    }
  }

  return { token, user, error };
}

/**
 * Starts Google OAuth.
 * - Web: full-page redirect (`web=true`) — same pattern as the landing app; avoids popup blockers.
 * - Native: system auth session with `clippster://` deep-link callback.
 *
 * Must be called synchronously from a user gesture (e.g. button onPress) with no
 * awaits/setState before this runs, or browsers will block the session.
 */
export async function startGoogleAuth(): Promise<AuthResult> {
  if (Platform.OS === 'web') {
    const origin = encodeURIComponent(window.location.origin);
    window.location.assign(`${getApiBaseUrl()}/auth/google?web=true&origin=${origin}`);
    // Page navigates away — never resolves.
    return new Promise<AuthResult>(() => {});
  }

  const redirectUri = NATIVE_REDIRECT_URI;
  const oauthCallbackBase = encodeURIComponent(getOAuthCallbackBase());
  const authUrl = `${getAuthBrowserApiBaseUrl()}/auth/google?mobile=true&redirect_uri=${encodeURIComponent(redirectUri)}&oauth_callback_base=${oauthCallbackBase}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

  if (result.type !== 'success' || !result.url) {
    return { success: false, error: 'Google sign-in was cancelled' };
  }

  const { token, user, error } = parseGoogleCallbackUrl(result.url);

  if (error) {
    return { success: false, error };
  }

  if (!token || !user) {
    return { success: false, error: 'Missing token from Google callback' };
  }

  await saveAuthSession(token, user, 'google');
  return { success: true, token, user };
}
