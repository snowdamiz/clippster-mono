import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAccount } from '@/context/AccountContext';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { tokens } from '@/theme/tokens';

export default function StripeSuccessScreen() {
  const [error, setError] = useState(false);
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

    void finish().catch(() => { if (!cancelled) setError(true); });
    return () => {
      cancelled = true;
    };
  }, [continueWithFreePlan, hideSubscriptionGate, refreshAccount]);

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <EmptyState icon="checkmark-outline" title="Payment confirmed" subtitle={error ? "Your payment return was received. Open plans to refresh your account access." : "Refreshing your account access before returning to your workspace."} />
      {error ? <Button title="Back to plans" onPress={() => router.replace("/billing")} /> : <ActivityIndicator color={tokens.colors.accent} />}
    </View>
  );
}
