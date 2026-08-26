import type { ClipTextBoxState } from '@clippster/shared-types';
import { createDefaultClipTextBoxState } from '@clippster/shared-types';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

interface TextBoxSheetProps {
  visible: boolean;
  state: ClipTextBoxState | null;
  clipDuration: number;
  onClose: () => void;
  onSave: (state: ClipTextBoxState | null) => void;
}

export function TextBoxSheet({
  visible,
  state,
  clipDuration,
  onClose,
  onSave,
}: TextBoxSheetProps) {
  const [draft, setDraft] = useState<ClipTextBoxState>(
    state ?? createDefaultClipTextBoxState(clipDuration),
  );

  if (!visible) return null;

  return (
    <View className="absolute inset-0 z-50 justify-end bg-black/70">
      <View className="max-h-[70%] rounded-t-2xl bg-background">
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Text className="text-lg font-semibold text-foreground">Text box</Text>
          <Pressable onPress={onClose}>
            <Text className="text-primary">Close</Text>
          </Pressable>
        </View>

        <ScrollView className="px-4 py-3">
          <Pressable
            onPress={() => setDraft((s) => ({ ...s, enabled: !s.enabled }))}
            className="mb-4 flex-row items-center justify-between rounded-lg bg-surface px-4 py-3"
          >
            <Text className="text-foreground">Show text box</Text>
            <Text className="text-primary">{draft.enabled ? 'On' : 'Off'}</Text>
          </Pressable>

          <Text className="mb-2 text-sm font-semibold text-foreground">Text</Text>
          <TextInput
            className="mb-3 rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
            value={draft.text}
            onChangeText={(text) => setDraft((s) => ({ ...s, text }))}
          />

          <Text className="mb-2 text-sm font-semibold text-foreground">
            Timing ({draft.startTime.toFixed(1)}s – {draft.endTime.toFixed(1)}s)
          </Text>
          <View className="mb-3 flex-row gap-2">
            <TextInput
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
              keyboardType="numeric"
              value={String(draft.startTime)}
              onChangeText={(v) =>
                setDraft((s) => ({ ...s, startTime: Number.parseFloat(v) || 0 }))
              }
              placeholder="Start"
            />
            <TextInput
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
              keyboardType="numeric"
              value={String(draft.endTime)}
              onChangeText={(v) =>
                setDraft((s) => ({ ...s, endTime: Number.parseFloat(v) || clipDuration }))
              }
              placeholder="End"
            />
          </View>

          <Text className="mb-2 text-sm font-semibold text-foreground">Background color</Text>
          <TextInput
            className="mb-3 rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
            value={draft.style.backgroundColor ?? '#FFFFFF'}
            onChangeText={(bg) =>
              setDraft((s) => ({ ...s, style: { ...s.style, backgroundColor: bg } }))
            }
          />
        </ScrollView>

        <View className="flex-row gap-2 border-t border-border px-4 py-3">
          <Pressable
            onPress={() => {
              onSave(null);
              onClose();
            }}
            className="flex-1 items-center rounded-lg border border-border py-3"
          >
            <Text className="text-foreground">Delete</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              onSave(draft);
              onClose();
            }}
            className="flex-1 items-center rounded-lg bg-primary py-3"
          >
            <Text className="font-semibold text-primary-foreground">Save</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
