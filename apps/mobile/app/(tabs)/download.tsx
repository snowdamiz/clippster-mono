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
import { ScreenHeader } from '@/components/ScreenHeader';
import { VodResultCard } from '@/components/download/VodResultCard';
import { DownloadOptionsSheet, type DownloadPlan } from '@/components/download/DownloadOptionsSheet';
import { DownloadProgressCard } from '@/components/DownloadProgressCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAccount } from '@/context/AccountContext';
import type { MediaPlatform, VodListItem } from '@clippster/shared-types';
import {
  detectPlatformFromInput,
  isDirectVideoUrl,
  PLATFORM_LABELS,
} from '@/lib/platformDetection';
import { mediaApi, kickApi } from '@/services/api';
import { getTokendVods } from '@/services/tokend';
import { extractKickChannelSlug, kickClipToVodItem } from '@/lib/kick';
import { enrichVodList, enrichVodListItem } from '@/lib/vodList';
import { tokens } from '@/theme/tokens';
import {
  cancelDownload,
  enqueueDownloadPlan,
  getDownloadJobs,
  initDownloadQueue,
  removeDownload,
  retryDownload,
  subscribeDownloadQueue,
  type DownloadJob,
} from '@/services/downloadQueue';

type CatalogTab = 'streams' | 'videos';

export default function DownloadScreen() {
  const { requireSubscription } = useAccount();
  const [searchInput, setSearchInput] = useState('');
  const [detectedPlatform, setDetectedPlatform] = useState<MediaPlatform | null>(null);
  const [vods, setVods] = useState<VodListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [catalogTab, setCatalogTab] = useState<CatalogTab>('streams');
  const [lastSearch, setLastSearch] = useState('');
  const [downloadTarget, setDownloadTarget] = useState<{
    item: VodListItem;
    platform: MediaPlatform;
  } | null>(null);
  const [downloadStarting, setDownloadStarting] = useState(false);

  useEffect(() => {
    void initDownloadQueue();
    return subscribeDownloadQueue(setJobs);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setJobs(getDownloadJobs());
    }, []),
  );

  async function handleSearch(tabOverride?: CatalogTab) {
    const input = searchInput.trim();
    if (!input) {
      setError('Paste a stream link, channel URL, or @handle');
      return;
    }

    const platform = detectPlatformFromInput(input);
    if (!platform) {
      setError(
        'Could not detect the platform. Try a YouTube, Kick, Twitch, Rumble, Tokend, or X URL — or a channel @handle.',
      );
      return;
    }

    setDetectedPlatform(platform);
    setLoading(true);
    setError(null);
    setVods([]);
    setLastSearch(input);

    const tab = tabOverride ?? catalogTab;

    try {
      if (platform === 'tokend') {
        const items = await getTokendVods(input, 20, tab);
        setVods(
          enrichVodList(
            items.map((item) => ({
              id: item.id,
              title: item.title,
              duration_seconds: item.duration_seconds,
              thumbnail_url: item.thumbnail_url,
              url: item.url || item.id,
              upload_date: item.upload_date,
              download_url: item.url || item.id,
            })),
          ),
        );
        if (items.length === 0) {
          setError(`No ${tab} found for this creator.`);
        }
        return;
      }

      if (platform === 'kick' && !isDirectVideoUrl(platform, input)) {
        const slug = extractKickChannelSlug(input);
        if (!slug) {
          throw new Error('Invalid Kick channel URL or username. Try https://kick.com/asmongold or asmongold');
        }

        const result = await kickApi.getClips(slug, 30);
        if (!result.success) {
          throw new Error(result.error ?? 'Failed to load Kick VODs');
        }

        const items = result.clips
          .filter((clip) => !clip.isLive)
          .map((clip) => kickClipToVodItem(clip, slug))
          .filter((item) => item.download_url || item.url);

        setVods(enrichVodList(items));
        if (items.length === 0) {
          setError('No VODs found for this channel.');
        }
        return;
      }

      if (isDirectVideoUrl(platform, input)) {
        const resolved = await mediaApi.resolveUrl(input, { platform });
        if (!resolved.success) {
          throw new Error(resolved.error ?? 'Could not resolve this video URL');
        }
        setVods([
          enrichVodListItem({
            id: resolved.source_id,
            title: resolved.title,
            duration_seconds: resolved.duration_seconds,
            thumbnail_url: resolved.thumbnail_url,
            url: input,
            download_url: input,
          }),
        ]);
        return;
      }

      const response = await mediaApi.listVods(platform, input, { limit: 20 });
      if (!response.success) {
        throw new Error(response.error ?? 'Failed to load VODs');
      }
      const channelLabel =
        platform === 'kick'
          ? extractKickChannelSlug(input)
          : input.replace(/^https?:\/\//, '').split('/').pop() ?? null;
      setVods(
        enrichVodList(
          response.vods.map((vod) => ({
            ...vod,
            uploader: vod.uploader ?? channelLabel,
          })),
        ),
      );
      if (response.vods.length === 0) {
        setError('No VODs found for this channel.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setVods([]);
    } finally {
      setLoading(false);
    }
  }

  function openDownloadOptions(item: VodListItem, platform: MediaPlatform) {
    if (!item.url && !item.download_url) return;
    setError(null);
    setDownloadTarget({ item, platform });
  }

  async function confirmDownload(plan: DownloadPlan) {
    if (!downloadTarget) return;
    const { item, platform } = downloadTarget;

    const allowed = await requireSubscription({
      context: `Download "${item.title ?? 'VOD'}"`,
      type: 'download',
    });
    if (!allowed) return;

    setDownloadStarting(true);
    setError(null);
    try {
      await enqueueDownloadPlan({
        sourceUrl: item.url ?? item.download_url!,
        streamUrl: item.download_url ?? undefined,
        channelSlug:
          platform === 'kick'
            ? extractKickChannelSlug(lastSearch) ?? item.uploader ?? undefined
            : item.uploader ?? undefined,
        thumbnailUrl: item.thumbnail_url ?? undefined,
        platform,
        title: item.title ?? undefined,
        totalDurationSeconds: item.duration_seconds ?? undefined,
        segmentRange: plan.segmentRange,
        autoSegment: plan.autoSegment,
        autoSegmentDurationMinutes: plan.autoSegmentDurationMinutes,
      });
      setDownloadTarget(null);
      router.replace('/(tabs)/projects');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDownloadStarting(false);
    }
  }

  async function switchCatalogTab(tab: CatalogTab) {
    setCatalogTab(tab);
    if (lastSearch && detectedPlatform === 'tokend') {
      await handleSearch(tab);
    }
  }

  const showCatalogTabs =
    detectedPlatform === 'tokend' && (vods.length > 0 || loading || lastSearch.length > 0);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Create" subtitle="Search a channel to browse and download VODs" />
      <DownloadProgressCard
        jobs={jobs}
        onOpenProject={(projectId) => router.push(`/project/${projectId}`)}
        onRetry={(jobId) => void retryDownload(jobId)}
        onCancel={(jobId) => void cancelDownload(jobId)}
        onRemove={(jobId) => void removeDownload(jobId)}
      />

      <DownloadOptionsSheet
        visible={downloadTarget != null}
        item={downloadTarget?.item ?? null}
        platform={downloadTarget?.platform ?? null}
        starting={downloadStarting}
        onClose={() => {
          if (!downloadStarting) setDownloadTarget(null);
        }}
        onConfirm={(plan) => void confirmDownload(plan)}
      />

      <ScrollView contentContainerClassName="px-4 py-4">
        <View className="flex-row items-center gap-2">
          {detectedPlatform ? (
            <View className="rounded-full border border-border bg-surface px-3 py-1">
              <Text className="text-xs font-semibold text-accent">
                {PLATFORM_LABELS[detectedPlatform]}
              </Text>
            </View>
          ) : null}
          <View className="flex-1">
            <Input
              value={searchInput}
              onChangeText={(text) => {
                setSearchInput(text);
                setDetectedPlatform(detectPlatformFromInput(text));
              }}
              onSubmitEditing={() => void handleSearch()}
              placeholder="Channel URL or @handle (e.g. kick.com/asmongold)"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>
        </View>

        <View className="mt-3">
          <Button
            title={loading ? 'Searching…' : 'Search'}
            onPress={() => void handleSearch()}
            disabled={loading || !searchInput.trim()}
          />
        </View>

        {showCatalogTabs ? (
          <View className="mt-4 flex-row gap-2">
            {(['streams', 'videos'] as const).map((tab) => (
              <Pressable
                key={tab}
                className={`flex-1 rounded-lg border px-3 py-2 ${
                  catalogTab === tab ? 'border-accent bg-accent/10' : 'border-border bg-surface'
                }`}
                onPress={() => void switchCatalogTab(tab)}
              >
                <Text
                  className={`text-center text-sm font-medium ${
                    catalogTab === tab ? 'text-accent' : 'text-muted'
                  }`}
                >
                  {tab === 'streams' ? 'Streams' : 'Videos'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator className="mt-8" color={tokens.colors.primary} />
        ) : null}

        {!loading && vods.length > 0 ? (
          <View className="mt-6">
            <View className="mb-4 gap-1">
              <Text className="text-lg font-bold text-foreground">Stream VOD library</Text>
              <Text className="text-sm text-muted">
                {vods.length} {vods.length === 1 ? 'item' : 'items'}
              </Text>
            </View>
            <FlatList
              data={vods}
              scrollEnabled={false}
              keyExtractor={(item, index) => item.id ?? item.url ?? String(index)}
              renderItem={({ item }) => (
                <VodResultCard
                  item={item}
                  platform={detectedPlatform ?? undefined}
                  onDownload={() => {
                    const platform = detectedPlatform ?? detectPlatformFromInput(lastSearch);
                    if (!platform || platform === 'manual') return;
                    openDownloadOptions(item, platform);
                  }}
                />
              )}
            />
          </View>
        ) : null}

        {!loading && !error && vods.length === 0 && lastSearch ? (
          <Text className="mt-6 text-center text-sm text-muted">No VODs to show.</Text>
        ) : null}

        {error ? <Text className="mt-4 text-sm text-destructive">{error}</Text> : null}
      </ScrollView>
    </View>
  );
}
