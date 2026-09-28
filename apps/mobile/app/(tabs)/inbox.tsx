import type { SharedClip } from '@clippster/api-client';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SharedClipCard } from '@/components/inbox/SharedClipCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { sharedClipsApi } from '@/services/api';
import { tokens } from '@/theme/tokens';

export default function InboxScreen() {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clips, setClips] = useState<SharedClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
    const response = await sharedClipsApi.getUserSharedClips();
    if (!response.success) throw new Error('Could not load shared clips.');
    if (response.success) {
      setClips(response.clips);
      setLoadError(null);
    }
    } catch (error) {setLoadError(error instanceof Error ? error.message : 'Could not load shared clips.');}
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
      <ScreenHeader title="Shared clips" subtitle="Clips distributed by your organizations" />
      {loadError ? <Text className="px-5 py-3 text-sm text-destructive">{loadError} Pull down to retry.</Text> : null}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={tokens.colors.accent} />
        </View>
      ) : (
        <FlatList
          data={clips}
          keyExtractor={(item) => String(item.id)}
          contentContainerClassName="px-5 py-4 pb-8"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListEmptyComponent={
            <EmptyState
              icon="mail-open-outline"
              title="No shared clips"
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
