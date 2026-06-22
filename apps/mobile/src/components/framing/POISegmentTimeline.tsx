import type { ManualFramingConfig, SegmentRegionConfig } from '@clippster/shared-types';
import { createDefaultManualRegion } from '@clippster/shared-types';
import { Pressable, Text, View } from 'react-native';

interface POISegmentTimelineProps {
  config: ManualFramingConfig;
  clipDuration: number;
  currentTime: number;
  onChange: (config: ManualFramingConfig) => void;
  onSeek: (time: number) => void;
}

export function POISegmentTimeline({
  config,
  clipDuration,
  currentTime,
  onChange,
  onSeek,
}: POISegmentTimelineProps) {
  const segmentConfigs = config.segmentConfigs ?? [];

  const addSegment = () => {
    const id = `seg-${Date.now()}`;
    const start = segmentConfigs.length > 0 ? segmentConfigs[segmentConfigs.length - 1].endTime : 0;
    const end = Math.min(clipDuration, start + clipDuration / 3);
    const newSeg: SegmentRegionConfig = {
      segmentId: id,
      startTime: start,
      endTime: end,
      regions: config.regions.map((r) => ({ ...r, id: `${r.id}-${id}` })),
    };
    onChange({ ...config, segmentConfigs: [...segmentConfigs, newSeg] });
  };

  const deleteSegment = (segmentId: string) => {
    onChange({
      ...config,
      segmentConfigs: segmentConfigs.filter((s) => s.segmentId !== segmentId),
    });
  };

  const activeSegment = segmentConfigs.find(
    (s) => currentTime >= s.startTime && currentTime < s.endTime,
  );

  return (
    <View className="px-4 py-3">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-foreground">Time segments</Text>
        <Pressable onPress={addSegment} className="rounded bg-primary px-3 py-1">
          <Text className="text-xs text-white">Add</Text>
        </Pressable>
      </View>

      <View className="relative mb-2 h-8 rounded bg-surface">
        {segmentConfigs.map((seg) => {
          const left = (seg.startTime / clipDuration) * 100;
          const width = ((seg.endTime - seg.startTime) / clipDuration) * 100;
          const isActive = activeSegment?.segmentId === seg.segmentId;
          return (
            <Pressable
              key={seg.segmentId}
              onPress={() => onSeek(seg.startTime)}
              onLongPress={() => deleteSegment(seg.segmentId)}
              style={{
                position: 'absolute',
                left: `${left}%`,
                width: `${width}%`,
                top: 4,
                bottom: 4,
              }}
              className={`rounded ${isActive ? 'bg-primary' : 'bg-primary/40'}`}
            />
          );
        })}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: `${(currentTime / clipDuration) * 100}%`,
            top: 0,
            bottom: 0,
            width: 2,
            backgroundColor: '#ef4444',
          }}
        />
      </View>

      {activeSegment ? (
        <Text className="text-xs text-muted">
          Active: {activeSegment.startTime.toFixed(1)}s – {activeSegment.endTime.toFixed(1)}s (
          {activeSegment.regions.length} regions)
        </Text>
      ) : (
        <Text className="text-xs text-muted">Using default regions</Text>
      )}

      {activeSegment ? (
        <Pressable
          className="mt-2 rounded border border-border px-3 py-2"
          onPress={() => {
            const updated = segmentConfigs.map((s) =>
              s.segmentId === activeSegment.segmentId
                ? {
                    ...s,
                    regions: [
                      ...s.regions,
                      createDefaultManualRegion(s.regions.length),
                    ],
                  }
                : s,
            );
            onChange({ ...config, segmentConfigs: updated });
          }}
        >
          <Text className="text-xs text-primary">Add region to active segment</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
