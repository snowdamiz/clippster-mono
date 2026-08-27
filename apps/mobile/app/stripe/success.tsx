import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAccount } from '@/context/AccountContext';
import { tokens } from '@/theme/tokens';

export default function StripeSuccessScreen() {
  const { refreshAccount, hideSubscriptionGate, continueWithFreePlan } = useAccount();

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      hideSubscriptionGate();
      await continueWithFreePlan();
      await refreshAccount();
      if (!cancelled) {
        router.replace('/(tabs)/projects');
      }
    }

    void finish();
    return () => {
      cancelled = true;
    };
  }, [continueWithFreePlan, hideSubscriptionGate, refreshAccount]);

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <ActivityIndicator color={tokens.colors.accent} />
      <Text className="mt-4 text-center text-foreground">Payment confirmed. Returning to Clippster…</Text>
    </View>
  );
}
