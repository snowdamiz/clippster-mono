import { Ionicons } from '@expo/vector-icons';
import type { SocialPlatform } from '@clippster/api-client';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import {
  DISTRIBUTION_PLATFORMS,
  type DistributionPlatformConfig,
} from '@/config/distributionPlatforms';
import { TokendPlatformIcon } from '@/components/icons/TokendLogo';
import { tokens } from '@/theme/tokens';

const PLATFORM_ICON_BG = 'bg-foreground/10';

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
  const isConnecting = connecting;

  return (
    <Pressable
      onPress={onPress}
      disabled={connecting}
      className="flex-row items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 active:bg-white/5"
    >
      <View
        className={`h-10 w-10 items-center justify-center rounded-lg ${PLATFORM_ICON_BG}`}
      >
        {platform.id === 'tokend' ? (
          <TokendPlatformIcon size={22} />
        ) : (
          <Ionicons name={platform.icon} size={22} color={tokens.colors.foreground} />
        )}
      </View>
      <Text className="flex-1 text-base font-medium text-foreground">{platform.name}</Text>
      {isConnecting ? (
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/70 px-5" onPress={onClose}>
        <Pressable
          className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-surface"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="h-[3px] bg-accent" />
          <View className="items-center px-6 pb-2 pt-6">
            <Pressable
              onPress={onClose}
              disabled={!!connectingPlatform}
              className="absolute right-4 top-4 rounded-md p-1"
            >
              <Ionicons name="close" size={20} color={tokens.colors.muted} />
            </Pressable>
            <View className="mb-3 h-12 w-12 items-center justify-center rounded-xl bg-accent/15">
              <Ionicons name="share-social-outline" size={24} color={tokens.colors.accent} />
            </View>
            <Text className="text-xl font-bold text-foreground">Connect Social Account</Text>
            <Text className="mt-1 text-center text-sm text-muted">
              Choose a platform to connect and start posting
            </Text>
          </View>

          <View className="gap-2 px-4 py-4">
            {DISTRIBUTION_PLATFORMS.map((platform) => (
              <PlatformOption
                key={platform.id}
                platform={platform}
                connecting={connectingPlatform === platform.id}
                onPress={() => onConnect(platform.id)}
              />
            ))}
          </View>

          <View className="border-t border-border px-4 py-3">
            <Pressable
              onPress={onClose}
              disabled={!!connectingPlatform}
              className="items-center rounded-lg border border-border bg-white/5 py-3"
            >
              <Text className="text-sm font-semibold text-foreground">Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
