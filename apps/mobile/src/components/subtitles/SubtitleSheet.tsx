import type { SubtitleSettings } from '@clippster/shared-types';
import { createDefaultSubtitleSettings } from '@clippster/shared-types';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { CaptionStylePanel } from '@/components/subtitles/CaptionStylePanel';

interface SubtitleSheetProps {
  visible: boolean;
  settings: SubtitleSettings | null;
  hasTranscript: boolean;
  onClose: () => void;
  onSave: (enabled: boolean, presetId: string, settings: SubtitleSettings) => void;
}

export function SubtitleSheet({
  visible,
  settings,
  hasTranscript,
  onClose,
  onSave,
}: SubtitleSheetProps) {
  const [draft, setDraft] = useState<SubtitleSettings>(
    settings ?? createDefaultSubtitleSettings(),
  );
  const [enabled, setEnabled] = useState(settings?.enabled ?? false);

  useEffect(() => {
    if (!visible) return;
    setDraft(settings ?? createDefaultSubtitleSettings());
    setEnabled(settings?.enabled ?? false);
  }, [visible, settings]);

  if (!visible) return null;

  const presetId = draft.selectedPresetId ?? 'tiktok-bold';

  return (
    <View className="absolute inset-0 z-50 justify-end bg-black/70">
      <View className="max-h-[80%] rounded-t-2xl bg-background">
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Text className="text-lg font-semibold text-foreground">Captions</Text>
          <Pressable onPress={onClose}>
            <Text className="text-primary">Close</Text>
          </Pressable>
        </View>

        {!hasTranscript ? (
          <Text className="px-4 pt-3 text-sm text-amber-500">
            Transcribe first for timed captions. Styles still apply to sample text in the editor.
          </Text>
        ) : null}

        <ScrollView className="pt-2">
          <CaptionStylePanel
            enabled={enabled}
            presetId={presetId}
            settings={draft}
            onChange={(next) => {
              setEnabled(next.enabled);
              setDraft(next.settings);
            }}
          />
        </ScrollView>

        <View className="border-t border-border px-4 py-3">
          <Pressable
            onPress={() => {
              const next = {
                ...draft,
                enabled: enabled && hasTranscript,
                selectedPresetId: draft.selectedPresetId ?? presetId,
              };
              onSave(next.enabled, next.selectedPresetId ?? 'tiktok-bold', next);
              onClose();
            }}
            className="items-center rounded-lg bg-primary py-3"
          >
            <Text className="font-semibold text-primary-foreground">Save captions</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
