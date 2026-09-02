import { Ionicons } from '@expo/vector-icons';
import type { MediaPlatform, VodListItem } from '@clippster/shared-types';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { Button } from '@/components/ui/button';
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
  }, [visible, item?.id, totalDuration]);

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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/70 px-4" onPress={onClose}>
        <Pressable
          className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-surface"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="h-[3px] bg-accent" />

          <View className="items-center px-6 pb-2 pt-6">
            <Pressable
              onPress={onClose}
              disabled={starting}
              className="absolute right-4 top-4 rounded-md p-1"
            >
              <Ionicons name="close" size={22} color={tokens.colors.muted} />
            </Pressable>
            <View className="mb-3 h-12 w-12 items-center justify-center rounded-full bg-accent/15">
              <Ionicons name="download-outline" size={24} color={tokens.colors.accent} />
            </View>
            <Text className="text-lg font-bold text-foreground">Download options</Text>
            <Text className="mt-1 text-sm text-muted">Configure your download settings</Text>
          </View>

          <ScrollView className="max-h-[60vh] px-5" keyboardShouldPersistTaps="handled">
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

            <View className="mt-4 gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-foreground">Select range</Text>
                <View
                  className={`rounded-full px-2 py-0.5 ${
                    fullStream ? 'bg-accent/15' : 'bg-white/10'
                  }`}
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
              <View className="mt-4 gap-3 rounded-lg border border-border bg-background p-3">
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
          </ScrollView>

          <View className="flex-row gap-3 border-t border-border p-4">
            <Button
              title="Cancel"
              variant="outline"
              onPress={onClose}
              disabled={starting}
              className="flex-1"
            />
            <Button
              title={starting ? 'Starting…' : 'Start download'}
              onPress={handleConfirm}
              disabled={!canConfirm}
              className="flex-1"
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
