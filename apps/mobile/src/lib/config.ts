import Constants from 'expo-constants';
import { Platform } from 'react-native';

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) {
    return stripTrailingSlash(fromEnv);
  }

  if (__DEV__) {
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:4000/api';
    }
    return 'http://localhost:4000/api';
  }

  return 'https://api.clippster.app/api';
}

export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? '0.1.0';
}
