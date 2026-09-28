import { Ionicons } from '@expo/vector-icons';
import type { SocialPlatform } from '@clippster/api-client';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import {
  getDistributionPlatforms,
  type DistributionPlatformConfig,
} from '@/config/distributionPlatforms';
import { TokendPlatformIcon } from '@/components/icons/TokendLogo';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { tokens } from '@/theme/tokens';

interface ConnectPlatformSheetProps {
  visible: boolean;
  connectingPlatform: SocialPlatform | null;
  includeTokend?: boolean;
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
      className="min-h-[60px] flex-row items-center gap-3 border-b border-border py-[13px] active:bg-white/5"
    >
      <View className="h-[38px] w-[38px] items-center justify-center rounded-xl bg-surfaceMuted">
        {platform.id === 'tokend' ? (
          <TokendPlatformIcon size={22} />
        ) : (
          <Ionicons name={platform.icon} size={22} color={tokens.colors.foreground} />
        )}
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-foreground">{platform.name}</Text>
        <Text className="text-xs text-muted">Continue to authorization</Text>
      </View>
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
  includeTokend = false,
  onClose,
  onConnect,
}: ConnectPlatformSheetProps) {
  const platforms = getDistributionPlatforms({ includeTokend });

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      variant="page"
      title="Connect an account"
      subtitle="Choose a platform. A secure browser opens for authorization."
      headerIcon="share-social-outline"
      dismissOnBackdrop={!connectingPlatform}
      secondaryAction={{
        title: 'Cancel',
        onPress: onClose,
        disabled: !!connectingPlatform,
      }}
    >
      <View className="gap-2">
        {platforms.map((platform) => (
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
