import {
  createDefaultManualFramingConfig,
  type ActiveVodPresetConfig,
  type ManualFramingConfig,
} from '@clippster/shared-types';
import type { VideoPlayer } from 'expo-video';
import { useCallback, useState } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { Tabs } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { appAlert } from '@/lib/appAlert';
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
  const [tab, setTab] = useState<'source' | 'output'>('source');
  const [saving, setSaving] = useState(false);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(
    config.framingConfig?.regions[0]?.id ?? null,
  );

  const framing = draft.framingConfig ?? createDefaultManualFramingConfig('9:16');
  const targetRatio = '9:16' as const;
  const sourceWidth = Math.min(windowWidth - 40, 480);
  const targetWidth = Math.min(230, windowWidth - 80);

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
    } catch (error) {
      appAlert('Could not save framing', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1">
      <View className="px-5 py-3"><Tabs items={[{key:'source',label:'Source'},{key:'output',label:'Output'}]} value={tab} onChange={(value) => setTab(value as 'source' | 'output')} /></View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-[17px] pb-6">
        {tab === 'source' ? <>
          <SourcePanel config={framing} onChange={updateFraming} canvasWidth={sourceWidth} canvasHeight={sourceWidth / (16 / 9)} player={player} currentTime={currentTime} selectedRegionId={selectedRegionId} onSelectRegion={setSelectedRegionId} />
          <Text className="px-5 text-sm leading-[21px] text-muted">Select and move source regions. Each region maps to a layer in the output. Drag the corner handles to resize.</Text>
        </> : <>
          <TargetPanel config={framing} targetRatio={targetRatio} onChange={updateFraming} previewWidth={targetWidth} videoPath={videoPath} currentTime={currentTime} videoTime={videoTime} playing={playing} selectedRegionId={selectedRegionId} onSelectRegion={setSelectedRegionId} />
          <Text className="px-5 text-sm leading-[21px] text-muted">Drag each layer to position it in the portrait output. Select a layer to resize it.</Text>
        </>}
        <VideoPlayerControls player={player} currentTime={currentTime} duration={duration} playing={playing} onTogglePlay={onTogglePlay} onSeek={onSeek} />
      </ScrollView>
      <View className="gap-3 border-t border-border px-5 py-4">
        <Text className="text-xs text-muted">{framing.regions.length > 0 || framing.sourceFrameMode === 'use16x9' ? 'Framing ready · 9:16' : 'Add a region or enable Use 16:9 in Output'}</Text>
        {tab === 'source' ? <Button title="Arrange output" onPress={() => setTab('output')} /> : null}
        <Button title={saving ? 'Saving…' : 'Save framing'} variant={tab === 'source' ? 'outline' : 'accent'} disabled={saving} onPress={() => void handleSave()} />
      </View>
    </View>
  );
}
