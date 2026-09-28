import type { ScheduledPost } from '@clippster/api-client'
import { getSocialPlatformLabel } from '@clippster/api-client'
import { Ionicons } from '@expo/vector-icons'
import { Image, Pressable, Text, View } from 'react-native'
import { tokens } from '@/theme/tokens'
import { PostStatusBadge } from './PostStatusBadge'

interface PostCardProps {
  post: ScheduledPost
  onPress: () => void
}

export function PostCard({ post, onPress }: PostCardProps) {
  const date = post.posted_at ?? post.scheduled_at
  const platform = getSocialPlatformLabel(post.platform)
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="gap-3 rounded-[18px] bg-surface p-4">
      <PostStatusBadge status={post.status} />
      <View className="flex-row items-center gap-3">
        <View className="h-[58px] w-[72px] items-center justify-center overflow-hidden rounded-[10px] bg-surfaceMuted">
          {post.thumbnail_url ? (
            <Image source={{ uri: post.thumbnail_url }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <Ionicons name="videocam-outline" size={22} color={tokens.colors.muted} />
          )}
        </View>
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-sm font-semibold text-foreground" numberOfLines={2}>
            {post.caption || `${platform} post`}
          </Text>
          <Text className="text-xs text-muted">
            {platform}
            {post.social_account?.username ? ` · @${post.social_account.username}` : ''}
          </Text>
          {date ? (
            <Text className="text-xs text-muted">
              {new Date(date).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              })}
            </Text>
          ) : null}
          {post.status === 'failed' && post.error_message ? (
            <Text className="text-xs text-destructive" numberOfLines={2}>
              {post.error_message}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={tokens.colors.muted} />
      </View>
    </Pressable>
  )
}
