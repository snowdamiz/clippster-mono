import { Ionicons } from '@expo/vector-icons';
import type { ManualFramingConfig, ManualRegion } from '@clippster/shared-types';
import { createDefaultManualRegion, MAX_POI_REGIONS } from '@clippster/shared-types';
import type { VideoPlayer } from 'expo-video';
import { VideoView } from 'expo-video';
import { Pressable, Text, View } from 'react-native';
import { DraggableRegionFrame } from './DraggableRegionFrame';
import { appAlert } from '@/lib/appAlert';
import { getActiveFramingRegions, replaceActiveFramingRegions } from './framingRegions';
import { tokens } from '@/theme/tokens';

interface SourcePanelProps {
  config: ManualFramingConfig;
  onChange: (config: ManualFramingConfig) => void;
  canvasWidth: number;
  canvasHeight: number;
  player: VideoPlayer | null;
  currentTime: number;
  selectedRegionId: string | null;
  onSelectRegion: (regionId: string | null) => void;
}

export function SourcePanel({
  config,
  onChange,
  canvasWidth,
  canvasHeight,
  player,
  currentTime,
  selectedRegionId,
  onSelectRegion,
}: SourcePanelProps) {
  const { regions: activeRegions, segmentIndex } = getActiveFramingRegions(config, currentTime);
  const selectedRegion =
    activeRegions.find((region) => region.id === selectedRegionId) ?? null;

  function patchRegion(regionId: string, patch: Partial<ManualRegion>) {
    onChange(
      replaceActiveFramingRegions(
        config,
        segmentIndex,
        activeRegions.map((region) =>
          region.id === regionId ? { ...region, ...patch } : region,
        ),
      ),
    );
  }

  function updateRegion(
    regionId: string,
    patch: { x?: number; y?: number; width?: number; height?: number },
  ) {
    const region = activeRegions.find((item) => item.id === regionId);
    if (!region) return;
    patchRegion(regionId, { source: { ...region.source, ...patch } });
  }

  function addRegion() {
    if (activeRegions.length >= MAX_POI_REGIONS) {
      appAlert('Limit reached', `Maximum ${MAX_POI_REGIONS} regions.`);
      return;
    }
    const region = createDefaultManualRegion(activeRegions.length);
    region.aspectRatioLocked = false;
    onChange(replaceActiveFramingRegions(config, segmentIndex, [...activeRegions, region]));
    onSelectRegion(region.id);
  }

  function removeRegion(id: string) {
    onChange(
      replaceActiveFramingRegions(
        config,
        segmentIndex,
        activeRegions.filter((region) => region.id !== id),
      ),
    );
    if (selectedRegionId === id) onSelectRegion(null);
  }

  return (
    <View>
      <View className="mb-1.5 flex-row items-center gap-2 px-4">
        <Text className="mr-auto text-xs font-semibold text-foreground">Source regions</Text>
        {selectedRegion ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selectedRegion.aspectRatioLocked !== false }}
            onPress={() =>
              patchRegion(selectedRegion.id, {
                aspectRatioLocked: selectedRegion.aspectRatioLocked === false,
              })
            }
            className={`flex-row items-center gap-1 rounded-md border px-2 py-1 ${
              selectedRegion.aspectRatioLocked !== false
                ? 'border-emerald-400/40 bg-emerald-400/10'
                : 'border-amber-400/40 bg-amber-400/10'
            }`}
          >
            <Ionicons
              name={selectedRegion.aspectRatioLocked !== false ? 'lock-closed' : 'lock-open'}
              size={12}
              color={
                selectedRegion.aspectRatioLocked !== false
                  ? tokens.colors.success
                  : tokens.colors.warning
              }
            />
            <Text
              className={`text-[10px] font-semibold ${
                selectedRegion.aspectRatioLocked !== false
                  ? 'text-emerald-300'
                  : 'text-amber-300'
              }`}
            >
              {selectedRegion.aspectRatioLocked !== false ? 'Locked' : 'Free'}
            </Text>
          </Pressable>
        ) : null}
        <Pressable onPress={addRegion} className="rounded-md bg-accent px-2.5 py-1.5">
          <Text className="text-[10px] font-semibold text-white">+ Region</Text>
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
            surfaceType="textureView"
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-xs text-muted">Video unavailable</Text>
          </View>
        )}

        {activeRegions.map((region, index) => (
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
            onRemove={() => removeRegion(region.id)}
          />
        ))}
      </View>
    </View>
  );
}
