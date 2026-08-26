import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

let initialized = false;

export function initCrashReporting(): void {
  if (initialized || !dsn) return;
  initialized = true;

  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    release: `clippster-mobile@${Constants.expoConfig?.version ?? '1.0.0'}`,
    enableAutoSessionTracking: true,
    tracesSampleRate: 0.1,
  });
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!dsn) {
    console.error('captureException', error, context);
    return;
  }
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
