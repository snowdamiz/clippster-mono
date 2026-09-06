import { Ionicons } from '@expo/vector-icons';
import type { MediaPlatform, VodListItem } from '@clippster/shared-types';
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  Switch,
  Text,
  View,
} from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { VodTimeRangePicker, type TimeRangeValue } from '@/components/download/VodTimeRangePicker';
import { PLATFORM_LABELS } from '@/lib/platformDetection';
import {
  buildSegmentJobs,
  formatClockTime,
  isFullStreamRange,
  rangeDuration,
  type TimeRange,
} from '@/lib/timeRange';
import {
  formatStreamedDate,
  formatStreamedRelative,
  formatVodDuration,
} from '@/lib/vodDisplay';
import { tokens } from '@/theme/tokens';

const AUTO_SEGMENT_MINUTES = [15, 30, 45, 60] as const;

export interface DownloadPlan {
  segmentRange?: TimeRange;
  autoSegment: boolean;
  autoSegmentDurationMinutes: number;
}

interface DownloadOptionsSheetProps {
  visible: boolean;
  item: VodListItem | null;
  platform: MediaPlatform | null;
  starting: boolean;
  onClose: () => void;
  onConfirm: (plan: DownloadPlan) => void;
}

function initialRange(duration: number): TimeRangeValue {
  const total = Math.max(0, Math.floor(duration));
  return { startTime: 0, endTime: total };
}

export function DownloadOptionsSheet({
  visible,
  item,
  platform,
  starting,
  onClose,
  onConfirm,
}: DownloadOptionsSheetProps) {
  const totalDuration = Math.max(0, Math.floor(item?.duration_seconds ?? 0));
  const [timeRange, setTimeRange] = useState<TimeRangeValue>(() => initialRange(totalDuration));
  const [autoSegment, setAutoSegment] = useState(false);
  const [autoSegmentDuration, setAutoSegmentDuration] = useState(30);

  useEffect(() => {
    if (!visible || !item) return;
    setTimeRange(initialRange(totalDuration));
    setAutoSegment(false);
    setAutoSegmentDuration(30);
  }, [visible, item, totalDuration]);

  const selectedDuration = rangeDuration(timeRange);
  const fullStream = isFullStreamRange(timeRange, totalDuration);
  const showAutoSegment = selectedDuration > 900;
  const estimatedParts = useMemo(() => {
    if (!autoSegment || !showAutoSegment) return 1;
    return buildSegmentJobs(timeRange, autoSegmentDuration * 60).length;
  }, [autoSegment, showAutoSegment, timeRange, autoSegmentDuration]);

  const canConfirm =
    timeRange.endTime > timeRange.startTime && selectedDuration >= 10 && !starting;

  function resetToFullStream() {
    setTimeRange(initialRange(totalDuration));
  }

  function handleConfirm() {
    const segmentRange = fullStream ? undefined : { ...timeRange };
    onConfirm({
      segmentRange,
      autoSegment: autoSegment && showAutoSegment,
      autoSegmentDurationMinutes: autoSegmentDuration,
    });
  }

  if (!item) {
    return null;
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      variant="dialog"
      title="Download options"
      subtitle="Configure your download settings"
      headerIcon="download-outline"
      dismissOnBackdrop={!starting}
      maxHeightClassName="max-h-[85%]"
      primaryAction={{
        title: starting ? 'Starting…' : 'Start download',
        onPress: handleConfirm,
        disabled: !canConfirm,
        variant: 'accent',
      }}
      secondaryAction={{
        title: 'Cancel',
        onPress: onClose,
        disabled: starting,
      }}
    >
      <View className="flex-row gap-3 rounded-lg border border-border bg-background p-3">
        {item.thumbnail_url ? (
          <Image
            source={{ uri: item.thumbnail_url }}
            className="h-16 w-24 rounded-md bg-surfaceMuted"
            resizeMode="cover"
          />
        ) : (
          <View className="h-16 w-24 items-center justify-center rounded-md bg-surfaceMuted">
            <Ionicons name="videocam-outline" size={28} color={tokens.colors.muted} />
          </View>
        )}
        <View className="flex-1 gap-1">
          <Text className="font-semibold text-foreground" numberOfLines={2}>
            {item.title ?? 'Untitled VOD'}
          </Text>
          <View className="flex-row flex-wrap items-center gap-1">
            {platform ? (
              <Text className="text-xs text-accent">{PLATFORM_LABELS[platform]}</Text>
            ) : null}
            {totalDuration > 0 ? (
              <Text className="text-xs text-muted">{formatVodDuration(totalDuration)}</Text>
            ) : null}
          </View>
          {item.upload_date ? (
            <Text className="text-xs text-muted">
              {formatStreamedDate(item.upload_date)} · {formatStreamedRelative(item.upload_date)}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-foreground">Select range</Text>
          <View
            className={`rounded-full px-2 py-0.5 ${fullStream ? 'bg-accent/15' : 'bg-white/10'}`}
          >
            <Text className="text-xs font-medium text-foreground">
              {fullStream ? 'Full stream' : formatClockTime(selectedDuration)}
            </Text>
          </View>
        </View>
        <View className="rounded-lg border border-border bg-background p-3">
          <VodTimeRangePicker
            totalDuration={totalDuration}
            value={timeRange}
            onChange={setTimeRange}
          />
        </View>
        {!fullStream ? (
          <Pressable
            onPress={resetToFullStream}
            className="flex-row items-center gap-1 self-start"
          >
            <Ionicons name="refresh" size={14} color={tokens.colors.accent} />
            <Text className="text-xs font-medium text-accent">Reset to full stream</Text>
          </Pressable>
        ) : null}
      </View>

      {showAutoSegment ? (
        <View className="gap-3 rounded-lg border border-border bg-background p-3">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1 flex-row items-center justify-between">
              <Text className="text-sm font-medium text-foreground">Auto-segment into parts</Text>
              <Switch value={autoSegment} onValueChange={setAutoSegment} />
            </View>
            {autoSegment ? (
              <View className="rounded-full bg-white/10 px-2 py-0.5">
                <Text className="text-xs font-medium text-foreground">~{estimatedParts} parts</Text>
              </View>
            ) : null}
          </View>
          {autoSegment ? (
            <View className="gap-2">
              <Text className="text-xs text-muted">Part duration</Text>
              <View className="flex-row gap-2">
                {AUTO_SEGMENT_MINUTES.map((mins) => (
                  <Pressable
                    key={mins}
                    onPress={() => setAutoSegmentDuration(mins)}
                    className={`flex-1 rounded-lg border py-2 ${
                      autoSegmentDuration === mins
                        ? 'border-accent bg-accent/15'
                        : 'border-border bg-background'
                    }`}
                  >
                    <Text
                      className={`text-center text-xs font-semibold ${
                        autoSegmentDuration === mins ? 'text-accent' : 'text-muted'
                      }`}
                    >
                      {mins}m
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </BottomSheet>
  );
}
