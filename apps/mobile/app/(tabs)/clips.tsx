import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ExportPreview } from '@/components/export/ExportPreview';
import { MenuRow } from '@/components/navigation/MenuRow';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PostSheet } from '@/components/schedule/PostSheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import { PostsSheet } from '@/components/me/PostsSheet';
import { Input } from '@/components/ui/input';
import { appAlert } from '@/lib/appAlert';
import { toLocalImageUri } from '@/lib/formatTime';
import { generateBuildThumbnail } from '@/services/clipThumbnailGeneration';
import {
  deleteClipBuild,
  getCompletedClipBuildsWithDetails,
  setClipBuildThumbnail,
  type BuiltClipItem,
} from '@/services/database';
import { saveMediaCopyToPickedFolder } from '@/services/saveMediaCopy';
import { tokens } from '@/theme/tokens';

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

function sanitizeExportFileName(clipName: string, buildId: string): string {
  const base = clipName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim() || 'clip';
  return `${base}_${buildId.slice(0, 8)}.mp4`;
}

export default function ClipsScreen() {
  const [showPosts, setShowPosts] = useState(false);
  const [items, setItems] = useState<BuiltClipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<BuiltClipItem | null>(null);
  const [search, setSearch] = useState('');
  const [postBuildId, setPostBuildId] = useState<string | null>(null);
  const [savingBuildId, setSavingBuildId] = useState<string | null>(null);

  const backfillMissingThumbnails = useCallback(async (rows: BuiltClipItem[]) => {
    const missing = rows.filter((item) => !item.build.thumbnail_path && item.build.file_path);
    if (missing.length === 0) return null;

    const next = [...rows];
    let updated = 0;
    for (const item of missing) {
      const thumbAt = Math.min(1, Math.max(0.1, (item.build.duration ?? 2) * 0.1));
      const thumb = await generateBuildThumbnail(item.build.file_path, item.build.id, thumbAt);
      if (!thumb) continue;
      await setClipBuildThumbnail(item.build.id, thumb);
      const index = next.findIndex((row) => row.build.id === item.build.id);
      if (index >= 0) {
        next[index] = {
          ...next[index],
          build: { ...next[index].build, thumbnail_path: thumb },
        };
        updated += 1;
      }
    }
    return updated > 0 ? next : null;
  }, []);

  const loadClips = useCallback(async () => {
    try {
      const rows = await getCompletedClipBuildsWithDetails(100);
      setItems(rows);
      const withThumbs = await backfillMissingThumbnails(rows);
      if (withThumbs) setItems(withThumbs);
    } finally {
      setLoading(false);
    }
  }, [backfillMissingThumbnails]);

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

  function openProject(item: BuiltClipItem) {
    if (!item.projectId) return;
    router.push(`/project/${item.projectId}`);
  }

  async function saveCopy(item: BuiltClipItem) {
    setSavingBuildId(item.build.id);
    try {
      const result = await saveMediaCopyToPickedFolder(
        item.build.file_path,
        sanitizeExportFileName(item.clipName, item.build.id),
      );
      if (result === 'saved') {
        appAlert('Saved', 'A copy of the export was saved to the folder you chose.');
      }
    } catch (error) {
      appAlert('Save failed', error instanceof Error ? error.message : String(error));
    } finally {
      setSavingBuildId(null);
    }
  }

  function confirmDelete(item: BuiltClipItem) {
    appAlert(
      'Delete export',
      `Delete “${item.clipName}” from the app and remove the local video file?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await deleteClipBuild(item.build.id);
              setItems((prev) => prev.filter((row) => row.build.id !== item.build.id));
            })();
          },
        },
      ],
    );
  }

  function renderItem({ item }: { item: BuiltClipItem }) {
    const thumbUri = toLocalImageUri(item.build.thumbnail_path);
    const metadata = [formatDuration(item.build.duration), formatFileSize(item.build.file_size), ...parseAspectRatios(item.build.aspect_ratios)].join(' · ');
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.clipName}`} onPress={() => setSelected(item)} style={styles.row}>
        <View style={styles.thumbnail}>
          {thumbUri ? <Image source={{ uri: thumbUri }} style={styles.image} resizeMode="cover" /> : <Ionicons name="film-outline" size={24} color={tokens.colors.muted} />}
        </View>
        <View style={styles.details}>
          <Text style={styles.title} numberOfLines={2}>{item.clipName}</Text>
          <Text style={styles.metadata}>{metadata}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={tokens.colors.muted} />
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
      <ScreenHeader title="Exports" />
      <View className="gap-[17px] px-5 pt-2 pb-3">
        {!showPosts ? <Input value={search} onChangeText={setSearch} placeholder="Search exports" autoCapitalize="none" autoCorrect={false} /> : null}
        <Tabs items={[{ key: 'exports', label: 'Exports' }, { key: 'posts', label: 'Posts' }]} value={showPosts ? 'posts' : 'exports'} onChange={key => setShowPosts(key === 'posts')} />
      </View>
      {showPosts ? <PostsSheet embedded visible onClose={() => setShowPosts(false)} /> : <FlatList
        data={filtered}
        keyExtractor={(item) => item.build.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={tokens.colors.accent} />}
        ListEmptyComponent={
          <Card className="items-center gap-3 py-8">
            <Ionicons name="film-outline" size={40} color={tokens.colors.muted} />
            <Text className="text-center text-base font-medium text-foreground">{search.trim() ? 'No matching exports' : 'Your clips, ready to share'}</Text>
            <Text className="text-center text-sm text-muted">
              {search.trim() ? 'Try another clip or project name.' : 'Export your first clip from a project. Find every finished video here.'}
            </Text>
            <Button title="Go to video library" variant="outline" onPress={() => router.push('/(tabs)/projects')} />
          </Card>
        }
      />}
      <BottomSheet visible={selected != null} onClose={() => setSelected(null)} title={selected?.clipName ?? 'Clip options'} subtitle={selected ? [formatDuration(selected.build.duration), formatFileSize(selected.build.file_size), ...parseAspectRatios(selected.build.aspect_ratios)].join(' · ') : undefined}>
        {selected ? <View style={{ gap: 8 }}>
          <ExportPreview path={selected.build.file_path} />
          <MenuRow icon="arrow-up-circle-outline" title="Post clip" subtitle="Share to your connected accounts" onPress={() => { setSelected(null); setPostBuildId(selected.build.id); }} />
          {selected.projectId ? <MenuRow icon="folder-open-outline" title="Open project" onPress={() => { setSelected(null); openProject(selected); }} /> : null}
          <MenuRow icon="download-outline" title={savingBuildId === selected.build.id ? 'Saving…' : 'Save a copy'} subtitle="Choose a folder on your device" onPress={() => { if (savingBuildId !== selected.build.id) void saveCopy(selected); }} />
          <MenuRow icon="trash-outline" title="Delete export" destructive onPress={() => { setSelected(null); confirmDelete(selected); }} />
        </View> : null}
      </BottomSheet>
      <PostSheet
        visible={postBuildId != null}
        buildId={postBuildId}
        onClose={() => setPostBuildId(null)}
      />
    </View>
  );
}


const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tokens.colors.border, gap: 12 },
  thumbnail: { width: 72, height: 58, borderRadius: 10, overflow: 'hidden', backgroundColor: tokens.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  details: { flex: 1, gap: 4 },
  title: { color: tokens.colors.foreground, fontSize: 14, lineHeight: 19, fontWeight: '600' },
  metadata: { color: tokens.colors.muted, fontSize: 12, lineHeight: 18 },
});
