import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import type { GateActionType } from '@/lib/subscriptionAccess';
import { useAccount } from '@/context/AccountContext';
import { tokens } from '@/theme/tokens';
import { appAlert } from '@/lib/appAlert';

function headerForType(type: GateActionType): {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
} {
  switch (type) {
    case 'expired':
      return {
        title: 'Subscription expired',
        subtitle: 'Renew your plan to keep creating clips with Clippster.',
        icon: 'alert-circle-outline',
      };
    case 'ai':
      return {
        title: 'Credits required',
        subtitle: 'Subscribe or use your free credits to run AI transcription and clip detection.',
        icon: 'sparkles-outline',
      };
    case 'download':
      return {
        title: 'Subscription required',
        subtitle: 'Subscribe to download VODs and unlock the full Clippster workflow.',
        icon: 'download-outline',
      };
    default:
      return {
        title: 'Subscription required',
        subtitle: 'Subscribe to unlock this feature — same plans as the desktop app.',
        icon: 'lock-closed-outline',
      };
  }
}

export function SubscriptionGateSheet() {
  const { gateState, hideSubscriptionGate, tiers, subscribeToTier } = useAccount();
  const header = headerForType(gateState.type);

  async function handleSubscribe(tierId: string) {
    const result = await subscribeToTier(tierId);
    if (!result.success) {
      appAlert('Checkout failed', result.error ?? 'Could not open checkout');
      return;
    }
    if (result.outcome === 'paid') {
      router.replace('/(tabs)/projects');
    }
  }

  return (
    <Modal
      visible={gateState.visible}
      transparent
      animationType="fade"
      onRequestClose={hideSubscriptionGate}
    >
      <Pressable className="flex-1 bg-black/75 px-4" onPress={hideSubscriptionGate}>
        <View className="flex-1 items-center justify-center">
          <Pressable
            className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-surface"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="h-[3px] bg-accent" />
            <ScrollView contentContainerClassName="p-5">
              <View className="items-center">
                <View className="mb-3 h-12 w-12 items-center justify-center rounded-xl bg-accent/15">
                  <Ionicons name={header.icon} size={24} color={tokens.colors.accent} />
                </View>
                <Text className="text-xl font-bold text-foreground">{header.title}</Text>
                <Text className="mt-2 text-center text-sm text-muted">{header.subtitle}</Text>
              </View>

              {gateState.context ? (
                <View className="mt-4 rounded-lg border border-border bg-background px-3 py-2">
                  <Text className="text-xs text-muted">You tried to:</Text>
                  <Text className="text-sm font-medium text-foreground">{gateState.context}</Text>
                </View>
              ) : null}

              <View className="mt-4 flex-row gap-2">
                {tiers.slice(0, 3).map((tier) => (
                  <Pressable
                    key={tier.id}
                    onPress={() => void handleSubscribe(tier.id)}
                    className={`flex-1 rounded-lg border p-3 ${
                      tier.id === 'creator' ? 'border-accent bg-accent/10' : 'border-border bg-background'
                    }`}
                  >
                    <Text className="text-center text-[10px] uppercase text-muted">{tier.name}</Text>
                    <Text className="text-center text-lg font-bold text-foreground">${tier.price_usd}</Text>
                    <Text className="text-center text-[10px] text-muted">/mo</Text>
                    <Text className="mt-1 text-center text-xs text-muted">{tier.monthly_credits} credits</Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={() => {
                  hideSubscriptionGate();
                  router.push('/billing');
                }}
                className="mt-4 rounded-lg bg-primary py-3"
              >
                <Text className="text-center font-semibold text-primary-foreground">
                  View all plans
                </Text>
              </Pressable>

              <Pressable onPress={hideSubscriptionGate} className="mt-3 py-2">
                <Text className="text-center text-sm text-muted">Not now</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
