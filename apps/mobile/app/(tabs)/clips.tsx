import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  getCompletedClipBuildsWithDetails,
  type BuiltClipItem,
} from '@/services/database';
import { tokens } from '@/theme/tokens';
import { appAlert } from '@/lib/appAlert';

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseAspectRatios(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export default function ClipsScreen() {
  const [items, setItems] = useState<BuiltClipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const loadClips = useCallback(async () => {
    try {
      const rows = await getCompletedClipBuildsWithDetails(100);
      setItems(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadClips();
    }, [loadClips]),
  );

  async function refresh() {
    setRefreshing(true);
    try {
      await loadClips();
    } finally {
      setRefreshing(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.clipName.toLowerCase().includes(q) ||
        (item.projectName?.toLowerCase().includes(q) ?? false),
    );
  }, [items, search]);

  async function shareClip(item: BuiltClipItem) {
    if (!(await Sharing.isAvailableAsync())) {
      appAlert('Unavailable', 'Sharing is not available on this device.');
      return;
    }
    await Sharing.shareAsync(item.build.file_path, { mimeType: 'video/mp4' });
  }

  function openProject(item: BuiltClipItem) {
    if (!item.projectId) return;
    router.push(`/project/${item.projectId}`);
  }

  function renderItem({ item }: { item: BuiltClipItem }) {
    const ratios = parseAspectRatios(item.build.aspect_ratios);
    const ratioLabel = ratios.length > 0 ? ratios.join(', ') : null;

    return (
      <Pressable
        onPress={() => openProject(item)}
        className="mb-3 overflow-hidden rounded-xl border border-border bg-surface"
      >
        <View className="aspect-video w-full bg-surfaceMuted">
          {item.build.thumbnail_path ? (
            <Image source={{ uri: item.build.thumbnail_path }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Ionicons name="film-outline" size={32} color={tokens.colors.muted} />
            </View>
          )}
        </View>
        <View className="gap-1 p-3">
          <Text className="font-medium text-foreground" numberOfLines={1}>
            {item.clipName}
          </Text>
          {item.projectName ? (
            <Text className="text-xs text-muted" numberOfLines={1}>
              {item.projectName}
            </Text>
          ) : null}
          <View className="mt-1 flex-row flex-wrap gap-2">
            <Text className="text-xs text-muted">{formatDuration(item.build.duration)}</Text>
            <Text className="text-xs text-muted">·</Text>
            <Text className="text-xs text-muted">{formatFileSize(item.build.file_size)}</Text>
            {ratioLabel ? (
              <>
                <Text className="text-xs text-muted">·</Text>
                <Text className="text-xs text-muted">{ratioLabel}</Text>
              </>
            ) : null}
          </View>
          <View className="mt-2 flex-row gap-2">
            {item.projectId ? (
              <Pressable
                onPress={() => openProject(item)}
                className="rounded-lg border border-border px-3 py-1.5"
              >
                <Text className="text-xs text-foreground">Open project</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => router.push(`/schedule/${item.build.id}`)}
              className="rounded-lg bg-primary px-3 py-1.5"
            >
              <Text className="text-xs font-semibold text-primary-foreground">Post</Text>
            </Pressable>
            <Pressable
              onPress={() => void shareClip(item)}
              className="rounded-lg border border-border px-3 py-1.5"
            >
              <Text className="text-xs text-foreground">Share</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={tokens.colors.accent} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Exports" subtitle="Built clips ready to post" />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.build.id}
        renderItem={renderItem}
        contentContainerClassName="px-4 py-4 pb-10"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <View className="mb-4 gap-3">
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Search clips…"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text className="text-sm text-muted">
              {filtered.length} clip{filtered.length === 1 ? '' : 's'}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Card className="items-center gap-3 py-8">
            <Ionicons name="film-outline" size={40} color={tokens.colors.muted} />
            <Text className="text-center text-base font-medium text-foreground">No built clips yet</Text>
            <Text className="text-center text-sm text-muted">
              Export clips from a project and they will appear here — just like on desktop.
            </Text>
            <Button title="Go to video library" variant="outline" onPress={() => router.push('/(tabs)/projects')} />
          </Card>
        }
      />
    </View>
  );
}
