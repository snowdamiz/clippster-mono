import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Pressable, Text, View } from 'react-native'
import type { SubscriptionTierInfo } from '@clippster/shared-types'
import {
  creditsLabel,
  displayPrice,
  effectiveMonthlyPrice,
  featuresForTier,
  type BillingInterval
} from '@/lib/planCatalog'
import { tokens } from '@/theme/tokens'

interface PlanTierCardProps {
  tier: SubscriptionTierInfo
  interval: BillingInterval
  current: boolean
  gateMode: boolean
  busy: boolean
  onSelect: () => void
}

export function PlanTierCard({ tier, interval, current, gateMode, busy, onSelect }: PlanTierCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const popular = tier.id === 'creator' && !current
  const features = featuresForTier(tier.id)
  const period = tier.price_usd === 0 ? '' : interval === 'yearly' && tier.price_usd > 0 ? '/yr' : '/mo'
  const cta =
    tier.id === 'free'
      ? gateMode
        ? 'Continue with Free Plan'
        : current
          ? 'Current Plan'
          : 'Switch Plan'
      : current
        ? 'Current Plan'
        : gateMode
          ? 'Get Started'
          : 'Switch Plan'

  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => setDetailsOpen(true)}
        className="min-h-[76px] flex-row items-center gap-3 border-b border-border py-4"
      >
        <View className="flex-1 gap-1">
          <Text className="text-[15px] font-semibold text-foreground">
            {tier.name} · ${displayPrice(tier, interval)} {period}
          </Text>
          <Text className="text-xs leading-[18px] text-muted">
            {tier.id === 'basic' ? 'Editing & social posting' : creditsLabel(tier, interval)}
            {current ? ' · Current plan' : popular ? ' · Popular' : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={tokens.colors.muted} />
      </Pressable>
      <BottomSheet
        visible={detailsOpen}
        onClose={() => {
          if (!busy) setDetailsOpen(false)
        }}
        variant="page"
        title="Plan details"
        primaryAction={{
          title: busy
            ? 'Opening checkout…'
            : tier.id === 'free'
              ? cta
              : current && !gateMode
                ? 'Current plan'
                : 'Continue to checkout',
          disabled: busy || (current && !gateMode),
          onPress: onSelect
        }}
        secondaryAction={{ title: 'Compare plans', onPress: () => setDetailsOpen(false), disabled: busy }}
      >
        <View className="gap-3 rounded-[18px] bg-surface p-4">
          <Text className="text-xs uppercase tracking-widest text-muted">
            {current ? 'Current plan' : 'Selected plan'}
          </Text>
          <Text className="text-[28px] font-bold text-foreground">{tier.name}</Text>
          <Text className="text-sm text-muted">
            ${displayPrice(tier, interval)} {period} · {creditsLabel(tier, interval)}
          </Text>
          {interval === 'yearly' && tier.price_usd > 0 ? (
            <Text className="text-xs text-muted">${effectiveMonthlyPrice(tier.price_usd)}/mo effective</Text>
          ) : null}
        </View>
        {features.map((feature) => (
          <View key={feature.label} className="min-h-[60px] flex-row items-center gap-3 border-b border-border py-3">
            <Ionicons
              name={
                feature.included && !feature.note
                  ? 'checkmark-circle-outline'
                  : feature.note
                    ? 'information-circle-outline'
                    : 'close-circle-outline'
              }
              size={22}
              color={feature.included ? tokens.colors.accent : tokens.colors.muted}
            />
            <Text className="flex-1 text-sm leading-[21px] text-foreground">{feature.label}</Text>
          </View>
        ))}
      </BottomSheet>
    </>
  )
}
