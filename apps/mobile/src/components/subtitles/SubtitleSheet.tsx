import type { SubtitleSettings } from '@clippster/shared-types';
import { createDefaultSubtitleSettings } from '@clippster/shared-types';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { CAPTION_PRESETS, settingsFromPresetId } from '@/lib/captionPresets';

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

  if (!visible) return null;

  return (
    <View className="absolute inset-0 z-50 justify-end bg-black/70">
      <View className="max-h-[70%] rounded-t-2xl bg-background">
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Text className="text-lg font-semibold text-foreground">Subtitles</Text>
          <Pressable onPress={onClose}>
            <Text className="text-primary">Close</Text>
          </Pressable>
        </View>

        <ScrollView className="px-4 py-3">
          {!hasTranscript ? (
            <Text className="mb-3 text-sm text-amber-500">
              Transcribe the project first to enable subtitles.
            </Text>
          ) : null}

          <Pressable
            onPress={() => setEnabled((v) => !v)}
            className="mb-4 flex-row items-center justify-between rounded-lg bg-surface px-4 py-3"
          >
            <Text className="text-foreground">Enable subtitles</Text>
            <Text className="text-primary">{enabled ? 'On' : 'Off'}</Text>
          </Pressable>

          <Text className="mb-2 text-sm font-semibold text-foreground">Preset</Text>
          {CAPTION_PRESETS.map((preset) => (
            <Pressable
              key={preset.id}
              onPress={() => setDraft(settingsFromPresetId(preset.id))}
              className={`mb-2 rounded-lg border px-3 py-3 ${
                draft.selectedPresetId === preset.id ? 'border-primary bg-primary/10' : 'border-border'
              }`}
            >
              <Text className="font-medium text-foreground">{preset.name}</Text>
              <Text className="text-xs text-muted">{preset.description}</Text>
            </Pressable>
          ))}

          <Text className="mb-2 mt-4 text-sm font-semibold text-foreground">Position (%)</Text>
          <TextInput
            className="mb-3 rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
            keyboardType="numeric"
            value={String(draft.positionPercentage)}
            onChangeText={(v) =>
              setDraft((s) => ({ ...s, positionPercentage: Number.parseFloat(v) || 85 }))
            }
          />

          <Text className="mb-2 text-sm font-semibold text-foreground">Font size</Text>
          <TextInput
            className="mb-3 rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
            keyboardType="numeric"
            value={String(draft.fontSize)}
            onChangeText={(v) => setDraft((s) => ({ ...s, fontSize: Number.parseInt(v, 10) || 48 }))}
          />
        </ScrollView>

        <View className="border-t border-border px-4 py-3">
          <Pressable
            onPress={() => {
              onSave(enabled && hasTranscript, draft.selectedPresetId ?? 'tiktok-bold', {
                ...draft,
                enabled: enabled && hasTranscript,
              });
              onClose();
            }}
            className="items-center rounded-lg bg-primary py-3"
          >
            <Text className="font-semibold text-primary-foreground">Save subtitles</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
