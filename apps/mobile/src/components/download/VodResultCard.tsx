import { Ionicons } from '@expo/vector-icons';
import type { MediaPlatform, VodListItem } from '@clippster/shared-types';
import { Image, Pressable, Text, View } from 'react-native';
import { VodPlatformBadge } from '@/components/download/VodPlatformBadge';
import {
  formatStreamedDate,
  formatStreamedRelative,
  formatVodDuration,
  formatViewCount,
} from '@/lib/vodDisplay';

interface VodResultCardProps {
  item: VodListItem;
  platform?: MediaPlatform;
  onDownload: () => void;
}

function MetaDot() {
  return <View className="h-1 w-1 rounded-full bg-white/50" />;
}

export function VodResultCard({ item, platform, onDownload }: VodResultCardProps) {
  const durationLabel = formatVodDuration(item.duration_seconds);
  const streamedDate = formatStreamedDate(item.upload_date);
  const streamedRelative = formatStreamedRelative(item.upload_date);
  const viewsLabel = formatViewCount(item.views);

  return (
    <Pressable
      onPress={onDownload}
      className="mb-4 overflow-hidden rounded-[10px] border border-border bg-surface"
    >
      <View className="aspect-video w-full">
        {item.thumbnail_url ? (
          <Image
            source={{ uri: item.thumbnail_url }}
            className="absolute inset-0 h-full w-full"
            resizeMode="cover"
          />
        ) : (
          <View className="absolute inset-0 items-center justify-center bg-surfaceMuted">
            <Ionicons name="videocam-outline" size={32} color="#71717a" />
          </View>
        )}

        {/* Vignette */}
        <View className="absolute inset-0 bg-black/25" pointerEvents="none" />

        {/* Top badges */}
        <View className="absolute left-3 top-3 z-10 flex-row flex-wrap gap-1.5">
          {platform ? <VodPlatformBadge platform={platform} /> : null}
          {durationLabel ? (
            <View className="flex-row items-center gap-1 rounded-[5px] bg-sky-500/30 px-2 py-1 shadow-md">
              <Ionicons name="time-outline" size={10} color="#7dd3fc" />
              <Text className="text-[10px] font-semibold uppercase tracking-wide text-sky-300">
                {durationLabel}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Download affordance (mobile: always visible) */}
        <View className="absolute right-3 top-3 z-10">
          <View className="rounded-full bg-white/90 p-2 shadow-lg">
            <Ionicons name="download-outline" size={18} color="#1f2937" />
          </View>
        </View>

        {/* Bottom gradient + title/meta — matches desktop vod-card overlay */}
        <View className="absolute bottom-0 left-0 right-0 z-10" pointerEvents="none">
          <View className="h-20 bg-black/40" />
          <View className="bg-black/85 px-4 pb-4 pt-2">
            <Text className="text-base font-bold text-white" numberOfLines={2}>
              {item.title ?? 'Untitled stream'}
            </Text>
            <View className="mt-1.5 flex-row flex-wrap items-center gap-2">
              {item.uploader ? (
                <>
                  <Text className="text-xs font-medium text-white/70">{item.uploader}</Text>
                  <MetaDot />
                </>
              ) : null}
              <Text className="text-xs font-medium text-white/70">{streamedDate}</Text>
              {item.upload_date ? (
                <>
                  <MetaDot />
                  <Text className="text-xs font-medium text-white/70">{streamedRelative}</Text>
                </>
              ) : null}
              {viewsLabel ? (
                <>
                  <MetaDot />
                  <Text className="text-xs font-medium text-white/70">{viewsLabel}</Text>
                </>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
