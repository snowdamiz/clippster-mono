import type { UserSocialAccount } from '@clippster/api-client'
import { getSocialPlatformLabel, isTokenExpired, isTokenExpiringSoon } from '@clippster/api-client'
import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { TokendLogo } from '@/components/icons/TokendLogo'
import { DISTRIBUTION_PLATFORMS } from '@/config/distributionPlatforms'
import { tokens } from '@/theme/tokens'

interface SocialAccountCardProps {
  account: UserSocialAccount
  onDisconnect?: (id: number) => void
  onReconnect?: (account: UserSocialAccount) => void
}

export function SocialAccountCard({ account, onDisconnect, onReconnect }: SocialAccountCardProps) {
  const [showDetails, setShowDetails] = useState(false)
  const platformConfig = DISTRIBUTION_PLATFORMS.find((p) => p.id === account.platform)
  const expired = isTokenExpired(account.token_expires_at)
  const expiringSoon = isTokenExpiringSoon(account)

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Manage ${getSocialPlatformLabel(account.platform)} account ${account.username}`}
        onPress={() => setShowDetails(true)}
        className="min-h-[76px] flex-row items-center gap-3 border-b border-border py-3"
      >
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
        <Ionicons name="chevron-forward" size={18} color={tokens.colors.muted} />
      </Pressable>
      <BottomSheet
        visible={showDetails}
        onClose={() => setShowDetails(false)}
        variant="page"
        title="Account connection"
        primaryAction={
          onReconnect
            ? {
                title: 'Reconnect account',
                variant: 'outline',
                onPress: () => {
                  setShowDetails(false)
                  onReconnect(account)
                }
              }
            : undefined
        }
        secondaryAction={
          onDisconnect
            ? { title: 'Disconnect account', variant: 'destructive', onPress: () => onDisconnect(account.id) }
            : undefined
        }
      >
        <View className="items-center gap-3 py-8">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-surfaceMuted">
            <Ionicons name="link-outline" size={30} color={tokens.colors.accent} />
          </View>
          <Text className="text-center text-[28px] font-bold text-foreground">@{account.username}</Text>
          <Text className="text-center text-sm text-muted">
            {getSocialPlatformLabel(account.platform)}
            {account.display_name ? ` · ${account.display_name}` : ''}
          </Text>
          <Text
            className={
              expired ? 'text-sm text-destructive' : expiringSoon ? 'text-sm text-warning' : 'text-sm text-success'
            }
          >
            {expired
              ? 'Expired · Reconnect required'
              : expiringSoon
                ? 'Connection expires soon'
                : account.is_active
                  ? 'Active'
                  : 'Inactive'}
          </Text>
        </View>
      </BottomSheet>
    </>
  )
}
