import { router } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { Tabs } from '@/components/ui/tabs'
import { PlanTierCard } from '@/components/subscription/PlanTierCard'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { useAccount } from '@/context/AccountContext'
import { appAlert } from '@/lib/appAlert'
import { mergeDisplayTiers, type BillingInterval } from '@/lib/planCatalog'
import { tokens } from '@/theme/tokens'
import { AppIcon } from '@/components/AppIcon'

interface BillingSheetProps {
  visible: boolean
  onClose: () => void
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
    hasValidSubscription
  } = useAccount()
  const [interval, setInterval] = useState<BillingInterval>('monthly')
  const [busyTier, setBusyTier] = useState<string | null>(null)
  const [allPlans, setAllPlans] = useState(false)

  const displayTiers = mergeDisplayTiers(tiers)
  const currentTierId = hasValidSubscription ? (subscription?.tier ?? null) : null

  async function handleSelect(tierId: string) {
    if (busyTier) return
    setBusyTier(tierId)
    try {
      if (tierId === 'free') {
        await continueWithFreePlan()
        onClose()
        router.replace('/(tabs)/projects')
        return
      }

      const result = await subscribeToTier(tierId, { billing_interval: interval })
      if (!result.success) {
        appAlert('Checkout failed', result.error ?? 'Could not open checkout')
        return
      }
      if (result.outcome === 'paid') {
        onClose()
        router.replace('/(tabs)/projects')
      }
    } catch (error) {
      appAlert('Checkout failed', error instanceof Error ? error.message : 'Could not open checkout.')
    } finally {
      setBusyTier(null)
    }
  }

  if (!visible) return null

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      variant="page"
      title="Plans & billing"
      headerIcon="CreditCard"
      scrollable
      primaryAction={allPlans ? undefined : { title: 'All plans', onPress: () => setAllPlans(true) }}
      footer={
        allPlans ? undefined : (
          <Text className="text-center text-xs text-muted">Compare Free, Basic and Pro plans.</Text>
        )
      }
    >
      {loading && displayTiers.length <= 1 ? (
        <View className="items-center justify-center py-10">
          <ActivityIndicator color={tokens.colors.accent} />
        </View>
      ) : (
        <View className="gap-4">
          <View className="gap-3 rounded-[18px] border border-border bg-surface p-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-muted">Current plan</Text>
              <Text className="rounded-full bg-success/15 px-3 py-1 text-xs text-success">Current plan</Text>
            </View>
            <Text className="text-[23px] font-bold text-foreground">{tierLabel}</Text>
            <Text className="text-xs text-muted">Manage your subscription and usage.</Text>
            <View className="flex-row items-center gap-3 border-t border-border pt-3">
              <AppIcon name="Layers" size={25} color={tokens.colors.foreground} />
              <View>
                <Text className="text-xs text-muted">AI credits</Text>
                <Text className="text-[18px] font-semibold text-foreground">{creditsLabel} available</Text>
              </View>
            </View>
          </View>
          <Tabs
            items={[
              { key: 'monthly', label: 'Monthly' },
              { key: 'yearly', label: 'Yearly' }
            ]}
            value={interval}
            onChange={(value) => {
              if (!busyTier) setInterval(value as BillingInterval)
            }}
          />
          {interval === 'yearly' ? <Text className="text-xs text-muted">Yearly plans save one month.</Text> : null}

          {displayTiers
            .filter((tier) => allPlans || tier.id === 'starter' || tier.id === 'creator')
            .map((tier) => (
              <PlanTierCard
                key={tier.id}
                tier={tier}
                interval={interval}
                current={currentTierId === tier.id || (tier.id === 'free' && !hasValidSubscription)}
                gateMode={false}
                busy={busyTier === tier.id}
                onSelect={() => void handleSelect(tier.id)}
              />
            ))}
        </View>
      )}
    </BottomSheet>
  )
}
