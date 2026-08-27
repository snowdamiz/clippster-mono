import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import type { SubscriptionTierInfo } from '@clippster/shared-types';
import {
  creditsLabel,
  displayPrice,
  effectiveMonthlyPrice,
  featuresForTier,
  type BillingInterval,
} from '@/lib/planCatalog';
import { tokens } from '@/theme/tokens';

interface PlanTierCardProps {
  tier: SubscriptionTierInfo;
  interval: BillingInterval;
  current: boolean;
  gateMode: boolean;
  busy: boolean;
  onSelect: () => void;
}

export function PlanTierCard({
  tier,
  interval,
  current,
  gateMode,
  busy,
  onSelect,
}: PlanTierCardProps) {
  const popular = tier.id === 'creator' && !current;
  const features = featuresForTier(tier.id);
  const period = interval === 'yearly' && tier.price_usd > 0 ? '/yr' : '/mo';
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
          : 'Switch Plan';

  return (
    <View
      className={`overflow-hidden rounded-xl border bg-surface ${
        popular ? 'border-accent' : current ? 'border-success/40' : 'border-border'
      }`}
    >
      {popular ? (
        <View className="bg-accent px-3 py-1.5">
          <Text className="text-center text-[11px] font-bold uppercase tracking-wide text-primary-foreground">
            Most Popular
          </Text>
        </View>
      ) : current ? (
        <View className="bg-success/15 px-3 py-1.5">
          <Text className="text-center text-[11px] font-bold uppercase tracking-wide text-success">
            Current Plan
          </Text>
        </View>
      ) : null}

      <View className="gap-3 p-4">
        <View className="flex-row items-end justify-between">
          <Text className="text-lg font-bold text-foreground">{tier.name}</Text>
          <View className="flex-row items-end">
            <Text className="text-sm font-semibold text-muted">$</Text>
            <Text className="text-3xl font-bold text-foreground">{displayPrice(tier, interval)}</Text>
            <Text className="mb-1 text-sm text-muted">{period}</Text>
          </View>
        </View>
        {interval === 'yearly' && tier.price_usd > 0 ? (
          <Text className="text-xs text-muted">${effectiveMonthlyPrice(tier.price_usd)}/mo effective</Text>
        ) : null}

        <View className="flex-row items-center gap-2 rounded-lg bg-accent/10 px-3 py-2">
          <Ionicons name="flash" size={16} color={tokens.colors.accent} />
          <Text className="text-sm font-medium text-foreground">{creditsLabel(tier, interval)}</Text>
        </View>

        <View className="gap-2">
          {features.map((feature) => (
            <View key={feature.label} className="flex-row items-start gap-2">
              <Ionicons
                name={feature.included && !feature.note ? 'checkmark-circle' : feature.note ? 'information-circle-outline' : 'close-circle'}
                size={16}
                color={
                  feature.note
                    ? tokens.colors.muted
                    : feature.included
                      ? tokens.colors.success
                      : tokens.colors.destructive
                }
              />
              <Text className={`flex-1 text-sm ${feature.included ? 'text-foreground' : 'text-muted'}`}>
                {feature.label}
              </Text>
            </View>
          ))}
        </View>

        <Pressable
          disabled={busy || (current && !gateMode)}
          onPress={onSelect}
          className={`rounded-lg py-3 ${
            popular ? 'bg-accent' : 'border border-border bg-background'
          } ${busy || (current && !gateMode) ? 'opacity-50' : ''}`}
        >
          <Text
            className={`text-center text-sm font-semibold ${
              popular ? 'text-primary-foreground' : 'text-foreground'
            }`}
          >
            {cta}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
