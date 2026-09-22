import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useFeatureFlags } from '@/context/FeatureFlagsContext';
import { tokens } from '@/theme/tokens';

export function CampaignAccessGate({ children }: { children: ReactNode }) {
  const { ready, canAccessCampaigns } = useFeatureFlags();

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={tokens.colors.accent} />
      </View>
    );
  }

  if (!canAccessCampaigns) {
    return <Redirect href="/(tabs)/profile" />;
  }

  return children;
}
