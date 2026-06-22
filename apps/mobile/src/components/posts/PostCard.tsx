import type { ScheduledPost, ScheduledPostStatus } from '@clippster/api-client';
import { getSocialPlatformLabel } from '@clippster/api-client';
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, Text, View } from 'react-native';
import { DISTRIBUTION_PLATFORMS } from '@/config/distributionPlatforms';
import { tokens } from '@/theme/tokens';

const STATUS_COLORS: Record<ScheduledPostStatus, string> = {
  pending: tokens.colors.muted,
  scheduled: '#60a5fa',
  publishing: '#fbbf24',
  published: '#4ade80',
  failed: tokens.colors.destructive,
  canceled: tokens.colors.muted,
};

interface PostCardProps {
  post: ScheduledPost;
  onPress: () => void;
}

export function PostCard({ post, onPress }: PostCardProps) {
  const platformConfig = DISTRIBUTION_PLATFORMS.find((p) => p.id === post.platform);
  const statusColor = STATUS_COLORS[post.status] ?? tokens.colors.muted;
  const scheduledLabel = post.posted_at ?? post.scheduled_at;

  return (
    <Pressable
      onPress={onPress}
      className="mb-3 flex-row overflow-hidden rounded-xl border border-border bg-surface"
    >
      {post.thumbnail_url ? (
        <Image source={{ uri: post.thumbnail_url }} className="h-24 w-20 bg-surfaceMuted" />
      ) : (
        <View className="h-24 w-20 items-center justify-center bg-surfaceMuted">
          <Ionicons name="videocam-outline" size={28} color={tokens.colors.muted} />
        </View>
      )}

      <View className="flex-1 px-3 py-2">
        <View className="flex-row items-center gap-2">
          {platformConfig ? (
            <Ionicons name={platformConfig.icon} size={16} color={tokens.colors.foreground} />
          ) : null}
          <Text className="text-sm font-semibold text-foreground">
            {getSocialPlatformLabel(post.platform)}
          </Text>
          <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${statusColor}22` }}>
            <Text className="text-xs capitalize" style={{ color: statusColor }}>
              {post.status}
            </Text>
          </View>
        </View>

        {post.social_account?.username ? (
          <Text className="mt-0.5 text-xs text-muted">@{post.social_account.username}</Text>
        ) : null}

        {post.caption ? (
          <Text className="mt-1 text-sm text-foreground" numberOfLines={2}>
            {post.caption}
          </Text>
        ) : null}

        {scheduledLabel ? (
          <Text className="mt-1 text-xs text-muted">
            {post.status === 'published' ? 'Posted' : 'Scheduled'}:{' '}
            {new Date(scheduledLabel).toLocaleString()}
          </Text>
        ) : null}

        {post.status === 'failed' && post.error_message ? (
          <Text className="mt-1 text-xs text-red-400" numberOfLines={1}>
            {post.error_message}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
