import type { PostAnalytics, ScheduledPost } from '@clippster/api-client';
import { formatMetricCount, getSocialPlatformLabel } from '@clippster/api-client';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { tokens } from '@/theme/tokens';
import { appAlert } from '@/lib/appAlert';

interface PostAnalyticsSheetProps {
  visible: boolean;
  post: ScheduledPost | null;
  onClose: () => void;
  onCancel?: (postId: number) => Promise<void>;
  onRetry?: (postId: number) => Promise<void>;
  onUpdate?: (postId: number, data: { caption?: string; scheduled_at?: string }) => Promise<void>;
}

interface MetricRowProps {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
}

function MetricRow({ label, value, icon }: MetricRowProps) {
  return (
    <View className="flex-row items-center justify-between rounded-lg bg-surfaceMuted px-4 py-3">
      <View className="flex-row items-center gap-2">
        <Ionicons name={icon} size={18} color={tokens.colors.muted} />
        <Text className="text-sm text-muted">{label}</Text>
      </View>
      <Text className="text-base font-semibold text-foreground">{formatMetricCount(value)}</Text>
    </View>
  );
}

function AnalyticsGrid({ analytics }: { analytics: PostAnalytics }) {
  const hasMetrics =
    analytics.view_count > 0 ||
    analytics.like_count > 0 ||
    analytics.comment_count > 0 ||
    analytics.save_count > 0 ||
    analytics.reach_count > 0 ||
    analytics.impressions_count > 0;

  if (!hasMetrics) {
    return (
      <View className="rounded-lg bg-surfaceMuted px-4 py-6">
        <Text className="text-center text-sm text-muted">
          Metrics sync after publish. Check back in a few hours.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-2">
      <MetricRow label="Views" value={analytics.view_count} icon="eye-outline" />
      <MetricRow label="Likes" value={analytics.like_count} icon="heart-outline" />
      <MetricRow label="Comments" value={analytics.comment_count} icon="chatbubble-outline" />
      <MetricRow label="Saves" value={analytics.save_count} icon="bookmark-outline" />
      <MetricRow label="Reach" value={analytics.reach_count} icon="people-outline" />
      <MetricRow label="Impressions" value={analytics.impressions_count} icon="stats-chart-outline" />
    </View>
  );
}

export function PostAnalyticsSheet({
  visible,
  post,
  onClose,
  onCancel,
  onRetry,
  onUpdate,
}: PostAnalyticsSheetProps) {
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  if (!post) return null;

  function openEdit() {
    setCaption(post?.caption ?? '');
    setScheduledAt(post?.scheduled_at ? new Date(post.scheduled_at).toISOString().slice(0, 16) : '');
    setEditing(true);
  }

  async function handleCancel() {
    if (!post || !onCancel) return;
    appAlert('Cancel post', 'Remove this post from the schedule?', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel post',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setActionLoading(true);
            try {
              await onCancel(post.id);
              onClose();
            } finally {
              setActionLoading(false);
            }
          })();
        },
      },
    ]);
  }

  async function handleRetry() {
    if (!post || !onRetry) return;
    setActionLoading(true);
    try {
      await onRetry(post.id);
      onClose();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSaveEdit() {
    if (!post || !onUpdate) return;
    setActionLoading(true);
    try {
      const data: { caption?: string; scheduled_at?: string } = {};
      if (caption !== (post.caption ?? '')) data.caption = caption;
      if (scheduledAt) {
        const parsed = new Date(scheduledAt);
        if (!Number.isNaN(parsed.getTime())) {
          data.scheduled_at = parsed.toISOString();
        }
      }
      await onUpdate(post.id, data);
      setEditing(false);
      onClose();
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/70">
        <View className="max-h-[85%] rounded-t-2xl bg-background">
          <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
            <Text className="text-lg font-semibold text-foreground">
              {getSocialPlatformLabel(post.platform)} post
            </Text>
            <Pressable onPress={onClose}>
              <Text className="text-primary">Close</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerClassName="gap-4 px-4 py-4">
            {post.caption && !editing ? (
              <Text className="text-base text-foreground">{post.caption}</Text>
            ) : null}

            {editing ? (
              <View className="gap-3">
                <View>
                  <Text className="mb-1 text-sm text-muted">Caption</Text>
                  <Input
                    value={caption}
                    onChangeText={setCaption}
                    multiline
                    numberOfLines={4}
                    className="min-h-[80px]"
                  />
                </View>
                <View>
                  <Text className="mb-1 text-sm text-muted">Schedule time (local)</Text>
                  <Input
                    value={scheduledAt}
                    onChangeText={setScheduledAt}
                    placeholder="YYYY-MM-DDTHH:mm"
                  />
                </View>
                <View className="flex-row gap-2">
                  <Button
                    title="Save"
                    className="flex-1"
                    disabled={actionLoading}
                    onPress={() => void handleSaveEdit()}
                  />
                  <Button
                    title="Cancel"
                    variant="outline"
                    className="flex-1"
                    onPress={() => setEditing(false)}
                  />
                </View>
              </View>
            ) : (
              <>
                <AnalyticsGrid analytics={post.analytics} />

                {post.status === 'failed' && post.error_message ? (
                  <View className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
                    <Text className="text-sm text-red-400">{post.error_message}</Text>
                  </View>
                ) : null}

                <View className="gap-2">
                  {post.post_url ? (
                    <Button
                      title="Open post"
                      variant="outline"
                      onPress={() => void WebBrowser.openBrowserAsync(post.post_url!)}
                    />
                  ) : null}
                  {post.can_edit && onUpdate ? (
                    <Button title="Edit caption & time" variant="outline" onPress={openEdit} />
                  ) : null}
                  {post.can_cancel && onCancel ? (
                    <Button
                      title="Cancel scheduled post"
                      variant="outline"
                      disabled={actionLoading}
                      onPress={() => void handleCancel()}
                    />
                  ) : null}
                  {post.status === 'failed' && onRetry ? (
                    <Button
                      title="Retry"
                      disabled={actionLoading}
                      onPress={() => void handleRetry()}
                    />
                  ) : null}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
