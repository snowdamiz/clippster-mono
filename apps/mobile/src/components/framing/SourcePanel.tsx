import type { ManualFramingConfig, ManualRegion } from '@clippster/shared-types'
import type { VideoPlayer } from 'expo-video'
import { VideoView } from 'expo-video'
import { Text, View } from 'react-native'
import { DraggableRegionFrame } from './DraggableRegionFrame'
import { getActiveFramingRegions, replaceActiveFramingRegions } from './framingRegions'

interface SourcePanelProps {
  config: ManualFramingConfig
  onChange: (config: ManualFramingConfig) => void
  canvasWidth: number
  canvasHeight: number
  player: VideoPlayer | null
  currentTime: number
  selectedRegionId: string | null
  onSelectRegion: (regionId: string | null) => void
}

export function SourcePanel({
  config,
  onChange,
  canvasWidth,
  canvasHeight,
  player,
  currentTime,
  selectedRegionId,
  onSelectRegion
}: SourcePanelProps) {
  const { regions: activeRegions, segmentIndex } = getActiveFramingRegions(config, currentTime)
  function patchRegion(regionId: string, patch: Partial<ManualRegion>) {
    onChange(
      replaceActiveFramingRegions(
        config,
        segmentIndex,
        activeRegions.map((region) => (region.id === regionId ? { ...region, ...patch } : region))
      )
    )
  }

  function updateRegion(regionId: string, patch: { x?: number; y?: number; width?: number; height?: number }) {
    const region = activeRegions.find((item) => item.id === regionId)
    if (!region) return
    patchRegion(regionId, { source: { ...region.source, ...patch } })
  }

  return (
    <View>
      <View
        style={{ width: canvasWidth, height: canvasHeight, alignSelf: 'center' }}
        className="relative overflow-hidden rounded-[14px] bg-black"
        collapsable={false}
      >
        {player ? (
          <VideoView
            player={player}
            style={{ width: canvasWidth, height: canvasHeight }}
            nativeControls={false}
            contentFit="contain"
            surfaceType="textureView"
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-xs text-muted">Video unavailable</Text>
          </View>
        )}

        {activeRegions
          .filter((region) => !region.mediaAssetId)
          .map((region, index) => (
            <DraggableRegionFrame
              key={region.id}
              x={region.source.x}
              y={region.source.y}
              width={region.source.width}
              height={region.source.height}
              color={region.color}
              label={region.label ?? `Region ${index + 1}`}
              isSelected={selectedRegionId === region.id}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              aspectRatioLocked={region.aspectRatioLocked !== false}
              onChange={(rect) => updateRegion(region.id, rect)}
              onSelect={() => onSelectRegion(region.id)}
            />
          ))}
      </View>
    </View>
  )
}
