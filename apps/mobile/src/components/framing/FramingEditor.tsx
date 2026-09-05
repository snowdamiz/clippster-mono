import {
  createDefaultManualFramingConfig,
  type ActiveVodPresetConfig,
  type ManualFramingConfig,
} from '@clippster/shared-types';
import type { VideoPlayer } from 'expo-video';
import { useCallback, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { VideoPlayerControls } from '@/components/editor/VideoPlayerControls';
import { SourcePanel } from './SourcePanel';
import { TargetPanel } from './TargetPanel';

interface FramingEditorProps {
  config: ActiveVodPresetConfig;
  currentTime: number;
  videoTime: number;
  player: VideoPlayer | null;
  videoPath: string;
  duration: number;
  playing: boolean;
  onSeek: (seconds: number) => void;
  onTogglePlay: () => void;
  onSave: (config: ActiveVodPresetConfig) => Promise<void>;
}

export function FramingEditor({
  config,
  currentTime,
  videoTime,
  player,
  videoPath,
  duration,
  playing,
  onSeek,
  onTogglePlay,
  onSave,
}: FramingEditorProps) {
  const { width: windowWidth } = useWindowDimensions();
  const [draft, setDraft] = useState<ActiveVodPresetConfig>(() => ({
    ...config,
    targetAspectRatio: '9:16',
    framingConfig: {
      ...(config.framingConfig ?? createDefaultManualFramingConfig('9:16')),
      targetAspectRatio: '9:16',
    },
  }));
  const [saving, setSaving] = useState(false);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(
    config.framingConfig?.regions[0]?.id ?? null,
  );

  const framing = draft.framingConfig ?? createDefaultManualFramingConfig('9:16');
  const targetRatio = '9:16' as const;
  const sourceWidth = Math.min(windowWidth - 32, 340);
  const targetWidth = Math.min(148, (windowWidth - 48) * 0.42);

  const updateFraming = useCallback(
    (next: ManualFramingConfig) => {
      setDraft((prev) => ({ ...prev, framingConfig: next }));
    },
    [],
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1">
      <VideoPlayerControls
        player={player}
        currentTime={currentTime}
        duration={duration}
        playing={playing}
        onTogglePlay={onTogglePlay}
        onSeek={onSeek}
      />

      <View className="flex-1 justify-between py-2">
        <View className="border-b border-border pb-2">
          <View className="mb-1 flex-row items-center gap-2 px-4">
            <View className="h-5 w-5 items-center justify-center rounded-full bg-accent">
              <Text className="text-[10px] font-bold text-white">1</Text>
            </View>
            <Text className="text-xs font-semibold uppercase tracking-wide text-muted">
              Choose the source crop
            </Text>
          </View>
        <SourcePanel
          config={framing}
          onChange={updateFraming}
          canvasWidth={sourceWidth}
          canvasHeight={sourceWidth / (16 / 9)}
          player={player}
          currentTime={currentTime}
          selectedRegionId={selectedRegionId}
          onSelectRegion={setSelectedRegionId}
        />
        </View>

        <View className="pt-1">
          <View className="mb-1 flex-row items-center gap-2 px-4">
            <View className="h-5 w-5 items-center justify-center rounded-full bg-accent">
              <Text className="text-[10px] font-bold text-white">2</Text>
            </View>
            <Text className="text-xs font-semibold uppercase tracking-wide text-muted">
              Arrange the {targetRatio} output
            </Text>
          </View>
        <TargetPanel
          config={framing}
          targetRatio={targetRatio}
          onChange={updateFraming}
          previewWidth={targetWidth}
          videoPath={videoPath}
          currentTime={currentTime}
          videoTime={videoTime}
          playing={playing}
          selectedRegionId={selectedRegionId}
          onSelectRegion={setSelectedRegionId}
        />
        </View>
      </View>

      <View className="border-t border-border bg-surface px-4 py-3">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-xs font-medium text-foreground">
            {framing.regions.length > 0 || framing.sourceFrameMode === 'use16x9'
              ? 'Framing ready'
              : 'Add a region or enable Use 16:9'}
          </Text>
          <Text className="text-[10px] font-semibold text-accent">{targetRatio}</Text>
        </View>
          <Pressable
            onPress={() => void handleSave()}
            disabled={saving}
          className="items-center rounded-xl bg-accent py-3"
          >
            <Text className="font-semibold text-white">
              {saving ? 'Saving...' : 'Save framing'}
            </Text>
          </Pressable>
      </View>
    </View>
  );
}
