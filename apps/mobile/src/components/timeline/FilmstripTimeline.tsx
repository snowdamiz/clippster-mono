import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef } from 'react';
import { PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import { FilmstripFrames } from '@/components/timeline/FilmstripFrames';
import { PlayheadMarker } from '@/components/timeline/PlayheadMarker';
import { TrimHandle } from '@/components/timeline/TrimHandle';
import {
  clipTimelineRanges,
  timelineDuration,
  type EditDocument,
  type TransitionKind,
} from '@/lib/timeline/editDocument';
import { tokens } from '@/theme/tokens';

const MIN_PPS = 8;
const MAX_PPS = 48;
const VIDEO_HEIGHT = 64;
const OVERLAY_HEIGHT = 28;

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
  const width = Math.max(total * pixelsPerSecond, 160);
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
          const distance = Math.hypot(
            touches[0].pageX - touches[1].pageX,
            touches[0].pageY - touches[1].pageY,
          );
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

  const ticks: number[] = [];
  const tickStep = pixelsPerSecond >= 20 ? 1 : 5;
  for (let time = 0; time <= total; time += tickStep) ticks.push(time);
  const hasImages = doc.images.length > 0;
  const hasAudio = doc.audio.length > 0;
  const trackStackHeight =
    20 + VIDEO_HEIGHT + (hasImages ? OVERLAY_HEIGHT + 18 : 0) + (hasAudio ? OVERLAY_HEIGHT + 18 : 0);

  return (
    <View className="border-t border-border bg-background">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}>
        <View {...pinch.panHandlers} style={{ width: width + 32, paddingHorizontal: 16, paddingVertical: 8 }}>
          <Pressable
            onPress={(event) => {
              onSeek(Math.max(0, Math.min(total, event.nativeEvent.locationX / pixelsPerSecond)));
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
                  {formatTick(tick)}
                </Text>
              ))}
            </View>

            <View
              style={{
                width,
                height: VIDEO_HEIGHT,
                marginBottom: hasImages || hasAudio ? 8 : 0,
                borderRadius: 10,
                backgroundColor: '#0c0c0e',
              }}
            >
              {ranges.map((range, index) => {
                const clipWidth = Math.max(36, (range.end - range.start) * pixelsPerSecond);
                const selected = range.clip.id === selectedId;
                return (
                  <View
                    key={range.clip.id}
                    style={{
                      position: 'absolute',
                      left: range.start * pixelsPerSecond,
                      width: clipWidth,
                      height: VIDEO_HEIGHT,
                      zIndex: index,
                    }}
                  >
                    {index > 0 ? (
                      <Pressable
                        onPress={() => onSelect(range.clip.id, 'cut')}
                        className="absolute -left-3 top-5 z-10 h-6 w-6 items-center justify-center rounded-md bg-background"
                      >
                        <Ionicons
                          name={transitionIcon(range.clip.transitionIn)}
                          size={12}
                          color={
                            range.clip.transitionIn === 'none' ? tokens.colors.muted : tokens.colors.accent
                          }
                        />
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => onSelect(range.clip.id, 'video')}
                      style={{
                        width: clipWidth,
                        height: VIDEO_HEIGHT,
                        borderRadius: 10,
                        overflow: 'hidden',
                        borderWidth: selected ? 2 : 0,
                        borderColor: '#ffffff',
                      }}
                    >
                      <FilmstripFrames
                        path={range.clip.sourcePath}
                        start={range.clip.sourceStart}
                        end={range.clip.sourceEnd}
                        width={clipWidth}
                        height={VIDEO_HEIGHT}
                      />
                      <View className="absolute bottom-0 left-0 right-0 bg-black/55 px-2 py-1">
                        <Text className="text-[10px] font-semibold text-white" numberOfLines={1}>
                          {range.clip.muted ? 'Muted · ' : ''}
                          {range.clip.effect ? 'FX · ' : ''}
                          {range.clip.label}
                        </Text>
                      </View>
                    </Pressable>
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
                  </View>
                );
              })}
            </View>

            {hasImages ? (
              <>
                <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Images
                </Text>
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
              </>
            ) : null}

            {hasAudio ? (
              <>
                <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Music
                </Text>
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
              </>
            ) : null}

            <PlayheadMarker x={playhead * pixelsPerSecond} height={trackStackHeight} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
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
    <View style={{ width, height: OVERLAY_HEIGHT, marginBottom: 6, borderRadius: 8, backgroundColor: '#0c0c0e' }}>
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
            borderRadius: 6,
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
