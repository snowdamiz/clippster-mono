import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { AuthUser } from '@clippster/shared-types';
import { useAuth } from '@/context/AuthContext';
import { tokens } from '@/theme/tokens';

/**
 * Web Google OAuth return URL.
 * Server redirects here with ?token=&user= after `web=true` Google auth
 * (same contract as landing `/auth/google/callback`).
 */
export default function GoogleCallbackScreen() {
  const params = useLocalSearchParams<{ token?: string; user?: string; error?: string }>();
  const { completeGoogleSession } = useAuth();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      if (params.error) {
        setErrorMsg(params.error);
        setTimeout(() => router.replace('/(auth)/login'), 2000);
        return;
      }

      const token = typeof params.token === 'string' ? params.token : undefined;
      let user: AuthUser | undefined;
      if (typeof params.user === 'string') {
        try {
          user = JSON.parse(decodeURIComponent(params.user)) as AuthUser;
        } catch {
          try {
            user = JSON.parse(params.user) as AuthUser;
          } catch {
            user = undefined;
          }
        }
      }

      if (!token || !user) {
        router.replace('/(auth)/login');
        return;
      }

      await completeGoogleSession(token, user);
      if (!cancelled) {
        router.replace('/(tabs)/projects');
      }
    }

    void finish();
    return () => {
      cancelled = true;
    };
  }, [params.error, params.token, params.user, completeGoogleSession]);

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      {errorMsg ? (
        <>
          <Text className="text-lg font-semibold text-foreground">Authentication failed</Text>
          <Text className="mt-2 text-center text-sm text-red-400">{errorMsg}</Text>
          <Text className="mt-4 text-xs text-muted">Redirecting to login…</Text>
        </>
      ) : (
        <>
          <ActivityIndicator color={tokens.colors.primary} />
          <Text className="mt-4 text-foreground">Completing Google sign-in…</Text>
        </>
      )}
    </View>
  );
}
