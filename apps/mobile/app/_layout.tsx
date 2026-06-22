import '../global.css';

import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { openDatabaseSync } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { AuthProvider } from '@/context/AuthContext';
import { CloudSyncProvider } from '@/context/CloudSyncContext';
import { DB_NAME, initDatabase } from '@/services/database';
import { tokens } from '@/theme/tokens';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: tokens.colors.background,
    card: tokens.colors.surface,
    border: tokens.colors.border,
    primary: tokens.colors.primary,
    text: tokens.colors.foreground,
  },
};

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await initDatabase(() => openDatabaseSync(DB_NAME));
      } catch (error) {
        console.error('Failed to initialize database', error);
      } finally {
        setReady(true);
        await SplashScreen.hideAsync();
      }
    }

    void prepare();
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <AppErrorBoundary>
      <AuthProvider>
        <CloudSyncProvider>
        <ThemeProvider value={navigationTheme}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.colors.background } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="project/[id]" options={{ headerShown: true, title: 'Project' }} />
            <Stack.Screen name="schedule/[buildId]" options={{ headerShown: false }} />
            <Stack.Screen name="campaign/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="campaign/[id]/submit" options={{ headerShown: false }} />
            <Stack.Screen name="inbox/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="profile/preview" options={{ headerShown: false }} />
          </Stack>
        </ThemeProvider>
        </CloudSyncProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}
