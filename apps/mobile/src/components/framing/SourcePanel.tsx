import type { ManualFramingConfig, ManualRegion } from '@clippster/shared-types';
import { createDefaultManualRegion, MAX_POI_REGIONS } from '@clippster/shared-types';
import { Canvas, Group, RoundedRect } from '@shopify/react-native-skia';
import { useCallback } from 'react';
import { Alert, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

interface SourcePanelProps {
  config: ManualFramingConfig;
  onChange: (config: ManualFramingConfig) => void;
  canvasWidth: number;
  canvasHeight: number;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function SourcePanel({ config, onChange, canvasWidth, canvasHeight }: SourcePanelProps) {
  const updateRegion = useCallback(
    (regionId: string, patch: Partial<ManualRegion['source']>) => {
      onChange({
        ...config,
        regions: config.regions.map((r) =>
          r.id === regionId ? { ...r, source: { ...r.source, ...patch } } : r,
        ),
      });
    },
    [config, onChange],
  );

  const addRegion = () => {
    if (config.regions.length >= MAX_POI_REGIONS) {
      Alert.alert('Limit reached', `Maximum ${MAX_POI_REGIONS} regions.`);
      return;
    }
    onChange({
      ...config,
      regions: [...config.regions, createDefaultManualRegion(config.regions.length)],
    });
  };

  const removeRegion = (id: string) => {
    onChange({ ...config, regions: config.regions.filter((r) => r.id !== id) });
  };

  return (
    <View>
      <View className="mb-2 flex-row items-center justify-between px-4">
        <Text className="text-sm font-semibold text-foreground">Source regions</Text>
        <Pressable onPress={addRegion} className="rounded bg-primary px-3 py-1">
          <Text className="text-xs text-white">Add region</Text>
        </Pressable>
      </View>

      <View
        style={{ width: canvasWidth, height: canvasHeight, alignSelf: 'center' }}
        className="relative overflow-hidden rounded-lg bg-black"
      >
        <Canvas style={{ width: canvasWidth, height: canvasHeight }}>
          <Group>
            {config.regions.map((region) => (
              <RoundedRect
                key={region.id}
                x={region.source.x * canvasWidth}
                y={region.source.y * canvasHeight}
                width={region.source.width * canvasWidth}
                height={region.source.height * canvasHeight}
                r={4}
                color={`${region.color}66`}
              />
            ))}
          </Group>
        </Canvas>

        {config.regions.map((region) => {
          const left = region.source.x * canvasWidth;
          const top = region.source.y * canvasHeight;
          const w = region.source.width * canvasWidth;
          const h = region.source.height * canvasHeight;

          const pan = PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderMove: (_, gs) => {
              updateRegion(region.id, {
                x: clamp01(region.source.x + gs.dx / canvasWidth),
                y: clamp01(region.source.y + gs.dy / canvasHeight),
              });
            },
          });

          const resizePan = PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderMove: (_, gs) => {
              updateRegion(region.id, {
                width: clamp01(region.source.width + gs.dx / canvasWidth),
                height: clamp01(region.source.height + gs.dy / canvasHeight),
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
              <Pressable
                onPress={() => removeRegion(region.id)}
                style={{ position: 'absolute', left: left + w - 20, top: top - 8 }}
                className="h-5 w-5 items-center justify-center rounded-full bg-red-500"
              >
                <Text className="text-[10px] text-white">×</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}
