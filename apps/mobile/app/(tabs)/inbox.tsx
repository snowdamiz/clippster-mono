import type { SharedClip } from '@clippster/api-client';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  View,
} from 'react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SharedClipCard } from '@/components/inbox/SharedClipCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { sharedClipsApi } from '@/services/api';
import { tokens } from '@/theme/tokens';

export default function InboxScreen() {
  const [clips, setClips] = useState<SharedClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const response = await sharedClipsApi.getUserSharedClips();
    if (response.success) {
      setClips(response.clips);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Shared Clips" subtitle="Clips distributed by your organizations" />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={tokens.colors.accent} />
        </View>
      ) : (
        <FlatList
          data={clips}
          keyExtractor={(item) => String(item.id)}
          contentContainerClassName="gap-3 px-4 py-4 pb-8"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListEmptyComponent={
            <EmptyState
              icon="mail-open-outline"
              title="Inbox empty"
              subtitle="No shared clips from your organizations yet."
            />
          }
          renderItem={({ item }) => (
            <SharedClipCard clip={item} onPress={() => router.push(`/inbox/${item.id}`)} />
          )}
        />
      )}
    </View>
  );
}
