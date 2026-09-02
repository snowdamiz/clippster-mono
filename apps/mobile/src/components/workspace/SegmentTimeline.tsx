import type { ClipSegment } from '@clippster/shared-types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import { FilmstripFrames } from '@/components/timeline/FilmstripFrames';
import { PlayheadMarker } from '@/components/timeline/PlayheadMarker';
import { TrimHandle } from '@/components/timeline/TrimHandle';
import { formatPlaybackClock } from '@/lib/formatTime';
import {
  mergeAdjacentClipSegments,
  segmentsToClipRelative,
  splitClipSegment,
  syncClipBoundsFromSegments,
  updateClipSegment,
} from '@/services/database';
import { appAlert } from '@/lib/appAlert';

const MIN_SEGMENT_DURATION = 0.5;
const DEBOUNCE_MS = 300;
const MIN_PPS = 16;
const MAX_PPS = 80;
const DEFAULT_PPS = 40;
const TRACK_HEIGHT = 64;

interface SegmentTimelineProps {
  clipId: string;
  clipStart: number;
  videoPath: string;
  segments: ClipSegment[];
  currentTime: number;
  onSeek: (time: number) => void;
  onSegmentsChange: () => void;
}

export function SegmentTimeline({
  clipId,
  clipStart,
  videoPath,
  segments,
  currentTime,
  onSeek,
  onSegmentsChange,
}: SegmentTimelineProps) {
  const [localSegments, setLocalSegments] = useState<ClipSegment[]>(segments);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set([0]));
  const [pixelsPerSecond, setPixelsPerSecond] = useState(DEFAULT_PPS);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinchStart = useRef(0);
  const ppsStart = useRef(DEFAULT_PPS);
  const ppsRef = useRef(DEFAULT_PPS);
  ppsRef.current = pixelsPerSecond;

  const relativeSegments = useMemo(
    () => segmentsToClipRelative(localSegments, clipStart),
    [localSegments, clipStart],
  );

  const totalDuration = useMemo(() => {
    if (relativeSegments.length === 0) return 1;
    return Math.max(...relativeSegments.map((segment) => segment.end_time), 1);
  }, [relativeSegments]);

  const persistSegment = useCallback(
    (index: number, start: number, end: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void (async () => {
          await updateClipSegment(clipId, index, start + clipStart, end + clipStart);
          await syncClipBoundsFromSegments(clipId);
          onSegmentsChange();
        })();
      }, DEBOUNCE_MS);
    },
    [clipId, clipStart, onSegmentsChange],
  );

  const applySegment = useCallback(
    (index: number, start: number, end: number, previewEdge?: 'start' | 'end') => {
      setLocalSegments((previous) => {
        const updated = [...previous];
        updated[index] = {
          ...updated[index],
          start_time: start + clipStart,
          end_time: end + clipStart,
          duration: end - start,
        };
        return updated;
      });
      if (previewEdge === 'start') onSeek(start + clipStart);
      if (previewEdge === 'end') onSeek(end + clipStart);
    },
    [clipStart, onSeek],
  );

  const handleSplit = useCallback(async () => {
    const relTime = currentTime - clipStart;
    const segIndex = relativeSegments.findIndex(
      (segment) => relTime >= segment.start_time && relTime < segment.end_time,
    );
    if (segIndex === -1) {
      appAlert('Split', 'Move the playhead inside a clip to split.');
      return;
    }
    try {
      await splitClipSegment(clipId, segIndex, currentTime);
      await syncClipBoundsFromSegments(clipId);
      onSegmentsChange();
    } catch (error) {
      appAlert('Split failed', error instanceof Error ? error.message : String(error));
    }
  }, [clipId, clipStart, currentTime, onSegmentsChange, relativeSegments]);

  const handleMerge = useCallback(async () => {
    if (selectedIndices.size < 2) {
      appAlert('Merge', 'Select 2 or more adjacent clips to merge.');
      return;
    }
    appAlert('Merge clips', `Merge ${selectedIndices.size} clips?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Merge',
        onPress: () => {
          void (async () => {
            try {
              await mergeAdjacentClipSegments(clipId, [...selectedIndices]);
              await syncClipBoundsFromSegments(clipId);
              setSelectedIndices(new Set([0]));
              onSegmentsChange();
            } catch (error) {
              appAlert('Merge failed', error instanceof Error ? error.message : String(error));
            }
          })();
        },
      },
    ]);
  }, [clipId, onSegmentsChange, selectedIndices]);

  const pinch = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (event) => event.nativeEvent.touches.length >= 2,
        onPanResponderMove: (event) => {
          const touches = event.nativeEvent.touches;
          if (touches.length < 2) return;
          const distance = Math.hypot(
            touches[0].pageX - touches[1].pageX,
            touches[0].pageY - touches[1].pageY,
          );
          if (pinchStart.current <= 0) {
            pinchStart.current = distance;
            ppsStart.current = ppsRef.current;
            return;
          }
          setPixelsPerSecond(
            Math.max(MIN_PPS, Math.min(MAX_PPS, ppsStart.current * (distance / pinchStart.current))),
          );
        },
        onPanResponderRelease: () => {
          pinchStart.current = 0;
        },
      }),
    [],
  );

  useEffect(() => {
    setLocalSegments(segments);
    if (segments.length === 1) setSelectedIndices(new Set([0]));
  }, [segments]);

  const width = Math.max(totalDuration * pixelsPerSecond, 160);
  const playheadX = Math.max(0, (currentTime - clipStart) * pixelsPerSecond);
  const rangeStart = relativeSegments[0]?.start_time ?? 0;
  const rangeEnd =
    relativeSegments.length > 0 ? Math.max(...relativeSegments.map((segment) => segment.end_time)) : 0;

  const ticks: number[] = [];
  const tickStep = pixelsPerSecond >= 32 ? 1 : 5;
  for (let time = 0; time <= totalDuration; time += tickStep) ticks.push(time);

  return (
    <View className="border-t border-border bg-background">
      <View className="flex-row items-center justify-between px-4 py-2">
        <View>
          <Text className="text-xs font-semibold text-foreground">Timeline</Text>
          <Text className="text-[11px] tabular-nums text-muted">
            {formatPlaybackClock(clipStart + rangeStart)} – {formatPlaybackClock(clipStart + rangeEnd)}
          </Text>
        </View>
        <View className="flex-row gap-2">
          <Pressable onPress={() => void handleSplit()} className="rounded-md bg-surface px-3 py-1.5">
            <Text className="text-xs font-semibold text-foreground">Split</Text>
          </Pressable>
          <Pressable onPress={() => void handleMerge()} className="rounded-md bg-surface px-3 py-1.5">
            <Text className="text-xs font-semibold text-foreground">Merge</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}>
        <View {...pinch.panHandlers} style={{ width: width + 32, paddingHorizontal: 16, paddingBottom: 10 }}>
          <Pressable
            onPress={(event) => {
              onSeek(clipStart + event.nativeEvent.locationX / pixelsPerSecond);
            }}
            style={{ width }}
          >
            <View style={{ width, height: 16, marginBottom: 4 }}>
              {ticks.map((tick) => (
                <Text
                  key={tick}
                  className="absolute text-[10px] tabular-nums text-muted"
                  style={{ left: tick * pixelsPerSecond }}
                >
                  {formatPlaybackClock(tick).replace(/\.00$/, '')}
                </Text>
              ))}
            </View>

            <View
              style={{
                width,
                height: TRACK_HEIGHT,
                borderRadius: 10,
                backgroundColor: '#0c0c0e',
                overflow: 'hidden',
              }}
            >
              {relativeSegments.map((segment, index) => {
                const left = segment.start_time * pixelsPerSecond;
                const segmentWidth = Math.max(36, (segment.end_time - segment.start_time) * pixelsPerSecond);
                const selected = selectedIndices.has(index);
                return (
                  <View
                    key={segment.id ?? index}
                    style={{
                      position: 'absolute',
                      left,
                      width: segmentWidth,
                      height: TRACK_HEIGHT,
                    }}
                  >
                    <Pressable
                      onPress={() => {
                        setSelectedIndices((previous) => {
                          const next = new Set(previous);
                          if (next.has(index)) next.delete(index);
                          else next.add(index);
                          if (next.size === 0) next.add(index);
                          return next;
                        });
                      }}
                      style={{
                        width: segmentWidth,
                        height: TRACK_HEIGHT,
                        borderRadius: 10,
                        overflow: 'hidden',
                        borderWidth: selected ? 2 : 0,
                        borderColor: '#ffffff',
                      }}
                    >
                      <FilmstripFrames
                        path={videoPath}
                        start={segment.start_time + clipStart}
                        end={segment.end_time + clipStart}
                        width={segmentWidth}
                        height={TRACK_HEIGHT}
                      />
                    </Pressable>
                    {selected ? (
                      <>
                        <TrimHandle
                          edge="start"
                          onMove={(dx) => {
                            const prev = index > 0 ? relativeSegments[index - 1] : null;
                            const minStart = prev ? prev.end_time : 0;
                            const nextStart = Math.max(
                              minStart,
                              Math.min(segment.end_time - MIN_SEGMENT_DURATION, segment.start_time + dx / pixelsPerSecond),
                            );
                            applySegment(index, nextStart, segment.end_time, 'start');
                          }}
                          onEnd={() => persistSegment(index, segment.start_time, segment.end_time)}
                        />
                        <TrimHandle
                          edge="end"
                          onMove={(dx) => {
                            const next = index < relativeSegments.length - 1 ? relativeSegments[index + 1] : null;
                            const maxEnd = next ? next.start_time : Math.max(totalDuration, segment.end_time + 30);
                            const nextEnd = Math.min(
                              maxEnd,
                              Math.max(segment.start_time + MIN_SEGMENT_DURATION, segment.end_time + dx / pixelsPerSecond),
                            );
                            applySegment(index, segment.start_time, nextEnd, 'end');
                          }}
                          onEnd={() => persistSegment(index, segment.start_time, segment.end_time)}
                        />
                      </>
                    ) : null}
                  </View>
                );
              })}
            </View>

            <PlayheadMarker x={playheadX} height={TRACK_HEIGHT + 20} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
