import Constants from 'expo-constants';
import { Platform } from 'react-native';

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

/**
 * On Android emulators, localhost is the emulator itself — not the dev machine
 * running Phoenix. Rewrite loopback hosts to the emulator's host alias.
 */
function resolveDevApiUrl(url: string): string {
  if (!__DEV__ || Platform.OS !== 'android') {
    return url;
  }

  return url
    .replace(/\/\/localhost(?=[:/]|$)/i, '//10.0.2.2')
    .replace(/\/\/127\.0\.0\.1(?=[:/]|$)/, '//10.0.2.2');
}

export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) {
    return stripTrailingSlash(resolveDevApiUrl(fromEnv));
  }

  if (__DEV__) {
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:4000/api';
    }
    return 'http://localhost:4000/api';
  }

  return 'https://api.clippster.app/api';
}

/** Phoenix port parsed from the configured API URL (default 4000). */
export function getDevServerPort(): number {
  try {
    const port = new URL(getApiBaseUrl()).port;
    return port ? Number(port) : 4000;
  } catch {
    return 4000;
  }
}

export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? '0.1.0';
}
