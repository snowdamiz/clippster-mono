import { Redirect, usePathname, useSegments } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAccount } from '@/context/AccountContext';
import { useAuth } from '@/context/AuthContext';
import { tokens } from '@/theme/tokens';

function isAllowedDuringPlanGate(pathname: string, segments: string[]): boolean {
  if (pathname === '/billing' || pathname.startsWith('/billing')) return true;
  if (pathname.startsWith('/stripe')) return true;
  if (pathname.startsWith('/auth')) return true;
  if (segments[0] === '(auth)') return true;
  return false;
}

export function PlanGateGuard({ children }: { children: ReactNode }) {
  const { authChecked, isAuthenticated } = useAuth();
  const { requiresPlanGate, accountReady } = useAccount();
  const pathname = usePathname();
  const segments = useSegments();

  if (!authChecked || (isAuthenticated && !accountReady)) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={tokens.colors.accent} />
      </View>
    );
  }

  if (
    isAuthenticated &&
    requiresPlanGate &&
    !isAllowedDuringPlanGate(pathname, segments as string[])
  ) {
    return <Redirect href={'/billing' as never} />;
  }

  return children;
}
