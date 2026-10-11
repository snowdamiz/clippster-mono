import { TARGET_DIMENSIONS, type ManualFramingConfig, type TargetAspectRatio } from '@clippster/shared-types'
import { BlurTargetView, BlurView } from 'expo-blur'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useEffect, useMemo, useRef } from 'react'
import { PanResponder, Text, View, type GestureResponderHandlers } from 'react-native'
import { configurePreviewPlayer } from '@/lib/configurePreviewPlayer'
import { toVideoSource } from '@/lib/playbackVideo'
import { tokens } from '@/theme/tokens'
import { CroppedRegionVideo } from './CroppedRegionVideo'
import { DraggableRegionFrame } from './DraggableRegionFrame'
import { getActiveFramingRegions, getFramingPreviewRegions, replaceActiveFramingRegions } from './framingRegions'

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
  backgroundMode = 'cover'
}: {
  videoPath: string
  syncTime: number
  playing: boolean
  blurAmount: number
  previewWidth: number
  previewHeight: number
  sourceLeft: number
  sourceTop: number
  sourceWidth: number
  sourceHeight: number
  panHandlers?: GestureResponderHandlers
  showBorder?: boolean
  backgroundMode?: 'cover' | 'black'
}) {
  const blurTargetRef = useRef<View | null>(null)
  const foregroundBlurRef = useRef<View | null>(null)
  const backgroundPlayer = useVideoPlayer(toVideoSource(videoPath), configurePreviewPlayer)
  const foregroundPlayer = useVideoPlayer(toVideoSource(videoPath), configurePreviewPlayer)

  useEffect(() => {
    if (backgroundMode === 'black') backgroundPlayer.pause()
    for (const previewPlayer of backgroundMode === 'cover'
      ? [backgroundPlayer, foregroundPlayer]
      : [foregroundPlayer]) {
      previewPlayer.muted = true
      previewPlayer.volume = 0
      const drift = Math.abs(previewPlayer.currentTime - syncTime)
      if (!playing || !previewPlayer.playing || drift > 0.75) {
        previewPlayer.currentTime = syncTime
      }
      if (playing && !previewPlayer.playing) previewPlayer.play()
      if (!playing && previewPlayer.playing) previewPlayer.pause()
    }
  }, [backgroundMode, backgroundPlayer, foregroundPlayer, playing, syncTime])

  return (
    <>
      {backgroundMode === 'cover' ? (
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
        </>
      ) : null}
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
          overflow: 'hidden'
        }}
      >
        <BlurTargetView ref={foregroundBlurRef} style={{ width: sourceWidth, height: sourceHeight }}>
          <VideoView
            player={foregroundPlayer}
            style={{ width: sourceWidth, height: sourceHeight }}
            nativeControls={false}
            contentFit="contain"
            surfaceType="textureView"
          />
        </BlurTargetView>
        {backgroundMode === 'black' && blurAmount > 0 ? (
          <BlurView
            blurTarget={foregroundBlurRef}
            blurMethod="dimezisBlurViewSdk31Plus"
            intensity={Math.round((blurAmount / 30) * 100)}
            pointerEvents="none"
            style={{ position: 'absolute', inset: 0 }}
          />
        ) : null}
      </View>
    </>
  )
}

interface TargetPanelProps {
  config: ManualFramingConfig
  targetRatio: TargetAspectRatio
  onChange: (config: ManualFramingConfig) => void
  previewWidth: number
  videoPath: string
  currentTime: number
  videoTime: number
  playing: boolean
  safeArea?: { left: number; top: number; right: number; bottom: number }
  selectedRegionId: string | null
  onSelectRegion: (regionId: string | null) => void
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
  safeArea,
  onSelectRegion
}: TargetPanelProps) {
  const dims = TARGET_DIMENSIONS[targetRatio]
  const aspect = dims.width / dims.height
  const previewHeight = previewWidth / aspect
  const use16x9 = targetRatio === '9:16' && config.sourceFrameMode === 'use16x9'
  const transform = config.sourceTransform ?? { scale: 1, x: 0, y: 0 }
  const blurAmount = config.blurEnabled ? (config.blurAmount ?? 12) : 0
  const previewSyncTime = playing ? Math.floor(videoTime * 2) / 2 : videoTime
  const { regions: activeRegions, segmentIndex: activeSegmentIndex } = getActiveFramingRegions(config, currentTime)
  const transformRef = useRef(transform)
  transformRef.current = transform
  const dragStartRef = useRef(transform)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const sourceFrameResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          dragStartRef.current = { ...transformRef.current }
        },
        onPanResponderMove: (_, gesture) => {
          onChangeRef.current({
            ...config,
            sourceTransform: {
              ...transformRef.current,
              x: dragStartRef.current.x + gesture.dx / previewWidth,
              y: dragStartRef.current.y + gesture.dy / previewHeight
            }
          })
        }
      }),
    [config, previewHeight, previewWidth]
  )

  function updateOutput(regionId: string, patch: { x?: number; y?: number; width?: number; height?: number }) {
    onChange(
      replaceActiveFramingRegions(
        config,
        activeSegmentIndex,
        activeRegions.map((region) =>
          region.id === regionId ? { ...region, output: { ...region.output, ...patch } } : region
        )
      )
    )
  }

  const sourceWidth = previewWidth * transform.scale
  const sourceHeight = sourceWidth / (16 / 9)
  const sourceLeft = (previewWidth - sourceWidth) / 2 + transform.x * previewWidth
  const sourceTop = (previewHeight - sourceHeight) / 2 + transform.y * previewHeight

  return (
    <View className="items-center px-4">
      <View className={`w-full ${use16x9 ? 'items-center gap-[17px]' : 'items-center'}`}>
        <View
          style={{
            borderWidth: 1,
            borderColor: tokens.colors.accent,
            shadowColor: tokens.colors.accent,
            shadowOpacity: 0,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 0 },
            elevation: 0
          }}
          className="rounded-[15px] bg-accent"
        >
          <View
            style={{ width: previewWidth, height: previewHeight }}
            className="relative overflow-hidden rounded-[10px] bg-black"
            collapsable={false}
          >
            {safeArea ? (
              <View
                pointerEvents="none"
                className="absolute z-40 border border-dashed border-warning"
                style={{
                  left: safeArea.left * previewWidth,
                  right: safeArea.right * previewWidth,
                  top: safeArea.top * previewHeight,
                  bottom: safeArea.bottom * previewHeight
                }}
              />
            ) : null}
            {config.sourceFrameMode && config.sourceFrameMode !== 'none' ? (
              <Use16x9Preview
                backgroundMode={use16x9 ? 'cover' : 'black'}
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
            ) : null}
            <>
              {getFramingPreviewRegions(config, currentTime).map((region) => (
                <CroppedRegionVideo
                  key={`preview-${region.id}`}
                  region={region}
                  videoPath={videoPath}
                  currentTime={previewSyncTime}
                  mediaTime={currentTime}
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
              {activeRegions.length === 0 && (!config.sourceFrameMode || config.sourceFrameMode === 'none') ? (
                <View className="flex-1 items-center justify-center px-3">
                  <Text className="text-center text-[10px] text-muted">Add a source region</Text>
                </View>
              ) : null}
            </>
          </View>
        </View>
      </View>
    </View>
  )
}
