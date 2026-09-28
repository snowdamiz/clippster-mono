import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import type { GateActionType } from '@/lib/subscriptionAccess';
import { useAccount } from '@/context/AccountContext';

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
  const { gateState, hideSubscriptionGate } = useAccount();
  const header = headerForType(gateState.type);
  return <BottomSheet visible={gateState.visible} onClose={hideSubscriptionGate} variant="dialog" title={header.title} subtitle={header.subtitle} headerIcon={header.icon}
    primaryAction={{title:gateState.type === 'ai' ? 'View eligible plans' : 'View plans',onPress:()=>{hideSubscriptionGate();router.push('/billing');}}}
    secondaryAction={{title:'Not now',onPress:hideSubscriptionGate}}>
    {gateState.context ? <Text className="rounded-[14px] bg-surfaceMuted p-4 text-sm text-muted">{gateState.context}</Text> : null}
  </BottomSheet>;
}
