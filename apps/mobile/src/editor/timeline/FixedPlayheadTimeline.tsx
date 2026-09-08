import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';

import { FilmstripFrames } from '@/components/timeline/FilmstripFrames';
import type {
  EditorSelection,
  MobileEditProjectV3,
  SelectionKind,
} from '../model/schema';
import { getVideoTrack } from '../model/timeline';
import {
  clampZoom,
  focalTimeForPinch,
  offsetPreservingFocalTime,
  pixelsForTicks,
  snapTimelineTick,
  tickForScrollOffset,
  ticksForPixels,
  timelineViewportHeight,
  TIMELINE_SECONDARY_TRACK_STRIDE,
  TIMELINE_SECONDARY_TRACK_TOP,
  TIMELINE_VIDEO_TRACK_HEIGHT,
  TIMELINE_VIDEO_TRACK_TOP,
} from './timelineGeometry';

export function FixedPlayheadTimeline({
  document,
  playheadTick,
  selection,
  onSeek,
  onSelectionChange,
  onTrimVideo,
  onMoveVideo,
  onAddMedia,
  onAddAudio,
  onScrubStart,
  onScrubEnd,
  playing,
}: {
  document: MobileEditProjectV3;
  playheadTick: number;
  selection: EditorSelection | null;
  onSeek: (tick: number) => void;
  onSelectionChange: (selection: EditorSelection | null) => void;
  onTrimVideo: (itemId: string, edge: 'start' | 'end', sourceTick: number) => void;
  onMoveVideo: (itemId: string, toIndex: number) => void;
  onAddMedia: () => void;
  onAddAudio: () => void;
  onScrubStart: () => void;
  onScrubEnd: (tick: number) => void;
  playing: boolean;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const offsetRef = useRef(0);
  const zoomStartRef = useRef(48);
  const focalTickRef = useRef(0);
  const scrubbingRef = useRef(false);
  const initializedRef = useRef(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPreviewSeekAt = useSharedValue(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(48);
  const videoTrack = getVideoTrack(document);
  const duration = Math.max(
    ...document.tracks.flatMap((track) => track.items.map((item) => item.timelineEnd)),
    0,
  );
  const contentWidth = pixelsForTicks(duration, pixelsPerSecond);
  const visibleSecondaryTracks = document.tracks
    .filter((track) => track.kind !== 'video' && track.items.length > 0)
    .sort((left, right) => {
      const rank = { audio: 0, text: 1, overlay: 2, video: 3 };
      return rank[left.kind] - rank[right.kind];
    });
  const hasAudio = visibleSecondaryTracks.some((track) => track.kind === 'audio');
  const secondaryTrackCount =
    visibleSecondaryTracks.length + (document.captionDocument?.enabled ? 1 : 0);
  const timelineHeight = timelineViewportHeight(secondaryTrackCount);
  const boundaries = useMemo(
    () => [
      0,
      duration,
      ...videoTrack.items.flatMap((item) => [item.timelineStart, item.timelineEnd]),
    ],
    [duration, videoTrack.items],
  );

  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onBegin((event) => {
      zoomStartRef.current = pixelsPerSecond;
      focalTickRef.current = focalTimeForPinch(
        offsetRef.current,
        event.focalX,
        viewportWidth,
        pixelsPerSecond,
      );
    })
    .onUpdate((event) => {
      const zoom = clampZoom(zoomStartRef.current * event.scale);
      const offset = offsetPreservingFocalTime(
        focalTickRef.current,
        event.focalX,
        viewportWidth,
        zoom,
      );
      setPixelsPerSecond(zoom);
      offsetRef.current = offset;
      scrollRef.current?.scrollTo({ x: offset, animated: false });
    });

  useEffect(() => {
    if (!viewportWidth || scrubbingRef.current) return;
    if (initializedRef.current && !playing) return;
    initializedRef.current = true;
    const offset = pixelsForTicks(playheadTick, pixelsPerSecond);
    offsetRef.current = offset;
    scrollRef.current?.scrollTo({ x: offset, animated: false });
  }, [pixelsPerSecond, playheadTick, playing, viewportWidth]);

  useEffect(
    () => () => {
      if (settleTimerRef.current != null) clearTimeout(settleTimerRef.current);
    },
    [],
  );

  const reportScrollOffset = (rawOffset: number) => {
    const offset = Math.max(0, rawOffset);
    offsetRef.current = offset;
    onSeek(Math.min(duration, tickForScrollOffset(offset, pixelsPerSecond)));
  };

  const finishScrub = (rawOffset: number) => {
    const offset = Math.max(0, rawOffset);
    offsetRef.current = offset;
    const current = tickForScrollOffset(offset, pixelsPerSecond);
    const snapped = snapTimelineTick(current, boundaries, 8, pixelsPerSecond);
    const finalTick = snapped.snapped ? snapped.tick : Math.min(duration, current);
    if (snapped.snapped && snapped.tick !== current) {
      const offset = pixelsForTicks(snapped.tick, pixelsPerSecond);
      offsetRef.current = offset;
      scrollRef.current?.scrollTo({ x: offset, animated: true });
      void Haptics.selectionAsync();
    }
    onSeek(finalTick);
    onScrubEnd(finalTick);
    scrubbingRef.current = false;
  };

  const beginScrub = () => {
    scrubbingRef.current = true;
    onScrubStart();
  };

  const scheduleScrubEnd = (offset: number) => {
    settleTimerRef.current = setTimeout(() => {
      settleTimerRef.current = null;
      finishScrub(offset);
    }, 80);
  };

  const beginMomentum = () => {
    if (settleTimerRef.current != null) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    scrubbingRef.current = true;
  };

  const endMomentum = (offset: number) => {
    if (settleTimerRef.current != null) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    finishScrub(offset);
  };

  const scrollHandler = useAnimatedScrollHandler(
    {
      onScroll: (event) => {
        const now = Date.now();
        if (now - lastPreviewSeekAt.value < 100) return;
        lastPreviewSeekAt.value = now;
        runOnJS(reportScrollOffset)(event.contentOffset.x);
      },
      onBeginDrag: () => {
        runOnJS(beginScrub)();
      },
      onEndDrag: (event) => {
        runOnJS(scheduleScrubEnd)(event.contentOffset.x);
      },
      onMomentumBegin: () => {
        runOnJS(beginMomentum)();
      },
      onMomentumEnd: (event) => {
        runOnJS(endMomentum)(event.contentOffset.x);
      },
    },
    [duration, pixelsPerSecond],
  );

  return (
    <View
      className="border-y border-border bg-black"
      style={{ height: timelineHeight, overflow: 'visible' }}
      onLayout={(event) => {
        setViewportWidth(event.nativeEvent.layout.width);
        setViewportHeight(event.nativeEvent.layout.height);
      }}
    >
      <GestureDetector gesture={pinch}>
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          bounces={false}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          onScroll={scrollHandler}
        >
          <View style={{ width: viewportWidth / 2 }} />
          <View style={{ width: Math.max(60, contentWidth + 60), height: viewportHeight }}>
            <TimelineRuler duration={duration} pixelsPerSecond={pixelsPerSecond} />
            <View
              className="absolute left-0 right-0"
              style={{ top: TIMELINE_VIDEO_TRACK_TOP, height: TIMELINE_VIDEO_TRACK_HEIGHT }}
            >
              {videoTrack.items.map((item) => (
                <Fragment key={item.id}>
                <VideoTimelineItem
                  left={pixelsForTicks(item.timelineStart, pixelsPerSecond)}
                  width={pixelsForTicks(item.timelineEnd - item.timelineStart, pixelsPerSecond)}
                  label={item.label}
                  path={document.assets[item.assetId]?.proxy?.uri ?? document.assets[item.assetId]?.sourceUri}
                  sourceStart={item.sourceStart / 60_000}
                  sourceEnd={item.sourceEnd / 60_000}
                  fallbackUri={document.assets[item.assetId]?.thumbnail?.uri}
                  sourceFingerprint={document.assets[item.assetId]?.sourceFingerprint}
                  selected={selection?.id === item.id}
                  onPress={() => onSelectionChange({ kind: 'video', id: item.id })}
                  onReorder={(translationX) => {
                    const center =
                      pixelsForTicks(item.timelineStart, pixelsPerSecond) +
                      pixelsForTicks(item.timelineEnd - item.timelineStart, pixelsPerSecond) / 2 +
                      translationX;
                    const toIndex = videoTrack.items.findIndex(
                      (candidate) =>
                        center <
                        pixelsForTicks(candidate.timelineEnd, pixelsPerSecond),
                    );
                    onMoveVideo(
                      item.id,
                      toIndex < 0 ? videoTrack.items.length - 1 : toIndex,
                    );
                  }}
                />
                {selection?.id === item.id ? (
                  <>
                    <TrimHandle
                      key={`${item.id}-start`}
                      left={pixelsForTicks(item.timelineStart, pixelsPerSecond)}
                      edge="start"
                      sourceTick={item.sourceStart}
                      speed={item.speed}
                      pixelsPerSecond={pixelsPerSecond}
                      onTrim={(sourceTick) => onTrimVideo(item.id, 'start', sourceTick)}
                    />
                    <TrimHandle
                      key={`${item.id}-end`}
                      left={pixelsForTicks(item.timelineEnd, pixelsPerSecond)}
                      edge="end"
                      sourceTick={item.sourceEnd}
                      speed={item.speed}
                      pixelsPerSecond={pixelsPerSecond}
                      onTrim={(sourceTick) => onTrimVideo(item.id, 'end', sourceTick)}
                    />
                  </>
                ) : null}
                </Fragment>
              ))}
              {videoTrack.transitions.map((transition) => {
                const toItem = videoTrack.items.find((item) => item.id === transition.toItemId);
                if (!toItem) return null;
                const selected = selection?.kind === 'transition' && selection.id === transition.id;
                return (
                  <Pressable
                    key={transition.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${transition.transition} transition`}
                    onPress={() =>
                      onSelectionChange({ kind: 'transition', id: transition.id })
                    }
                    className={`absolute top-4 z-30 h-8 w-8 items-center justify-center rounded-md border ${
                      selected ? 'border-accent bg-accent' : 'border-white/70 bg-black/80'
                    }`}
                    style={{
                      left: pixelsForTicks(toItem.timelineStart, pixelsPerSecond) - 16,
                    }}
                  >
                    <Ionicons
                      name={transition.transition === 'cut' ? 'remove' : 'swap-horizontal'}
                      size={16}
                      color="#ffffff"
                    />
                  </Pressable>
                );
              })}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add media"
                onPress={onAddMedia}
                className="absolute top-1 h-14 w-12 items-center justify-center rounded-lg bg-white"
                style={{ left: contentWidth + 6 }}
              >
                <Ionicons name="add" size={28} color="#111111" />
              </Pressable>
            </View>
            {!hasAudio && videoTrack.items.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add sound"
                onPress={onAddAudio}
                className="absolute h-11 flex-row items-center gap-3 rounded-md bg-[#202023] px-4"
                style={{
                  top: TIMELINE_SECONDARY_TRACK_TOP,
                  left: 0,
                  width: Math.max(170, Math.min(contentWidth, 260)),
                }}
              >
                <Ionicons name="musical-note" size={18} color="#ffffff" />
                <Text className="text-sm font-semibold text-white">Add sound</Text>
              </Pressable>
            ) : null}
            {visibleSecondaryTracks
              .slice(0, 3)
              .map((track, index) => (
                <View
                  key={track.id}
                  className="absolute left-0 right-0 h-11"
                  style={{
                    top: TIMELINE_SECONDARY_TRACK_TOP + index * TIMELINE_SECONDARY_TRACK_STRIDE,
                  }}
                >
                  {track.items.map((item) => (
                    <TimelineItem
                      key={item.id}
                      left={pixelsForTicks(item.timelineStart, pixelsPerSecond)}
                      width={pixelsForTicks(item.timelineEnd - item.timelineStart, pixelsPerSecond)}
                      label={'label' in item ? item.label : item.kind}
                      kind={track.kind as 'text' | 'overlay' | 'audio'}
                      selected={selection?.id === item.id}
                      onPress={() =>
                        onSelectionChange({
                          kind: item.kind as SelectionKind,
                          id: item.id,
                        })
                      }
                    />
                  ))}
                </View>
              ))}
            {document.captionDocument?.enabled ? (
              <View
                className="absolute left-0 right-0 h-11"
                style={{
                  top:
                    TIMELINE_SECONDARY_TRACK_TOP +
                    Math.min(3, visibleSecondaryTracks.length) * TIMELINE_SECONDARY_TRACK_STRIDE,
                }}
              >
                {document.captionDocument.phrases.map((phrase) => (
                  <TimelineItem
                    key={phrase.id}
                    left={pixelsForTicks(phrase.start, pixelsPerSecond)}
                    width={pixelsForTicks(phrase.end - phrase.start, pixelsPerSecond)}
                    label={phrase.wordIds
                      .map((id) =>
                        document.captionDocument?.words.find((word) => word.id === id)?.word,
                      )
                      .filter(Boolean)
                      .join(' ')}
                    kind="caption"
                    selected={selection?.kind === 'caption'}
                    onPress={() =>
                      onSelectionChange({
                        kind: 'caption',
                        id: document.captionDocument!.id,
                      })
                    }
                  />
                ))}
              </View>
            ) : null}
          </View>
          <View style={{ width: viewportWidth / 2 }} />
        </Animated.ScrollView>
      </GestureDetector>
      {/*
        Playhead sits in the timeline chrome. The white circle lives in the ruler
        band (below border-t) so Android's default overflow clipping / the top
        separator no longer shears the head in half.
      */}
      <View
        pointerEvents="none"
        className="absolute bottom-0 left-1/2 items-center"
        style={{ top: 0, width: 12, marginLeft: -6 }}
      >
        <View className="mt-0.5 h-2.5 w-2.5 rounded-full bg-white" />
        <View className="w-0.5 flex-1 bg-white" />
      </View>
    </View>
  );
}

function TimelineRuler({
  duration,
  pixelsPerSecond,
}: {
  duration: number;
  pixelsPerSecond: number;
}) {
  const seconds = Math.ceil(duration / 60_000);
  const interval = pixelsPerSecond >= 60 ? 1 : pixelsPerSecond >= 24 ? 2 : 5;
  return (
    <View className="absolute inset-x-0 top-0 h-6">
      {Array.from({ length: Math.ceil(seconds / interval) + 1 }, (_, index) => {
        const second = index * interval;
        return (
          <Text
            key={second}
            className="absolute text-[9px] text-muted"
            style={{ left: second * pixelsPerSecond }}
          >
            {second}s
          </Text>
        );
      })}
    </View>
  );
}

function VideoTimelineItem({
  left,
  width,
  label,
  path,
  fallbackUri,
  sourceFingerprint,
  sourceStart,
  sourceEnd,
  selected,
  onPress,
  onReorder,
}: {
  left: number;
  width: number;
  label: string;
  path?: string;
  fallbackUri?: string;
  sourceFingerprint?: string;
  sourceStart: number;
  sourceEnd: number;
  selected: boolean;
  onPress: () => void;
  onReorder: (translationX: number) => void;
}) {
  const reorder = Gesture.Pan()
    .activateAfterLongPress(350)
    .failOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .runOnJS(true)
    .onStart(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    })
    .onEnd((event) => {
      onReorder(event.translationX);
      void Haptics.selectionAsync();
    });
  return (
    <GestureDetector gesture={reorder}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Select ${label}; hold and drag to reorder`}
        onPress={onPress}
        className={`absolute bottom-0 top-0 overflow-hidden rounded-md border-2 ${
          selected ? 'border-white' : 'border-transparent'
        }`}
        style={{ left, width: Math.max(10, width) }}
      >
        {path ? (
          <FilmstripFrames
            path={path}
            start={sourceStart}
            end={sourceEnd}
            width={Math.max(10, width)}
            height={64}
            fallbackUri={fallbackUri}
            sourceFingerprint={sourceFingerprint}
          />
        ) : (
          <View className="flex-1 bg-surfaceMuted" />
        )}
        <View className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5">
          <Text className="text-[8px] font-medium text-white" numberOfLines={1}>
            {label}
          </Text>
        </View>
      </Pressable>
    </GestureDetector>
  );
}

function TimelineItem({
  left,
  width,
  label,
  kind,
  selected,
  onPress,
}: {
  left: number;
  width: number;
  label: string;
  kind: Exclude<SelectionKind, 'video' | 'transition'>;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Select ${label}`}
      onPress={onPress}
      className={`absolute bottom-0 top-0 justify-center overflow-hidden rounded-md border ${
        selected ? 'border-white' : 'border-white/20'
      }`}
      style={{
        left,
        width: Math.max(8, width),
        backgroundColor:
          kind === 'audio'
            ? '#8298ff'
            : kind === 'text'
              ? '#ee8ee8'
              : kind === 'caption'
                ? '#facc15'
                : '#8f72da',
      }}
    >
      {kind === 'audio' ? (
        <View className="absolute inset-0 flex-row items-center justify-around opacity-35">
          {Array.from({ length: Math.max(8, Math.min(40, Math.floor(width / 8))) }, (_, index) => (
            <View
              key={index}
              className="w-0.5 rounded-full bg-blue-950"
              style={{ height: 8 + ((index * 13) % 24) }}
            />
          ))}
        </View>
      ) : null}
      <Text className="px-3 text-xs font-medium text-[#202044]" numberOfLines={1}>
        {kind === 'audio' ? '♫  ' : kind === 'caption' ? 'CC  ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}

function TrimHandle({
  left,
  edge,
  sourceTick,
  speed,
  pixelsPerSecond,
  onTrim,
}: {
  left: number;
  edge: 'start' | 'end';
  sourceTick: number;
  speed: number;
  pixelsPerSecond: number;
  onTrim: (sourceTick: number) => void;
}) {
  const sourceAtStart = useRef(sourceTick);
  const trim = Gesture.Pan()
    .runOnJS(true)
    .onBegin(() => {
      sourceAtStart.current = sourceTick;
      void Haptics.selectionAsync();
    })
    .onUpdate((event) => {
      const sourceDelta = Math.round(
        ticksForPixels(event.translationX, pixelsPerSecond) * speed,
      );
      onTrim(sourceAtStart.current + sourceDelta);
    })
    .onEnd(() => {
      void Haptics.selectionAsync();
    });
  return (
    <GestureDetector gesture={trim}>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel={`Trim clip ${edge}`}
        className="absolute bottom-0 top-0 z-20 w-5 items-center justify-center rounded-sm bg-white"
        style={{ left: left - (edge === 'start' ? 2 : 18) }}
      >
        <View className="h-5 w-0.5 bg-black" />
      </View>
    </GestureDetector>
  );
}
