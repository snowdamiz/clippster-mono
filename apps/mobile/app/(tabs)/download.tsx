import * as DocumentPicker from 'expo-document-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { DownloadProgressCard } from '@/components/DownloadProgressCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { MediaPlatform, VodListItem } from '@clippster/shared-types';
import { MOBILE_PLATFORMS, detectPlatformFromUrl, getPlatformConfig } from '@/config/platforms';
import { mediaApi } from '@/services/api';
import {
  cancelDownload,
  enqueueDownload,
  getDownloadJobs,
  importLocalVideo,
  initDownloadQueue,
  retryDownload,
  subscribeDownloadQueue,
  type DownloadJob,
} from '@/services/downloadQueue';

export default function DownloadScreen() {
  const [selectedPlatform, setSelectedPlatform] = useState<MediaPlatform>('youtube');
  const [urlInput, setUrlInput] = useState('');
  const [channelInput, setChannelInput] = useState('');
  const [vods, setVods] = useState<VodListItem[]>([]);
  const [loadingVods, setLoadingVods] = useState(false);
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const platform = getPlatformConfig(selectedPlatform);

  useEffect(() => {
    void initDownloadQueue();
    return subscribeDownloadQueue(setJobs);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setJobs(getDownloadJobs());
    }, []),
  );

  async function handlePasteDownload() {
    setError(null);
    const url = urlInput.trim();
    if (!url) return;

    const detected = detectPlatformFromUrl(url) ?? selectedPlatform;
    try {
      await enqueueDownload({ sourceUrl: url, platform: detected });
      setUrlInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleBrowseVods() {
    setError(null);
    const channel = channelInput.trim();
    if (!channel || !platform?.supportsChannelBrowse) return;

    setLoadingVods(true);
    try {
      const response = await mediaApi.listVods(selectedPlatform, channel, { limit: 20 });
      if (!response.success) {
        throw new Error(response.error ?? 'Failed to load VODs');
      }
      setVods(response.vods);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setVods([]);
    } finally {
      setLoadingVods(false);
    }
  }

  async function handleImport() {
    setError(null);
    setImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const projectId = await importLocalVideo({
        sourceUri: asset.uri,
        filename: asset.name ?? 'imported.mp4',
        title: asset.name?.replace(/\.[^.]+$/, '') ?? 'Imported video',
      });
      router.push(`/project/${projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Download" subtitle="Resolve streams on the server, download on device" />
      <DownloadProgressCard
        jobs={jobs}
        onOpenProject={(projectId) => router.push(`/project/${projectId}`)}
        onRetry={(jobId) => void retryDownload(jobId)}
        onCancel={(jobId) => void cancelDownload(jobId)}
      />

      <ScrollView contentContainerClassName="px-4 py-4">
        <Text className="mb-2 text-sm font-semibold text-muted">Platform</Text>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {MOBILE_PLATFORMS.map((item) => (
            <Pressable
              key={item.id}
              className={`rounded-full border px-3 py-2 ${
                selectedPlatform === item.id ? 'border-primary bg-primary/20' : 'border-border bg-surface'
              }`}
              onPress={() => {
                setSelectedPlatform(item.id);
                setVods([]);
              }}
            >
              <Text className="text-sm text-foreground">{item.name}</Text>
            </Pressable>
          ))}
        </View>

        <Text className="mb-2 text-sm font-semibold text-muted">Paste URL</Text>
        <Input
          value={urlInput}
          onChangeText={setUrlInput}
          placeholder={platform?.searchPlaceholder ?? 'Paste video URL'}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View className="mt-3">
          <Button title="Download" onPress={() => void handlePasteDownload()} disabled={!urlInput.trim()} />
        </View>

        {platform?.supportsChannelBrowse ? (
          <View className="mt-8">
            <Text className="mb-2 text-sm font-semibold text-muted">Channel browse</Text>
            <Input
              value={channelInput}
              onChangeText={setChannelInput}
              placeholder={platform.searchPlaceholder}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View className="mt-3">
              <Button
                title={loadingVods ? 'Loading…' : 'Browse VODs'}
                variant="outline"
                onPress={() => void handleBrowseVods()}
                disabled={loadingVods || !channelInput.trim()}
              />
            </View>
            {loadingVods ? (
              <ActivityIndicator className="mt-4" color="#8b5cf6" />
            ) : (
              <FlatList
                className="mt-4"
                data={vods}
                scrollEnabled={false}
                keyExtractor={(item, index) => item.id ?? item.url ?? String(index)}
                ListEmptyComponent={
                  channelInput ? (
                    <Text className="text-sm text-muted">No VODs loaded yet.</Text>
                  ) : null
                }
                renderItem={({ item }) => (
                  <Pressable
                    className="mb-2 rounded-lg border border-border bg-surface px-3 py-3"
                    onPress={() => {
                      if (!item.url) return;
                      void enqueueDownload({
                        sourceUrl: item.url,
                        platform: selectedPlatform,
                        title: item.title ?? undefined,
                      });
                    }}
                  >
                    <Text className="font-medium text-foreground" numberOfLines={2}>
                      {item.title ?? 'Untitled'}
                    </Text>
                    {item.duration_seconds != null ? (
                      <Text className="mt-1 text-xs text-muted">
                        {Math.round(item.duration_seconds / 60)} min
                      </Text>
                    ) : null}
                  </Pressable>
                )}
              />
            )}
          </View>
        ) : null}

        <View className="mt-8 rounded-xl border border-dashed border-border px-4 py-5">
          <Text className="text-base font-semibold text-foreground">Import from Files</Text>
          <Text className="mt-1 text-sm text-muted">Pick a local MP4/MOV without a platform URL.</Text>
          <View className="mt-4">
            <Button title={importing ? 'Importing…' : 'Import video'} variant="outline" onPress={() => void handleImport()} disabled={importing} />
          </View>
        </View>

        {error ? <Text className="mt-4 text-sm text-destructive">{error}</Text> : null}
      </ScrollView>
    </View>
  );
}
