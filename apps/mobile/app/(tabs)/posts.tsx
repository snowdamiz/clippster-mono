import type { ScheduledPost, ScheduledPostStatus } from '@clippster/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { PostAnalyticsSheet } from '@/components/posts/PostAnalyticsSheet';
import { PostCard } from '@/components/posts/PostCard';
import { analyticsApi, organizationsApi, schedulingApi } from '@/services/api';
import { tokens } from '@/theme/tokens';

type StatusFilter = 'all' | ScheduledPostStatus;

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'published', label: 'Published' },
  { id: 'failed', label: 'Failed' },
];

export default function PostsScreen() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadPosts = useCallback(async (status?: string) => {
    const response = await schedulingApi.listScheduledPosts(status);
    const personal = response.success ? response.posts : [];

    const orgResponse = await organizationsApi.listMyOrganizations();
    const orgPosts: ScheduledPost[] = [];
    if (orgResponse.success) {
      for (const org of orgResponse.organizations) {
        const orgList = await schedulingApi.listOrgScheduledPosts(org.id, { status });
        if (orgList.success) {
          orgPosts.push(...orgList.posts);
        }
      }
    }

    const merged = [...personal, ...orgPosts].sort(
      (a, b) => new Date(b.inserted_at).getTime() - new Date(a.inserted_at).getTime(),
    );
    setPosts(merged);
  }, []);

  async function refresh() {
    setRefreshing(true);
    try {
      await loadPosts(filter === 'all' ? undefined : filter);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        await loadPosts();
      } finally {
        setLoading(false);
      }
    })();
  }, [loadPosts]);

  useEffect(() => {
    void loadPosts(filter === 'all' ? undefined : filter);
  }, [filter, loadPosts]);

  useEffect(() => {
    const hasPublishing = posts.some((p) => p.status === 'publishing');
    if (hasPublishing) {
      refreshTimer.current = setInterval(() => {
        void loadPosts(filter === 'all' ? undefined : filter);
      }, 30_000);
    }
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [posts, filter, loadPosts]);

  async function handleCancel(postId: number) {
    const response = await schedulingApi.cancelScheduledPost(postId);
    if (response.success) {
      void analyticsApi.trackEvent({ event_type: 'post_cancelled', metadata: { post_id: postId } });
      await refresh();
    }
  }

  async function handleRetry(postId: number) {
    const response = await schedulingApi.retryScheduledPost(postId);
    if (response.success) {
      await refresh();
    }
  }

  async function handleUpdate(
    postId: number,
    data: { caption?: string; scheduled_at?: string },
  ) {
    const response = await schedulingApi.updateScheduledPost(postId, data);
    if (response.success) {
      await refresh();
    }
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Posts" />
      <View className="flex-row flex-wrap gap-2 px-4 py-2">
        {FILTERS.map((item) => {
          const active = filter === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setFilter(item.id)}
              className={`rounded-full px-3 py-1.5 ${active ? 'bg-primary' : 'bg-surface border border-border'}`}
            >
              <Text className={`text-sm ${active ? 'text-white' : 'text-muted'}`}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={tokens.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          contentContainerClassName="px-4 pb-4"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
          ListEmptyComponent={
            <Text className="py-8 text-center text-muted">
              No posts yet. Export a clip and schedule it to get started.
            </Text>
          }
          renderItem={({ item }) => (
            <PostCard post={item} onPress={() => setSelectedPost(item)} />
          )}
        />
      )}

      <PostAnalyticsSheet
        visible={!!selectedPost}
        post={selectedPost}
        onClose={() => setSelectedPost(null)}
        onCancel={handleCancel}
        onRetry={handleRetry}
        onUpdate={handleUpdate}
      />
    </View>
  );
}
