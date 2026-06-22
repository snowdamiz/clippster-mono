import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { AuthResult, AuthUser } from '@clippster/shared-types';
import { getApiBaseUrl } from '@/lib/config';
import { saveAuthSession } from './authStorage';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CALLBACK_PATH = 'auth/google/callback';

export function getGoogleRedirectUri(): string {
  return Linking.createURL(GOOGLE_CALLBACK_PATH);
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

export async function startGoogleAuth(): Promise<AuthResult> {
  const redirectUri = getGoogleRedirectUri();
  const authUrl = `${getApiBaseUrl()}/auth/google?mobile=true&redirect_uri=${encodeURIComponent(redirectUri)}`;

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
