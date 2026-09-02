import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, Text, View } from 'react-native';
import type { ProjectClipRow } from '@/services/database';
import { formatClock, formatDurationLabel, toLocalImageUri } from '@/lib/formatTime';
import { tokens } from '@/theme/tokens';

interface ClipListCardProps {
  clip: ProjectClipRow;
  index: number;
  fallbackThumbnail?: string | null;
  onPress: () => void;
  onMore: () => void;
}

function viralityBadge(score: number | null): { bg: string; text: string } | null {
  if (score == null) return null;
  if (score >= 90) return { bg: 'bg-rose-500/15', text: 'text-rose-400' };
  if (score >= 80) return { bg: 'bg-orange-500/15', text: 'text-orange-400' };
  if (score >= 60) return { bg: 'bg-yellow-500/15', text: 'text-yellow-400' };
  return { bg: 'bg-white/5', text: 'text-muted' };
}

export function ClipListCard({
  clip,
  index,
  fallbackThumbnail,
  onPress,
  onMore,
}: ClipListCardProps) {
  const start = clip.start_time ?? 0;
  const end = clip.end_time ?? start;
  const duration = clip.duration ?? Math.max(0, end - start);
  const thumbUri =
    toLocalImageUri(clip.thumbnail_path) ??
    toLocalImageUri(clip.built_thumbnail_path) ??
    toLocalImageUri(fallbackThumbnail);
  const virality = viralityBadge(clip.virality_score);
  const confidence =
    clip.confidence_score != null ? Math.round(clip.confidence_score * 100) : null;

  return (
    <Pressable
      onPress={onPress}
      className="overflow-hidden rounded-lg border border-border bg-surface active:bg-white/5"
    >
      <View className="flex-row gap-3 p-3">
        <View className="h-16 w-24 overflow-hidden rounded-md border border-border bg-black/40">
          {thumbUri ? (
            <Image source={{ uri: thumbUri }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Ionicons name="videocam-outline" size={22} color={tokens.colors.muted} />
            </View>
          )}
        </View>

        <View className="min-w-0 flex-1">
          <View className="mb-1.5 flex-row items-start justify-between gap-2">
            <View className="min-w-0 flex-1 flex-row items-start gap-2">
              <Text className="mt-0.5 text-xs font-bold tabular-nums text-muted/50">#{index}</Text>
              <Text className="flex-1 text-sm font-semibold leading-snug text-foreground" numberOfLines={2}>
                {clip.name || 'Untitled Clip'}
              </Text>
            </View>
            <Pressable onPress={onMore} hitSlop={8} className="rounded-md p-1.5 active:bg-white/10">
              <Ionicons name="ellipsis-vertical" size={16} color={tokens.colors.muted} />
            </Pressable>
          </View>

          <View className="mb-1.5 flex-row flex-wrap items-center gap-1.5">
            {virality && clip.virality_score != null ? (
              <View className={`flex-row items-center gap-1 rounded px-1.5 py-0.5 ${virality.bg}`}>
                <Ionicons name="flame" size={10} color={tokens.colors.warning} />
                <Text className={`text-[11px] font-medium ${virality.text}`}>
                  {Math.round(clip.virality_score)}%
                </Text>
              </View>
            ) : null}
            <View className="flex-row items-center gap-1 rounded bg-white/5 px-1.5 py-0.5">
              <Ionicons name="time-outline" size={10} color={tokens.colors.muted} />
              <Text className="text-[11px] font-medium text-muted">{formatDurationLabel(duration)}</Text>
            </View>
            {confidence != null ? (
              <Text className="text-[10px] font-medium text-muted">{confidence}%</Text>
            ) : null}
          </View>

          {clip.detection_reason ? (
            <Text className="mb-1.5 text-[11px] italic leading-relaxed text-muted" numberOfLines={1}>
              “{clip.detection_reason}”
            </Text>
          ) : null}

          <Text className="font-mono text-[10px] text-muted">
            {formatClock(start)} – {formatClock(end)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
