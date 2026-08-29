import type { UserSocialAccount } from '@clippster/api-client';
import { getSocialPlatformLabel, isTokenExpired, isTokenExpiringSoon } from '@clippster/api-client';
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, Text, View } from 'react-native';
import { TokendLogo } from '@/components/icons/TokendLogo';
import { DISTRIBUTION_PLATFORMS } from '@/config/distributionPlatforms';
import { tokens } from '@/theme/tokens';

interface SocialAccountCardProps {
  account: UserSocialAccount;
  onDisconnect?: (id: number) => void;
  onReconnect?: (account: UserSocialAccount) => void;
}

export function SocialAccountCard({ account, onDisconnect, onReconnect }: SocialAccountCardProps) {
  const platformConfig = DISTRIBUTION_PLATFORMS.find((p) => p.id === account.platform);
  const expired = isTokenExpired(account.token_expires_at);
  const expiringSoon = isTokenExpiringSoon(account);
  const needsAttention = expired || expiringSoon;

  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      {account.profile_image_url ? (
        <Image source={{ uri: account.profile_image_url }} className="h-11 w-11 rounded-full" />
      ) : (
        <View className="h-11 w-11 items-center justify-center rounded-full bg-surfaceMuted">
          {account.platform === 'tokend' ? (
            <TokendLogo size={32} />
          ) : platformConfig ? (
            <Ionicons name={platformConfig.icon} size={22} color={tokens.colors.foreground} />
          ) : null}
        </View>
      )}
      <View className="flex-1 min-w-0">
        <Text className="font-semibold text-foreground">@{account.username}</Text>
        <Text className="text-sm text-muted">
          {getSocialPlatformLabel(account.platform)}
          {account.display_name ? ` · ${account.display_name}` : ''}
        </Text>
        {expired ? (
          <Text className="mt-0.5 text-xs text-destructive">Token expired — reconnect required</Text>
        ) : expiringSoon ? (
          <Text className="mt-0.5 text-xs text-warning">Token expiring soon</Text>
        ) : account.is_active ? (
          <Text className="mt-0.5 text-xs text-success">Active</Text>
        ) : null}
      </View>
      <View className="flex-row items-center gap-1">
        {needsAttention && onReconnect ? (
          <Pressable
            onPress={() => onReconnect(account)}
            className="rounded-lg border border-border p-2"
          >
            <Ionicons name="refresh-outline" size={18} color={tokens.colors.accent} />
          </Pressable>
        ) : null}
        {onDisconnect ? (
          <Pressable
            onPress={() => onDisconnect(account.id)}
            className="rounded-lg border border-border p-2"
          >
            <Ionicons name="trash-outline" size={18} color={tokens.colors.destructive} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
