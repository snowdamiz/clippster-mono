import { Ionicons } from '@expo/vector-icons';
import type { SocialPlatform } from '@clippster/api-client';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import {
  DISTRIBUTION_PLATFORMS,
  type DistributionPlatformConfig,
} from '@/config/distributionPlatforms';
import { TokendPlatformIcon } from '@/components/icons/TokendLogo';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { tokens } from '@/theme/tokens';

interface ConnectPlatformSheetProps {
  visible: boolean;
  connectingPlatform: SocialPlatform | null;
  onClose: () => void;
  onConnect: (platform: SocialPlatform) => void;
}

function PlatformOption({
  platform,
  connecting,
  onPress,
}: {
  platform: DistributionPlatformConfig;
  connecting: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={connecting}
      className="flex-row items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 active:bg-white/5"
    >
      <View className="h-10 w-10 items-center justify-center rounded-lg bg-foreground/10">
        {platform.id === 'tokend' ? (
          <TokendPlatformIcon size={22} />
        ) : (
          <Ionicons name={platform.icon} size={22} color={tokens.colors.foreground} />
        )}
      </View>
      <Text className="flex-1 text-base font-medium text-foreground">{platform.name}</Text>
      {connecting ? (
        <ActivityIndicator size="small" color={tokens.colors.accent} />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={tokens.colors.muted} />
      )}
    </Pressable>
  );
}

export function ConnectPlatformSheet({
  visible,
  connectingPlatform,
  onClose,
  onConnect,
}: ConnectPlatformSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      variant="dialog"
      title="Connect Social Account"
      subtitle="Choose a platform to connect and start posting"
      headerIcon="share-social-outline"
      dismissOnBackdrop={!connectingPlatform}
      secondaryAction={{
        title: 'Cancel',
        onPress: onClose,
        disabled: !!connectingPlatform,
      }}
    >
      <View className="gap-2">
        {DISTRIBUTION_PLATFORMS.map((platform) => (
          <PlatformOption
            key={platform.id}
            platform={platform}
            connecting={connectingPlatform === platform.id}
            onPress={() => onConnect(platform.id)}
          />
        ))}
      </View>
    </BottomSheet>
  );
}
