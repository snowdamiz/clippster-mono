import type { ManualFramingConfig, ManualRegion } from '@clippster/shared-types';
import { TARGET_DIMENSIONS, type TargetAspectRatio } from '@clippster/shared-types';
import { Canvas, Group, RoundedRect } from '@shopify/react-native-skia';
import { useCallback } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

interface TargetPanelProps {
  config: ManualFramingConfig;
  targetRatio: TargetAspectRatio;
  onChange: (config: ManualFramingConfig) => void;
  previewWidth: number;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function TargetPanel({ config, targetRatio, onChange, previewWidth }: TargetPanelProps) {
  const dims = TARGET_DIMENSIONS[targetRatio];
  const aspect = dims.width / dims.height;
  const previewHeight = previewWidth / aspect;

  const updateOutput = useCallback(
    (regionId: string, patch: Partial<ManualRegion['output']>) => {
      onChange({
        ...config,
        regions: config.regions.map((r) =>
          r.id === regionId ? { ...r, output: { ...r.output, ...patch } } : r,
        ),
      });
    },
    [config, onChange],
  );

  return (
    <View className="items-center">
      <Text className="mb-2 text-sm font-semibold text-foreground">
        Target preview ({targetRatio})
      </Text>
      <View
        style={{ width: previewWidth, height: previewHeight }}
        className="relative overflow-hidden rounded-lg bg-black"
      >
        <Canvas style={{ width: previewWidth, height: previewHeight }}>
          <Group>
            {config.regions.map((region) => (
              <RoundedRect
                key={region.id}
                x={region.output.x * previewWidth}
                y={region.output.y * previewHeight}
                width={region.output.width * previewWidth}
                height={region.output.height * previewHeight}
                r={region.cornerRadiusEnabled ? 8 : 2}
                color={`${region.color}99`}
              />
            ))}
          </Group>
        </Canvas>

        {config.regions.map((region) => {
          const left = region.output.x * previewWidth;
          const top = region.output.y * previewHeight;
          const w = region.output.width * previewWidth;
          const h = region.output.height * previewHeight;

          const pan = PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderMove: (_, gs) => {
              updateOutput(region.id, {
                x: clamp01(region.output.x + gs.dx / previewWidth),
                y: clamp01(region.output.y + gs.dy / previewHeight),
              });
            },
          });

          const resizePan = PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderMove: (_, gs) => {
              updateOutput(region.id, {
                width: clamp01(region.output.width + gs.dx / previewWidth),
                height: clamp01(region.output.height + gs.dy / previewHeight),
              });
            },
          });

          return (
            <View key={region.id} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
              <View
                {...pan.panHandlers}
                style={{ position: 'absolute', left, top, width: w, height: h }}
              />
              <View
                {...resizePan.panHandlers}
                style={{
                  position: 'absolute',
                  left: left + w - 22,
                  top: top + h - 22,
                  width: 44,
                  height: 44,
                }}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}
