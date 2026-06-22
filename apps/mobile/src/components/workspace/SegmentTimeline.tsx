import type { ClipSegment } from '@clippster/shared-types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, PanResponder, Pressable, Text, View } from 'react-native';

import {
  mergeAdjacentClipSegments,
  segmentsToClipRelative,
  splitClipSegment,
  syncClipBoundsFromSegments,
  updateClipSegment,
} from '@/services/database';

const MIN_SEGMENT_DURATION = 0.5;
const DEBOUNCE_MS = 300;

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
}

type DragMode = 'left' | 'right' | 'body' | null;

interface SegmentTimelineProps {
  clipId: string;
  clipStart: number;
  segments: ClipSegment[];
  currentTime: number;
  onSeek: (time: number) => void;
  onSegmentsChange: () => void;
}

export function SegmentTimeline({
  clipId,
  clipStart,
  segments,
  currentTime,
  onSeek,
  onSegmentsChange,
}: SegmentTimelineProps) {
  const [localSegments, setLocalSegments] = useState<ClipSegment[]>(segments);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{
    mode: DragMode;
    index: number;
    startX: number;
    origStart: number;
    origEnd: number;
    width: number;
  } | null>(null);

  const relativeSegments = useMemo(
    () => segmentsToClipRelative(localSegments, clipStart),
    [localSegments, clipStart],
  );

  const totalDuration = useMemo(() => {
    if (relativeSegments.length === 0) return 1;
    return Math.max(...relativeSegments.map((s) => s.end_time));
  }, [relativeSegments]);

  const persistSegment = useCallback(
    (index: number, start: number, end: number) => {
      const absStart = start + clipStart;
      const absEnd = end + clipStart;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void (async () => {
          await updateClipSegment(clipId, index, absStart, absEnd);
          await syncClipBoundsFromSegments(clipId);
          onSegmentsChange();
        })();
      }, DEBOUNCE_MS);
    },
    [clipId, clipStart, onSegmentsChange],
  );

  const handleSplit = useCallback(async () => {
    const relTime = currentTime - clipStart;
    const segIndex = relativeSegments.findIndex(
      (s) => relTime >= s.start_time && relTime < s.end_time,
    );
    if (segIndex === -1) {
      Alert.alert('Split', 'Move playhead inside a segment to split.');
      return;
    }
    const absCut = currentTime;
    try {
      await splitClipSegment(clipId, segIndex, absCut);
      await syncClipBoundsFromSegments(clipId);
      onSegmentsChange();
    } catch (error) {
      Alert.alert('Split failed', error instanceof Error ? error.message : String(error));
    }
  }, [clipId, clipStart, currentTime, onSegmentsChange, relativeSegments]);

  const handleMerge = useCallback(async () => {
    if (selectedIndices.size < 2) {
      Alert.alert('Merge', 'Select 2 or more adjacent segments to merge.');
      return;
    }
    Alert.alert('Merge segments', `Merge ${selectedIndices.size} segments?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Merge',
        onPress: () => {
          void (async () => {
            try {
              await mergeAdjacentClipSegments(clipId, [...selectedIndices]);
              await syncClipBoundsFromSegments(clipId);
              setSelectedIndices(new Set());
              onSegmentsChange();
            } catch (error) {
              Alert.alert('Merge failed', error instanceof Error ? error.message : String(error));
            }
          })();
        },
      },
    ]);
  }, [clipId, onSegmentsChange, selectedIndices]);

  const createPanResponder = (index: number, width: number) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, _gs) => {
        const x = evt.nativeEvent.locationX;
        const seg = relativeSegments[index];
        let mode: DragMode = 'body';
        if (x < 16) mode = 'left';
        else if (x > width - 16) mode = 'right';
        dragRef.current = {
          mode,
          index,
          startX: evt.nativeEvent.pageX,
          origStart: seg.start_time,
          origEnd: seg.end_time,
          width,
        };
      },
      onPanResponderMove: (evt) => {
        const drag = dragRef.current;
        if (!drag || drag.index !== index) return;
        const dx = evt.nativeEvent.pageX - drag.startX;
        const dt = (dx / drag.width) * totalDuration;
        const prev = index > 0 ? relativeSegments[index - 1] : null;
        const next = index < relativeSegments.length - 1 ? relativeSegments[index + 1] : null;

        let newStart = drag.origStart;
        let newEnd = drag.origEnd;

        if (drag.mode === 'left') {
          newStart = Math.max(0, Math.min(drag.origEnd - MIN_SEGMENT_DURATION, drag.origStart + dt));
          if (prev) newStart = Math.max(newStart, prev.end_time);
        } else if (drag.mode === 'right') {
          newEnd = Math.max(
            drag.origStart + MIN_SEGMENT_DURATION,
            Math.min(totalDuration, drag.origEnd + dt),
          );
          if (next) newEnd = Math.min(newEnd, next.start_time);
        } else {
          const dur = drag.origEnd - drag.origStart;
          newStart = Math.max(0, drag.origStart + dt);
          newEnd = newStart + dur;
          if (next && newEnd > next.start_time) {
            newEnd = next.start_time;
            newStart = newEnd - dur;
          }
          if (prev && newStart < prev.end_time) {
            newStart = prev.end_time;
            newEnd = newStart + dur;
          }
        }

        setLocalSegments((prevSegs) => {
          const updated = [...prevSegs];
          const absStart = newStart + clipStart;
          const absEnd = newEnd + clipStart;
          updated[index] = {
            ...updated[index],
            start_time: absStart,
            end_time: absEnd,
            duration: absEnd - absStart,
          };
          return updated;
        });
      },
      onPanResponderRelease: () => {
        const drag = dragRef.current;
        if (!drag) return;
        const seg = relativeSegments[drag.index];
        if (seg) {
          persistSegment(drag.index, seg.start_time, seg.end_time);
        }
        dragRef.current = null;
      },
    });

  useEffect(() => {
    setLocalSegments(segments);
  }, [segments]);

  const playheadPct = ((currentTime - clipStart) / totalDuration) * 100;

  return (
    <View className="px-4 py-2">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-xs font-semibold text-foreground">Timeline</Text>
        <View className="flex-row gap-2">
          <Pressable onPress={() => void handleSplit()} className="rounded bg-surface px-2 py-1">
            <Text className="text-xs text-primary">Split</Text>
          </Pressable>
          <Pressable onPress={() => void handleMerge()} className="rounded bg-surface px-2 py-1">
            <Text className="text-xs text-primary">Merge</Text>
          </Pressable>
        </View>
      </View>

      <View className="relative h-14 rounded-lg bg-surface">
        {relativeSegments.map((seg, index) => {
          const leftPct = (seg.start_time / totalDuration) * 100;
          const widthPct = ((seg.end_time - seg.start_time) / totalDuration) * 100;
          const selected = selectedIndices.has(index);
          const pan = createPanResponder(index, 300);

          return (
            <View
              key={seg.id ?? index}
              {...pan.panHandlers}
              style={{
                position: 'absolute',
                left: `${leftPct}%`,
                width: `${widthPct}%`,
                top: 8,
                bottom: 8,
              }}
            >
              <Pressable
                onPress={() => {
                  setSelectedIndices((prev) => {
                    const next = new Set(prev);
                    if (next.has(index)) next.delete(index);
                    else next.add(index);
                    return next;
                  });
                }}
                onLongPress={() => onSeek(seg.start_time + clipStart)}
                className={`h-full rounded border-2 ${
                  selected ? 'border-yellow-400 bg-primary/30' : 'border-primary bg-primary/20'
                }`}
              >
                <View className="absolute left-0 top-0 h-full w-4 items-center justify-center">
                  <View className="h-6 w-1 rounded bg-primary" />
                </View>
                <View className="absolute right-0 top-0 h-full w-4 items-center justify-center">
                  <View className="h-6 w-1 rounded bg-primary" />
                </View>
                <Text className="mt-1 text-center text-[10px] text-foreground">
                  {formatTime(seg.start_time)}
                </Text>
              </Pressable>
            </View>
          );
        })}

        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: `${Math.min(100, Math.max(0, playheadPct))}%`,
            top: 0,
            bottom: 0,
            width: 2,
            backgroundColor: '#ef4444',
          }}
        />
      </View>

      <Text className="mt-1 text-[10px] text-muted">
        Drag handles to trim · drag body to move · tap to select · long-press to seek
      </Text>
    </View>
  );
}
