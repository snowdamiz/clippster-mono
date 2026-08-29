import type { ManualFramingConfig } from '@clippster/shared-types';
import { TARGET_DIMENSIONS, type TargetAspectRatio } from '@clippster/shared-types';
import type { VideoPlayer } from 'expo-video';
import { VideoView } from 'expo-video';
import { Text, View } from 'react-native';
import { DraggableRegionFrame } from './DraggableRegionFrame';

interface TargetPanelProps {
  config: ManualFramingConfig;
  targetRatio: TargetAspectRatio;
  onChange: (config: ManualFramingConfig) => void;
  previewWidth: number;
  player: VideoPlayer | null;
}

export function TargetPanel({
  config,
  targetRatio,
  onChange,
  previewWidth,
  player,
}: TargetPanelProps) {
  const dims = TARGET_DIMENSIONS[targetRatio];
  const aspect = dims.width / dims.height;
  const previewHeight = previewWidth / aspect;

  function updateOutput(
    regionId: string,
    patch: { x?: number; y?: number; width?: number; height?: number },
  ) {
    onChange({
      ...config,
      regions: config.regions.map((region) =>
        region.id === regionId ? { ...region, output: { ...region.output, ...patch } } : region,
      ),
    });
  }

  return (
    <View className="items-center">
      <Text className="mb-2 text-sm font-semibold text-foreground">
        Target preview ({targetRatio})
      </Text>
      <View
        style={{ width: previewWidth, height: previewHeight }}
        className="relative overflow-hidden rounded-lg bg-black"
        collapsable={false}
      >
        {player ? (
          <VideoView
            player={player}
            style={{ width: previewWidth, height: previewHeight }}
            nativeControls={false}
            contentFit="cover"
          />
        ) : null}

        {config.regions.map((region) => (
          <DraggableRegionFrame
            key={region.id}
            x={region.output.x}
            y={region.output.y}
            width={region.output.width}
            height={region.output.height}
            color={region.color}
            canvasWidth={previewWidth}
            canvasHeight={previewHeight}
            onMove={(x, y) => updateOutput(region.id, { x, y })}
            onResize={(width, height) => updateOutput(region.id, { width, height })}
          />
        ))}
      </View>
    </View>
  );
}
