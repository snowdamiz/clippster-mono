import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
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
    } finally {
      setBusyTier(null);
    }
  }

  if (!visible) return null;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      variant="sheet"
      title="Plans & billing"
      subtitle="Select the plan that works best for you."
      headerIcon="card-outline"
      scrollable
      maxHeightClassName="max-h-[92%]"
    >
      {loading && displayTiers.length <= 1 ? (
        <View className="items-center justify-center py-10">
          <ActivityIndicator color={tokens.colors.accent} />
        </View>
      ) : (
        <View className="gap-4">
          <View className="flex-row self-end overflow-hidden rounded-lg border border-border">
            <Pressable
              onPress={() => setInterval('monthly')}
              className={`px-3 py-2 ${interval === 'monthly' ? 'bg-accent' : 'bg-surface'}`}
            >
              <Text
                className={`text-xs font-semibold ${
                  interval === 'monthly' ? 'text-primary-foreground' : 'text-muted'
                }`}
              >
                Monthly
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setInterval('yearly')}
              className={`flex-row items-center gap-1 px-3 py-2 ${
                interval === 'yearly' ? 'bg-accent' : 'bg-surface'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  interval === 'yearly' ? 'text-primary-foreground' : 'text-muted'
                }`}
              >
                Yearly
              </Text>
              <View className="rounded-full bg-black/20 px-1.5 py-0.5">
                <Text
                  className={`text-[9px] font-bold uppercase ${
                    interval === 'yearly' ? 'text-primary-foreground' : 'text-muted'
                  }`}
                >
                  Save 1 month
                </Text>
              </View>
            </Pressable>
          </View>

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
