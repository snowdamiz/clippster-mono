import {
  ClippsterEditorPreview,
  isNativePreviewAvailable,
} from '@clippster/editor-native';
import { useMemo } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { EditorAudioPlayback } from '../engine/EditorAudioPlayback';
import {
  ticksToSeconds,
  transformForRatio,
  type EditorSelection,
  type MobileEditProjectV3,
  type Transform,
} from '../model/schema';
import { resolveVideoAtTick } from '../model/timeline';
import { CanvasControls } from './CanvasControls';

/**
 * Single native preview surface + RN selection chrome / audio mix.
 * Video, text, and image overlays are composed by @clippster/editor-native.
 */
export function EditorCanvas({
  document,
  playheadTick,
  playing,
  scrubbing,
  selection,
  onSelectionChange,
  onRatioChange,
  onToggleSafeArea,
  onTransformItem,
}: {
  document: MobileEditProjectV3;
  playheadTick: number;
  playing: boolean;
  scrubbing: boolean;
  selection: EditorSelection | null;
  onSelectionChange: (selection: EditorSelection | null) => void;
  onRatioChange: (ratio: '9:16' | '16:9') => void;
  onToggleSafeArea: () => void;
  onTransformItem: (itemId: string, transform: Transform) => void;
}) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const ratio = document.canvas.activeRatio;
  const aspectRatio = ratio === '9:16' ? 9 / 16 : 16 / 9;
  const maxWidth = windowWidth;
  const maxHeight = Math.min(windowHeight * 0.5, 480);
  const width = Math.min(maxWidth, maxHeight * aspectRatio);
  const height = width / aspectRatio;
  const activeVideo = resolveVideoAtTick(document, playheadTick);
  const hasMedia = Object.values(document.assets).some(
    (asset) => asset.kind === 'video' || asset.kind === 'image',
  );
  const nativeReady = isNativePreviewAvailable();
  // Only re-serialize when the edit document changes — not every playhead tick.
  const documentJson = useMemo(() => JSON.stringify(document), [document]);

  return (
    <View className="min-h-[240px] flex-1 items-center justify-center bg-black">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Video canvas"
        onPress={() =>
          onSelectionChange(activeVideo ? { kind: 'video', id: activeVideo.id } : null)
        }
        className="overflow-hidden bg-black"
        style={{ width, height: Math.min(height, maxHeight) }}
      >
        {!hasMedia ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-sm text-muted">Add media to start editing</Text>
          </View>
        ) : !nativeReady ? (
          <View className="flex-1 items-center justify-center px-4">
            <Text className="text-center text-sm text-warning">
              Native editor engine requires a rebuilt dev client.
            </Text>
          </View>
        ) : (
          <ClippsterEditorPreview
            documentJson={documentJson}
            playing={playing}
            playheadSeconds={ticksToSeconds(playheadTick)}
            quality="auto"
            style={{ width: '100%', height: '100%' }}
          />
        )}

        {document.tracks
          .filter((track) => track.kind === 'audio')
          .flatMap((track) => track.items)
          .filter((item) => playheadTick >= item.timelineStart && playheadTick < item.timelineEnd)
          .map((item) => {
            const audioAsset = document.assets[item.assetId];
            if (!audioAsset) return null;
            const position = playheadTick - item.timelineStart;
            const duration = item.timelineEnd - item.timelineStart;
            const fadeIn = item.fadeInTicks > 0 ? Math.min(1, position / item.fadeInTicks) : 1;
            const fadeOut =
              item.fadeOutTicks > 0
                ? Math.min(1, (duration - position) / item.fadeOutTicks)
                : 1;
            return (
              <EditorAudioPlayback
                key={item.id}
                uri={audioAsset.proxy?.uri ?? audioAsset.sourceUri}
                sourceSeconds={ticksToSeconds(
                  item.sourceStart + Math.round(position * item.speed),
                )}
                playing={playing}
                scrubbing={scrubbing}
                volume={item.volume * Math.max(0, Math.min(fadeIn, fadeOut))}
                speed={item.speed}
              />
            );
          })}

        {document.tracks
          .filter((track) => track.kind === 'overlay' || track.kind === 'text')
          .flatMap((track) =>
            track.items
              .filter(
                (item) =>
                  playheadTick >= item.timelineStart && playheadTick < item.timelineEnd,
              )
              .map((item) => (
                <CanvasItem
                  key={item.id}
                  transform={transformForRatio(item.transform, ratio)}
                  selected={selection?.id === item.id}
                  onPress={() =>
                    onSelectionChange({
                      kind: track.kind === 'text' ? 'text' : 'overlay',
                      id: item.id,
                    })
                  }
                  canvasWidth={width}
                  canvasHeight={height}
                  onTransform={(next) => onTransformItem(item.id, next)}
                />
              )),
          )}

        <CaptionHitTarget
          document={document}
          playheadTick={playheadTick}
          selected={selection?.kind === 'caption'}
          onPress={() => {
            if (document.captionDocument) {
              onSelectionChange({ kind: 'caption', id: document.captionDocument.id });
            }
          }}
          canvasWidth={width}
          canvasHeight={height}
          onTransform={(transform) => {
            if (document.captionDocument) {
              onTransformItem(document.captionDocument.id, transform);
            }
          }}
        />
        {document.canvas.safeAreaVisible ? <SafeAreaGuide ratio={ratio} /> : null}
        <CanvasControls
          activeRatio={ratio}
          safeAreaVisible={document.canvas.safeAreaVisible}
          onRatioChange={onRatioChange}
          onToggleSafeArea={onToggleSafeArea}
        />
      </Pressable>
    </View>
  );
}

function CanvasItem({
  transform,
  selected,
  onPress,
  canvasWidth,
  canvasHeight,
  onTransform,
}: {
  transform: Transform;
  selected: boolean;
  onPress: () => void;
  canvasWidth: number;
  canvasHeight: number;
  onTransform: (transform: Transform) => void;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const gestureScale = useSharedValue(1);
  const gestureRotation = useSharedValue(0);
  const commitMove = (x: number, y: number) => {
    onTransform({
      ...transform,
      positionX: Math.max(0, Math.min(1, transform.positionX + x / canvasWidth)),
      positionY: Math.max(0, Math.min(1, transform.positionY + y / canvasHeight)),
    });
  };
  const commitScale = (scale: number) => {
    onTransform({
      ...transform,
      scaleX: Math.max(0.1, Math.min(5, transform.scaleX * scale)),
      scaleY: Math.max(0.1, Math.min(5, transform.scaleY * scale)),
    });
  };
  const commitRotation = (radians: number) => {
    onTransform({
      ...transform,
      rotationDeg: transform.rotationDeg + (radians * 180) / Math.PI,
    });
  };
  const gesture = Gesture.Simultaneous(
    Gesture.Pan()
      .enabled(selected)
      .onUpdate((event) => {
        translateX.value = event.translationX;
        translateY.value = event.translationY;
      })
      .onEnd((event) => {
        runOnJS(commitMove)(event.translationX, event.translationY);
        translateX.value = 0;
        translateY.value = 0;
      }),
    Gesture.Pinch()
      .enabled(selected)
      .onUpdate((event) => {
        gestureScale.value = event.scale;
      })
      .onEnd((event) => {
        runOnJS(commitScale)(event.scale);
        gestureScale.value = 1;
      }),
    Gesture.Rotation()
      .enabled(selected)
      .onUpdate((event) => {
        gestureRotation.value = event.rotation;
      })
      .onEnd((event) => {
        runOnJS(commitRotation)(event.rotation);
        gestureRotation.value = 0;
      }),
  );
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -80 * transform.anchorX + translateX.value },
      { translateY: -96 * transform.anchorY + translateY.value },
      { scaleX: transform.scaleX * gestureScale.value },
      { scaleY: transform.scaleY * gestureScale.value },
      { rotate: `${transform.rotationDeg + (gestureRotation.value * 180) / Math.PI}deg` },
    ],
  }));
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        className={`absolute h-24 w-40 ${selected ? 'border-2 border-accent' : ''}`}
        style={[
          {
            left: `${transform.positionX * 100}%`,
            top: `${transform.positionY * 100}%`,
          },
          animatedStyle,
        ]}
      >
        <Pressable onPress={onPress} className="flex-1" />
      </Animated.View>
    </GestureDetector>
  );
}

function CaptionHitTarget({
  document,
  playheadTick,
  selected,
  onPress,
  canvasWidth,
  canvasHeight,
  onTransform,
}: {
  document: MobileEditProjectV3;
  playheadTick: number;
  selected: boolean;
  onPress: () => void;
  canvasWidth: number;
  canvasHeight: number;
  onTransform: (transform: Transform) => void;
}) {
  const captions = document.captionDocument;
  if (!captions?.enabled) return null;
  const phrase = captions.phrases.find(
    (candidate) => playheadTick >= candidate.start && playheadTick < candidate.end,
  );
  if (!phrase) return null;
  return (
    <CanvasItem
      transform={transformForRatio(captions.transform, document.canvas.activeRatio)}
      selected={selected}
      onPress={onPress}
      canvasWidth={canvasWidth}
      canvasHeight={canvasHeight}
      onTransform={onTransform}
    />
  );
}

function SafeAreaGuide({ ratio }: { ratio: '9:16' | '16:9' }) {
  return (
    <View
      pointerEvents="none"
      className="absolute border border-dashed border-warning"
      style={
        ratio === '9:16'
          ? { left: '8%', right: '8%', top: '12%', bottom: '18%' }
          : { left: '6%', right: '6%', top: '10%', bottom: '10%' }
      }
    />
  );
}
