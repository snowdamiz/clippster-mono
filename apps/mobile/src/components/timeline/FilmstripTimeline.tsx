import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef } from 'react';
import { PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import {
  clipTimelineRanges,
  timelineDuration,
  type EditDocument,
  type TransitionKind,
} from '@/lib/timeline/editDocument';
import { tokens } from '@/theme/tokens';

const CLIP_COLORS = ['#334155', '#3f3f46', '#1e3a5f', '#3f2d4d', '#3f3a1d'];
const MIN_PPS = 4;
const MAX_PPS = 28;

interface FilmstripTimelineProps {
  doc: EditDocument;
  playhead: number;
  pixelsPerSecond: number;
  selectedId: string | null;
  onSelect: (id: string | null, kind: 'video' | 'image' | 'audio' | 'cut') => void;
  onSeek: (timelineTime: number) => void;
  onTrimVideo: (clipId: string, edge: 'start' | 'end', sourceTime: number) => void;
  onTrimEnd?: () => void;
  onPixelsPerSecondChange: (value: number) => void;
}

function formatTick(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function transitionIcon(kind: TransitionKind): keyof typeof Ionicons.glyphMap {
  switch (kind) {
    case 'fade':
      return 'contrast-outline';
    case 'dissolve':
      return 'sparkles-outline';
    case 'wipe':
      return 'swap-horizontal-outline';
    default:
      return 'square-outline';
  }
}

export function FilmstripTimeline({
  doc,
  playhead,
  pixelsPerSecond,
  selectedId,
  onSelect,
  onSeek,
  onTrimVideo,
  onTrimEnd,
  onPixelsPerSecondChange,
}: FilmstripTimelineProps) {
  const ranges = clipTimelineRanges(doc);
  const total = Math.max(timelineDuration(doc), 1);
  const width = Math.max(total * pixelsPerSecond, 120);
  const pinchStart = useRef(0);
  const ppsStart = useRef(pixelsPerSecond);
  const ppsRef = useRef(pixelsPerSecond);
  ppsRef.current = pixelsPerSecond;

  const pinch = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (event) => event.nativeEvent.touches.length >= 2,
        onPanResponderMove: (event) => {
          const touches = event.nativeEvent.touches;
          if (touches.length < 2) return;
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const distance = Math.hypot(dx, dy);
          if (pinchStart.current <= 0) {
            pinchStart.current = distance;
            ppsStart.current = ppsRef.current;
            return;
          }
          onPixelsPerSecondChange(
            Math.max(MIN_PPS, Math.min(MAX_PPS, ppsStart.current * (distance / pinchStart.current))),
          );
        },
        onPanResponderRelease: () => {
          pinchStart.current = 0;
        },
      }),
    [onPixelsPerSecondChange],
  );

  const ticks = [];
  for (let t = 0; t <= total; t += 5) ticks.push(t);

  return (
    <View className="border-t border-border bg-surfaceMuted">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}>
        <View {...pinch.panHandlers} style={{ width: width + 32, paddingHorizontal: 16, paddingVertical: 8 }}>
          <Pressable
            onPress={(event) => {
              onSeek(Math.max(0, Math.min(total, event.nativeEvent.locationX / pixelsPerSecond)));
            }}
            style={{ width }}
          >
            <View style={{ width, height: 14, marginBottom: 4 }}>
              {ticks.map((tick) => (
                <Text
                  key={tick}
                  className="absolute text-[10px] text-muted"
                  style={{ left: tick * pixelsPerSecond }}
                >
                  {formatTick(tick)}
                </Text>
              ))}
            </View>

            <TrackLabel label="Video" />
            <View style={{ width, height: 56, marginBottom: 6 }}>
              {ranges.map((range, index) => {
                const clipWidth = Math.max(24, (range.end - range.start) * pixelsPerSecond);
                const selected = range.clip.id === selectedId;
                return (
                  <View
                    key={range.clip.id}
                    style={{
                      position: 'absolute',
                      left: range.start * pixelsPerSecond,
                      width: clipWidth,
                      height: 56,
                      zIndex: index,
                    }}
                  >
                    {index > 0 ? (
                      <Pressable
                        onPress={() => onSelect(range.clip.id, 'cut')}
                        className="absolute -left-3 top-4 z-10 h-6 w-6 items-center justify-center rounded-md bg-background"
                      >
                        <Ionicons
                          name={transitionIcon(range.clip.transitionIn)}
                          size={12}
                          color={range.clip.transitionIn === 'none' ? tokens.colors.muted : tokens.colors.accent}
                        />
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => onSelect(range.clip.id, 'video')}
                      style={{
                        width: clipWidth,
                        height: 56,
                        borderRadius: 8,
                        overflow: 'hidden',
                        borderWidth: selected ? 2 : 1,
                        borderColor: selected ? tokens.colors.accent : tokens.colors.border,
                        backgroundColor: CLIP_COLORS[index % CLIP_COLORS.length],
                      }}
                    >
                      <View className="absolute bottom-1 left-2 right-2">
                        <Text className="text-[10px] font-semibold text-white" numberOfLines={1}>
                          {range.clip.muted ? 'Muted · ' : ''}
                          {range.clip.effect ? 'FX · ' : ''}
                          {range.clip.label} · {formatTick(range.end - range.start)}
                        </Text>
                      </View>
                      {selected ? (
                        <>
                          <TrimHandle
                            edge="start"
                            onMove={(dx) =>
                              onTrimVideo(
                                range.clip.id,
                                'start',
                                range.clip.sourceStart + (dx / pixelsPerSecond) * range.clip.speed,
                              )
                            }
                            onEnd={onTrimEnd}
                          />
                          <TrimHandle
                            edge="end"
                            onMove={(dx) =>
                              onTrimVideo(
                                range.clip.id,
                                'end',
                                range.clip.sourceEnd + (dx / pixelsPerSecond) * range.clip.speed,
                              )
                            }
                            onEnd={onTrimEnd}
                          />
                        </>
                      ) : null}
                    </Pressable>
                  </View>
                );
              })}
            </View>

            <TrackLabel label="Images" />
            <OverlayTrack
              width={width}
              pixelsPerSecond={pixelsPerSecond}
              items={doc.images.map((item) => ({
                id: item.id,
                start: item.timelineStart,
                duration: item.duration,
                label: item.label,
                color: '#6d28d9',
              }))}
              selectedId={selectedId}
              onSelect={(id) => onSelect(id, 'image')}
            />

            <TrackLabel label="Music" />
            <OverlayTrack
              width={width}
              pixelsPerSecond={pixelsPerSecond}
              items={doc.audio.map((item) => ({
                id: item.id,
                start: item.timelineStart,
                duration: item.sourceEnd - item.sourceStart,
                label: item.label,
                color: '#166534',
              }))}
              selectedId={selectedId}
              onSelect={(id) => onSelect(id, 'audio')}
            />

            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 8,
                bottom: 8,
                left: playhead * pixelsPerSecond,
                width: 2,
                backgroundColor: tokens.colors.accent,
              }}
            />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function TrackLabel({ label }: { label: string }) {
  return <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</Text>;
}

function OverlayTrack({
  width,
  pixelsPerSecond,
  items,
  selectedId,
  onSelect,
}: {
  width: number;
  pixelsPerSecond: number;
  items: Array<{ id: string; start: number; duration: number; label: string; color: string }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={{ width, height: 28, marginBottom: 6, borderRadius: 6, backgroundColor: '#0f0f12' }}>
      {items.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => onSelect(item.id)}
          style={{
            position: 'absolute',
            left: item.start * pixelsPerSecond,
            width: Math.max(16, item.duration * pixelsPerSecond),
            top: 3,
            bottom: 3,
            borderRadius: 4,
            backgroundColor: item.color,
            borderWidth: selectedId === item.id ? 2 : 0,
            borderColor: '#ffffff',
            justifyContent: 'center',
            paddingHorizontal: 6,
          }}
        >
          <Text className="text-[10px] text-white" numberOfLines={1}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function TrimHandle({
  edge,
  onMove,
  onEnd,
}: {
  edge: 'start' | 'end';
  onMove: (dx: number) => void;
  onEnd?: () => void;
}) {
  const lastX = useRef(0);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          lastX.current = event.nativeEvent.pageX;
        },
        onPanResponderMove: (event) => {
          const x = event.nativeEvent.pageX;
          onMove(x - lastX.current);
          lastX.current = x;
        },
        onPanResponderRelease: () => onEnd?.(),
        onPanResponderTerminate: () => onEnd?.(),
      }),
    [onMove, onEnd],
  );

  return (
    <View
      {...pan.panHandlers}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        [edge === 'start' ? 'left' : 'right']: 0,
        width: 14,
        backgroundColor: tokens.colors.accent,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <View className="h-6 w-0.5 rounded-full bg-white" />
    </View>
  );
}
