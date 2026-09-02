import type { ManualFramingConfig } from '@clippster/shared-types';
import { createDefaultManualRegion, MAX_POI_REGIONS } from '@clippster/shared-types';
import type { VideoPlayer } from 'expo-video';
import { VideoView } from 'expo-video';
import { Pressable, Text, View } from 'react-native';
import { DraggableRegionFrame } from './DraggableRegionFrame';
import { appAlert } from '@/lib/appAlert';

interface SourcePanelProps {
  config: ManualFramingConfig;
  onChange: (config: ManualFramingConfig) => void;
  canvasWidth: number;
  canvasHeight: number;
  player: VideoPlayer | null;
}

export function SourcePanel({
  config,
  onChange,
  canvasWidth,
  canvasHeight,
  player,
}: SourcePanelProps) {
  function updateRegion(regionId: string, patch: { x?: number; y?: number; width?: number; height?: number }) {
    onChange({
      ...config,
      regions: config.regions.map((region) =>
        region.id === regionId ? { ...region, source: { ...region.source, ...patch } } : region,
      ),
    });
  }

  function addRegion() {
    if (config.regions.length >= MAX_POI_REGIONS) {
      appAlert('Limit reached', `Maximum ${MAX_POI_REGIONS} regions.`);
      return;
    }
    onChange({
      ...config,
      regions: [...config.regions, createDefaultManualRegion(config.regions.length)],
    });
  }

  function removeRegion(id: string) {
    onChange({ ...config, regions: config.regions.filter((region) => region.id !== id) });
  }

  return (
    <View>
      <View className="mb-2 flex-row items-center justify-between px-4">
        <Text className="text-sm font-semibold text-foreground">Source regions</Text>
        <Pressable onPress={addRegion} className="rounded bg-primary px-3 py-1">
          <Text className="text-xs text-primary-foreground">Add region</Text>
        </Pressable>
      </View>

      <View
        style={{ width: canvasWidth, height: canvasHeight, alignSelf: 'center' }}
        className="relative overflow-hidden rounded-lg bg-black"
        collapsable={false}
      >
        {player ? (
          <VideoView
            player={player}
            style={{ width: canvasWidth, height: canvasHeight }}
            nativeControls={false}
            contentFit="contain"
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-xs text-muted">Video unavailable</Text>
          </View>
        )}

        {config.regions.map((region) => (
          <DraggableRegionFrame
            key={region.id}
            x={region.source.x}
            y={region.source.y}
            width={region.source.width}
            height={region.source.height}
            color={region.color}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            onMove={(x, y) => updateRegion(region.id, { x, y })}
            onResize={(width, height) => updateRegion(region.id, { width, height })}
            onRemove={() => removeRegion(region.id)}
          />
        ))}
      </View>
    </View>
  );
}
