import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Tabs } from '@/components/ui/tabs';
import { PlanTierCard } from '@/components/subscription/PlanTierCard';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useAccount } from '@/context/AccountContext';
import { appAlert } from '@/lib/appAlert';
import { mergeDisplayTiers, type BillingInterval } from '@/lib/planCatalog';
import { tokens } from '@/theme/tokens';

interface BillingSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function BillingSheet({ visible, onClose }: BillingSheetProps) {
  const {
    loading,
    creditsLabel,
    tierLabel,
    tiers,
    subscription,
    continueWithFreePlan,
    subscribeToTier,
    hasValidSubscription,
  } = useAccount();
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const [busyTier, setBusyTier] = useState<string | null>(null);

  const displayTiers = mergeDisplayTiers(tiers);
  const currentTierId = hasValidSubscription ? subscription?.tier ?? null : null;

  async function handleSelect(tierId: string) {
    if (busyTier) return;
    setBusyTier(tierId);
    try {
      if (tierId === 'free') {
        await continueWithFreePlan();
        onClose();
        router.replace('/(tabs)/projects');
        return;
      }

      const result = await subscribeToTier(tierId, { billing_interval: interval });
      if (!result.success) {
        appAlert('Checkout failed', result.error ?? 'Could not open checkout');
        return;
      }
      if (result.outcome === 'paid') {
        onClose();
        router.replace('/(tabs)/projects');
      }
    } catch (error) {
      appAlert('Checkout failed', error instanceof Error ? error.message : 'Could not open checkout.');
    } finally {
      setBusyTier(null);
    }
  }

  if (!visible) return null;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      variant="page"
      title="Plans & billing"
      subtitle="Select the plan that works best for you."
      headerIcon="card-outline"
      scrollable
    >
      {loading && displayTiers.length <= 1 ? (
        <View className="items-center justify-center py-10">
          <ActivityIndicator color={tokens.colors.accent} />
        </View>
      ) : (
        <View className="gap-4">
          <View className="gap-2 rounded-[18px] bg-surface p-4"><Text className="text-sm font-semibold text-foreground">Current plan · {tierLabel}</Text><Text className="text-sm text-muted">{creditsLabel} AI credits available</Text></View>
          <Tabs items={[{key:"monthly", label:"Monthly"}, {key:"yearly",label:"Yearly"}]} value={interval} onChange={(value) => {if (!busyTier) setInterval(value as BillingInterval);}} />
          <Text className="text-sm leading-[21px] text-muted">Yearly plans save one month.</Text>

          {displayTiers.map((tier) => (
            <PlanTierCard
              key={tier.id}
              tier={tier}
              interval={interval}
              current={
                currentTierId === tier.id || (tier.id === 'free' && !hasValidSubscription)
              }
              gateMode={false}
              busy={busyTier === tier.id}
              onSelect={() => void handleSelect(tier.id)}
            />
          ))}
        </View>
      )}
    </BottomSheet>
  );
}
