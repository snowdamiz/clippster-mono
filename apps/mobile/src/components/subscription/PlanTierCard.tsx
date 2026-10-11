import { AppIcon } from '@/components/AppIcon'
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
        className="gap-3 rounded-[18px] border border-border bg-surface p-4"
      >
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-[14px] bg-surfaceMuted">
            <AppIcon
              name={tier.id === 'creator' || tier.id === 'pro' ? 'Sparkles' : 'UserRound'}
              size={25}
              color={tokens.colors.foreground}
            />
          </View>
          <View className="flex-1 gap-1">
            <Text className="text-[17px] font-semibold text-foreground">{tier.name}</Text>
            <Text className="text-xs text-muted">
              ${displayPrice(tier, interval)}
              {period}
            </Text>
          </View>
          {current || popular ? (
            <View className={`rounded-full px-3 py-1 ${current ? 'bg-success/15' : 'bg-accent/15'}`}>
              <Text className={`text-xs ${current ? 'text-success' : 'text-accent'}`}>
                {current ? 'Current plan' : 'Popular'}
              </Text>
            </View>
          ) : null}
        </View>
        {[
          creditsLabel(tier, interval),
          ...features
            .filter((feature) => feature.included && !feature.note)
            .slice(1, 3)
            .map((feature) => feature.label)
        ].map((label) => (
          <View key={label} className="flex-row items-center gap-2">
            <AppIcon name="Check" size={17} color={tokens.colors.foreground} />
            <Text className="flex-1 text-xs leading-5 text-muted">{label}</Text>
          </View>
        ))}
        <View className="min-h-11 flex-row items-center justify-between rounded-[14px] border border-border bg-surfaceMuted px-3">
          <Text className="text-sm text-foreground">View plan details</Text>
          <AppIcon name="ChevronRight" size={20} color={tokens.colors.muted} />
        </View>
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
            <AppIcon
              name={feature.included && !feature.note ? 'CircleCheck' : feature.note ? 'Info' : 'CircleX'}
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
