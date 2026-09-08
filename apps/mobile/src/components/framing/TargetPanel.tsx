import {
  TARGET_DIMENSIONS,
  type ManualFramingConfig,
  type TargetAspectRatio,
} from '@clippster/shared-types';
import { BlurTargetView, BlurView } from 'expo-blur';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useRef } from 'react';
import {
  PanResponder,
  Pressable,
  Text,
  View,
  type GestureResponderHandlers,
} from 'react-native';
import { SeekBar } from '@/components/ui/seek-bar';
import { configurePreviewPlayer } from '@/lib/configurePreviewPlayer';
import { toVideoSource } from '@/lib/playbackVideo';
import { tokens } from '@/theme/tokens';
import { CroppedRegionVideo } from './CroppedRegionVideo';
import { DraggableRegionFrame } from './DraggableRegionFrame';
import { getActiveFramingRegions, replaceActiveFramingRegions } from './framingRegions';

export function Use16x9Preview({
  videoPath,
  syncTime,
  playing,
  blurAmount,
  previewWidth,
  previewHeight,
  sourceLeft,
  sourceTop,
  sourceWidth,
  sourceHeight,
  panHandlers,
  showBorder = true,
}: {
  videoPath: string;
  syncTime: number;
  playing: boolean;
  blurAmount: number;
  previewWidth: number;
  previewHeight: number;
  sourceLeft: number;
  sourceTop: number;
  sourceWidth: number;
  sourceHeight: number;
  panHandlers?: GestureResponderHandlers;
  showBorder?: boolean;
}) {
  const blurTargetRef = useRef<View | null>(null);
  const backgroundPlayer = useVideoPlayer(toVideoSource(videoPath), configurePreviewPlayer);
  const foregroundPlayer = useVideoPlayer(toVideoSource(videoPath), configurePreviewPlayer);

  useEffect(() => {
    for (const previewPlayer of [backgroundPlayer, foregroundPlayer]) {
      previewPlayer.muted = true;
      previewPlayer.volume = 0;
      const drift = Math.abs(previewPlayer.currentTime - syncTime);
      if (!playing || !previewPlayer.playing || drift > 0.75) {
        previewPlayer.currentTime = syncTime;
      }
      if (playing && !previewPlayer.playing) previewPlayer.play();
      if (!playing && previewPlayer.playing) previewPlayer.pause();
    }
  }, [backgroundPlayer, foregroundPlayer, playing, syncTime]);

  return (
    <>
      <BlurTargetView ref={blurTargetRef} style={{ position: 'absolute', inset: 0 }}>
        <VideoView
          player={backgroundPlayer}
          style={{ width: previewWidth, height: previewHeight, transform: [{ scale: 1.08 }] }}
          nativeControls={false}
          contentFit="cover"
          surfaceType="textureView"
        />
      </BlurTargetView>
      <BlurView
        blurTarget={blurTargetRef}
        blurMethod="dimezisBlurViewSdk31Plus"
        intensity={Math.round((blurAmount / 30) * 100)}
        tint="dark"
        pointerEvents="none"
        style={{ position: 'absolute', inset: 0 }}
      />
      <View
        {...(panHandlers ?? {})}
        style={{
          position: 'absolute',
          left: sourceLeft,
          top: sourceTop,
          width: sourceWidth,
          height: sourceHeight,
          borderWidth: showBorder ? 2 : 0,
          borderColor: showBorder ? '#0ea5e9' : 'transparent',
          overflow: 'hidden',
        }}
      >
        <VideoView
          player={foregroundPlayer}
          style={{ width: sourceWidth, height: sourceHeight }}
          nativeControls={false}
          contentFit="contain"
          surfaceType="textureView"
        />
      </View>
    </>
  );
}

interface TargetPanelProps {
  config: ManualFramingConfig;
  targetRatio: TargetAspectRatio;
  onChange: (config: ManualFramingConfig) => void;
  previewWidth: number;
  videoPath: string;
  currentTime: number;
  videoTime: number;
  playing: boolean;
  selectedRegionId: string | null;
  onSelectRegion: (regionId: string | null) => void;
}

export function TargetPanel({
  config,
  targetRatio,
  onChange,
  previewWidth,
  videoPath,
  currentTime,
  videoTime,
  playing,
  selectedRegionId,
  onSelectRegion,
}: TargetPanelProps) {
  const dims = TARGET_DIMENSIONS[targetRatio];
  const aspect = dims.width / dims.height;
  const previewHeight = previewWidth / aspect;
  const use16x9 = targetRatio === '9:16' && config.sourceFrameMode === 'use16x9';
  const transform = config.sourceTransform ?? { scale: 1, x: 0, y: 0 };
  const blurAmount = config.blurEnabled ? (config.blurAmount ?? 12) : 0;
  const previewSyncTime = playing ? Math.floor(videoTime * 2) / 2 : videoTime;
  const { regions: activeRegions, segmentIndex: activeSegmentIndex } =
    getActiveFramingRegions(config, currentTime);
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const dragStartRef = useRef(transform);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const sourceFrameResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          dragStartRef.current = { ...transformRef.current };
        },
        onPanResponderMove: (_, gesture) => {
          onChangeRef.current({
            ...config,
            sourceTransform: {
              ...transformRef.current,
              x: dragStartRef.current.x + gesture.dx / previewWidth,
              y: dragStartRef.current.y + gesture.dy / previewHeight,
            },
          });
        },
      }),
    [config, previewHeight, previewWidth],
  );

  function updateOutput(
    regionId: string,
    patch: { x?: number; y?: number; width?: number; height?: number },
  ) {
    onChange(
      replaceActiveFramingRegions(
        config,
        activeSegmentIndex,
        activeRegions.map((region) =>
          region.id === regionId ? { ...region, output: { ...region.output, ...patch } } : region,
        ),
      ),
    );
  }

  function setUse16x9(enabled: boolean) {
    const nextBlurAmount = config.blurAmount ?? 12;
    onChange({
      ...config,
      targetAspectRatio: '9:16',
      sourceFrameMode: enabled ? 'use16x9' : 'none',
      blurEnabled: enabled ? nextBlurAmount > 0 : config.blurEnabled,
      blurAmount: nextBlurAmount,
      sourceTransform: config.sourceTransform ?? { scale: 1, x: 0, y: 0 },
    });
  }

  const sourceWidth = previewWidth * transform.scale;
  const sourceHeight = sourceWidth / (16 / 9);
  const sourceLeft = (previewWidth - sourceWidth) / 2 + transform.x * previewWidth;
  const sourceTop = (previewHeight - sourceHeight) / 2 + transform.y * previewHeight;

  return (
    <View className="items-center px-4">
      <View className="mb-1.5 w-full flex-row items-center justify-between">
        <Text className="text-xs font-semibold text-foreground">
          Target preview ({targetRatio})
        </Text>
        {targetRatio === '9:16' ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: use16x9 }}
            onPress={() => setUse16x9(!use16x9)}
            className={`rounded-md border px-2.5 py-1 ${
              use16x9 ? 'border-accent bg-accent/15' : 'border-border bg-surface'
            }`}
          >
            <Text className={`text-[10px] font-semibold ${use16x9 ? 'text-accent' : 'text-muted'}`}>
              Use 16:9
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View className={`w-full ${use16x9 ? 'flex-row items-center justify-center gap-3' : 'items-center'}`}>
        <View
          style={{
            borderWidth: 3,
            borderColor: tokens.colors.accent,
            shadowColor: tokens.colors.accent,
            shadowOpacity: 0.75,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 0 },
            elevation: 8,
          }}
          className="rounded-[15px] bg-accent"
        >
          <View
            style={{ width: previewWidth, height: previewHeight }}
            className="relative overflow-hidden rounded-[10px] bg-black"
            collapsable={false}
          >
            {use16x9 ? (
              <Use16x9Preview
                videoPath={videoPath}
                syncTime={previewSyncTime}
                playing={playing}
                blurAmount={blurAmount}
                previewWidth={previewWidth}
                previewHeight={previewHeight}
                sourceLeft={sourceLeft}
                sourceTop={sourceTop}
                sourceWidth={sourceWidth}
                sourceHeight={sourceHeight}
                panHandlers={sourceFrameResponder.panHandlers}
              />
            ) : (
              <>
                {activeRegions.map((region) => (
                  <CroppedRegionVideo
                    key={`preview-${region.id}`}
                    region={region}
                    videoPath={videoPath}
                    currentTime={previewSyncTime}
                    playing={playing}
                    canvasWidth={previewWidth}
                    canvasHeight={previewHeight}
                  />
                ))}
                {activeRegions.map((region, index) => (
                  <DraggableRegionFrame
                    key={`frame-${region.id}`}
                    x={region.output.x}
                    y={region.output.y}
                    width={region.output.width}
                    height={region.output.height}
                    color={region.color}
                    label={region.label ?? `Region ${index + 1}`}
                    isSelected={selectedRegionId === region.id}
                    canvasWidth={previewWidth}
                    canvasHeight={previewHeight}
                    aspectRatioLocked={region.aspectRatioLocked !== false}
                    onChange={(rect) => updateOutput(region.id, rect)}
                    onSelect={() => onSelectRegion(region.id)}
                  />
                ))}
                {activeRegions.length === 0 ? (
                  <View className="flex-1 items-center justify-center px-3">
                    <Text className="text-center text-[10px] text-muted">
                      Add a source region
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </View>
        </View>

        {use16x9 ? (
          <View className="w-40 gap-3 rounded-xl border border-border bg-surface px-3 py-3">
          <View>
              <Text className="text-[10px] font-medium text-muted">
                Background blur {Math.round(blurAmount)}
              </Text>
            <SeekBar
              minimumValue={0}
              maximumValue={30}
              step={1}
              value={blurAmount}
              onValueChange={(amount) =>
                onChange({
                  ...config,
                  blurEnabled: amount > 0,
                  blurAmount: amount,
                })
              }
            />
          </View>
          <View>
              <Text className="text-[10px] font-medium text-muted">
                Frame scale {Math.round(transform.scale * 100)}%
            </Text>
            <SeekBar
              minimumValue={0.5}
              maximumValue={5}
              step={0.05}
              value={transform.scale}
              onValueChange={(scale) =>
                onChange({
                  ...config,
                  sourceTransform: { ...transform, scale },
                })
              }
            />
          </View>
            <Text className="text-[9px] leading-3 text-muted">
              Drag the sharp frame to reposition it.
          </Text>
        </View>
        ) : null}
      </View>
    </View>
  );
}
