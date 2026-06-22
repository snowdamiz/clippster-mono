import type { ActiveVodPresetConfig, ManualFramingConfig } from '@clippster/shared-types';
import {
  createDefaultManualFramingConfig,
  type TargetAspectRatio,
} from '@clippster/shared-types';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { POISegmentTimeline } from './POISegmentTimeline';
import { SourcePanel } from './SourcePanel';
import { TargetPanel } from './TargetPanel';

type Tab = 'source' | 'target';

interface FramingEditorProps {
  config: ActiveVodPresetConfig;
  clipDuration: number;
  currentTime: number;
  onSave: (config: ActiveVodPresetConfig) => Promise<void>;
  onSeek: (time: number) => void;
}

export function FramingEditor({
  config,
  clipDuration,
  currentTime,
  onSave,
  onSeek,
}: FramingEditorProps) {
  const [tab, setTab] = useState<Tab>('source');
  const [draft, setDraft] = useState<ActiveVodPresetConfig>(config);
  const [saving, setSaving] = useState(false);

  const framing = draft.framingConfig ?? createDefaultManualFramingConfig(draft.targetAspectRatio);
  const targetRatio = (draft.targetAspectRatio === '16:9' ? '16:9' : '9:16') as TargetAspectRatio;

  const updateFraming = useCallback(
    (next: ManualFramingConfig) => {
      setDraft((prev) => ({ ...prev, framingConfig: next }));
    },
    [],
  );

  const setRatio = (ratio: TargetAspectRatio) => {
    setDraft((prev) => ({
      ...prev,
      targetAspectRatio: ratio,
      framingConfig: {
        ...(prev.framingConfig ?? createDefaultManualFramingConfig(ratio)),
        targetAspectRatio: ratio,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView className="flex-1">
      <View className="flex-row items-center justify-center gap-2 px-4 py-3">
        {(['9:16', '16:9'] as const).map((ratio) => (
          <Pressable
            key={ratio}
            onPress={() => setRatio(ratio)}
            className={`rounded-full px-4 py-2 ${
              targetRatio === ratio ? 'bg-primary' : 'bg-surface'
            }`}
          >
            <Text className={targetRatio === ratio ? 'text-white' : 'text-foreground'}>
              {ratio}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="mb-3 flex-row border-b border-border">
        {(['source', 'target'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            className={`flex-1 items-center py-3 ${tab === t ? 'border-b-2 border-primary' : ''}`}
          >
            <Text className={tab === t ? 'font-semibold text-primary' : 'text-muted'}>
              {t === 'source' ? 'Source' : 'Target'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'source' ? (
        <SourcePanel
          config={framing}
          onChange={updateFraming}
          canvasWidth={340}
          canvasHeight={191}
        />
      ) : (
        <TargetPanel
          config={framing}
          targetRatio={targetRatio}
          onChange={updateFraming}
          previewWidth={targetRatio === '9:16' ? 200 : 320}
        />
      )}

      <POISegmentTimeline
        config={framing}
        clipDuration={clipDuration}
        currentTime={currentTime}
        onChange={updateFraming}
        onSeek={onSeek}
      />

      <View className="px-4 py-4">
        <Pressable
          onPress={() => void handleSave()}
          disabled={saving}
          className="items-center rounded-lg bg-primary py-3"
        >
          <Text className="font-semibold text-white">{saving ? 'Saving...' : 'Save framing'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
