import type { MediaPlatform } from '@clippster/shared-types';
import { Text, View } from 'react-native';
import { cn } from '@/lib/utils';

const PLATFORM_BADGE: Record<
  MediaPlatform,
  { label: string; container: string; text: string } | null
> = {
  kick: {
    label: 'KICK',
    container: 'bg-[rgba(83,252,24,0.3)]',
    text: 'text-[#bef264]',
  },
  youtube: {
    label: 'YOUTUBE',
    container: 'bg-red-600/30',
    text: 'text-red-300',
  },
  twitch: {
    label: 'TWITCH',
    container: 'bg-purple-600/30',
    text: 'text-purple-300',
  },
  rumble: {
    label: 'RUMBLE',
    container: 'bg-orange-600/30',
    text: 'text-orange-300',
  },
  twitter: {
    label: 'X',
    container: 'bg-foreground/20',
    text: 'text-foreground',
  },
  tokend: {
    label: 'TOKEND',
    container: 'bg-accent/20',
    text: 'text-accent',
  },
  manual: null,
};

interface VodPlatformBadgeProps {
  platform: MediaPlatform;
  className?: string;
}

export function VodPlatformBadge({ platform, className }: VodPlatformBadgeProps) {
  const config = PLATFORM_BADGE[platform];
  if (!config) return null;

  return (
    <View
      className={cn(
        'rounded-[5px] px-2 py-1 shadow-md',
        config.container,
        className,
      )}
    >
      <Text className={cn('text-[10px] font-semibold uppercase tracking-wide', config.text)}>
        {config.label}
      </Text>
    </View>
  );
}
