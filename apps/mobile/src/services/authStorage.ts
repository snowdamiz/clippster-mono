import * as SecureStore from 'expo-secure-store';
import type { AuthUser } from '@clippster/shared-types';

const KEYS = {
  token: 'auth_token',
  user: 'user',
  provider: 'auth_provider',
} as const;

export type AuthProviderType = 'email' | 'google';

export async function getStoredToken(): Promise<string | null> {
  const token = await SecureStore.getItemAsync(KEYS.token);
  if (!token || token === 'null' || token === 'undefined') {
    return null;
  }
  return token;
}

export async function getStoredUser(): Promise<AuthUser | null> {
  const raw = await SecureStore.getItemAsync(KEYS.user);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export async function getStoredProvider(): Promise<AuthProviderType | null> {
  const provider = await SecureStore.getItemAsync(KEYS.provider);
  if (provider === 'email' || provider === 'google') {
    return provider;
  }
  return null;
}

export async function saveAuthSession(
  token: string,
  user: AuthUser,
  provider: AuthProviderType,
): Promise<void> {
  await SecureStore.setItemAsync(KEYS.token, token);
  await SecureStore.setItemAsync(KEYS.user, JSON.stringify(user));
  await SecureStore.setItemAsync(KEYS.provider, provider);
}

export async function clearAuthSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.token);
  await SecureStore.deleteItemAsync(KEYS.user);
  await SecureStore.deleteItemAsync(KEYS.provider);
}
