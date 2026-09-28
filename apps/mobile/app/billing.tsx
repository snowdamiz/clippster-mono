import { useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs } from '@/components/ui/tabs';
import { PlanTierCard } from '@/components/subscription/PlanTierCard';
import { useAccount } from '@/context/AccountContext';
import { useAuth } from '@/context/AuthContext';
import { mergeDisplayTiers, type BillingInterval } from '@/lib/planCatalog';
import { tokens } from '@/theme/tokens';
import { appAlert } from '@/lib/appAlert';

export default function BillingScreen() {
  const { logout } = useAuth();
  const {
    loading,
    creditsLabel,
    tierLabel,
    tiers,
    subscription,
    continueWithFreePlan,
    subscribeToTier,
    requiresPlanGate,
    hasValidSubscription,
  } = useAccount();
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const [busyTier, setBusyTier] = useState<string | null>(null);

  const expired = subscription?.status === 'expired';
  const displayTiers = mergeDisplayTiers(tiers);
  const currentTierId = hasValidSubscription ? subscription?.tier ?? null : null;

  async function handleSelect(tierId: string) {
    if (busyTier) return;
    setBusyTier(tierId);
    try {
      if (tierId === 'free') {
        await continueWithFreePlan();
        router.replace('/(tabs)/projects');
        return;
      }

      const result = await subscribeToTier(tierId, { billing_interval: interval });
      if (!result.success) {
        appAlert('Checkout failed', result.error ?? 'Could not open checkout');
        return;
      }
      if (result.outcome === 'paid') {
        router.replace('/(tabs)/projects');
      }
    } catch (error) {
      appAlert('Checkout failed', error instanceof Error ? error.message : 'Could not open checkout.');
    } finally {
      setBusyTier(null);
    }
  }

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/login');
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={requiresPlanGate ? (expired ? 'Subscription expired' : 'Choose a Plan') : 'Change Plan'}
        subtitle={
          requiresPlanGate
            ? expired
              ? 'Renew or continue with Free to keep using Clippster.'
              : 'Select the plan that works best for you.'
            : 'Select the plan that works best for you.'
        }
        showBack={!requiresPlanGate}
        rightAction={
          requiresPlanGate ? (
            <Pressable onPress={() => void handleLogout()} className="px-2 py-1">
              <Text className="text-sm font-medium text-accent">Log out</Text>
            </Pressable>
          ) : undefined
        }
      />

      {loading && displayTiers.length <= 1 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={tokens.colors.accent} />
        </View>
      ) : (
        <ScrollView contentContainerClassName="gap-[17px] px-5 py-4 pb-10">
          {requiresPlanGate ? (
            <View className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3">
              <Text className="font-semibold text-foreground">
                {expired ? 'Your subscription has expired' : 'Welcome to Clippster'}
              </Text>
              <Text className="mt-1 text-sm text-muted">
                {expired
                  ? 'Please renew your subscription or continue with the free tier to regain access.'
                  : 'Choose a plan to get started. Paid plans open Stripe in your browser, then return here.'}
              </Text>
            </View>
          ) : null}

          <View className="gap-2 rounded-[18px] bg-surface p-4"><Text className="text-sm font-semibold text-foreground">Current plan · {tierLabel}</Text><Text className="text-sm text-muted">{creditsLabel} AI credits available</Text></View>
          <Tabs items={[{key:"monthly", label:"Monthly"}, {key:"yearly",label:"Yearly"}]} value={interval} onChange={(value) => {if (!busyTier) setInterval(value as BillingInterval);}} />
          <Text className="text-sm leading-[21px] text-muted">Yearly plans save one month.</Text>

          {displayTiers.map((tier) => (
            <PlanTierCard
              key={tier.id}
              tier={tier}
              interval={interval}
              current={currentTierId === tier.id || (tier.id === 'free' && !hasValidSubscription && !requiresPlanGate)}
              gateMode={requiresPlanGate}
              busy={busyTier === tier.id}
              onSelect={() => void handleSelect(tier.id)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
