import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { SeekBar } from '@/components/ui/seek-bar';
import type { TransitionKind } from '../model/schema';

const TRANSITIONS: { kind: TransitionKind; label: string }[] = [
  { kind: 'cut', label: 'Cut' },
  { kind: 'fade', label: 'Fade' },
  { kind: 'dissolve', label: 'Dissolve' },
  { kind: 'wipe', label: 'Wipe' },
];

export function TransitionSheet({
  visible,
  initialKind,
  initialDurationSeconds,
  onClose,
  onApply,
}: {
  visible: boolean;
  initialKind: TransitionKind;
  initialDurationSeconds: number;
  onClose: () => void;
  onApply: (kind: TransitionKind, durationSeconds: number) => void;
}) {
  const [kind, setKind] = useState(initialKind);
  const [duration, setDuration] = useState(initialDurationSeconds);

  useEffect(() => {
    if (!visible) return;
    setKind(initialKind);
    setDuration(initialDurationSeconds);
  }, [initialDurationSeconds, initialKind, visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/70" onPress={onClose}>
        <Pressable
          className="rounded-t-3xl border-t border-border bg-background px-4 pb-8 pt-3"
          onPress={() => {}}
        >
          <View className="mb-5 h-1 w-10 self-center rounded-full bg-border" />
          <Text className="text-xl font-bold text-foreground">Transition</Text>
          <View className="my-4 flex-row gap-2">
            {TRANSITIONS.map((option) => (
              <Pressable
                key={option.kind}
                onPress={() => setKind(option.kind)}
                className={`min-h-12 flex-1 items-center justify-center rounded-xl border ${
                  kind === option.kind ? 'border-accent bg-accent/20' : 'border-border bg-surface'
                }`}
              >
                <Text className="text-xs font-semibold text-foreground">{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <View className="flex-row justify-between">
            <Text className="text-sm text-muted">Duration</Text>
            <Text className="text-sm font-semibold text-foreground">
              {kind === 'cut' ? 'Instant' : `${duration.toFixed(1)}s`}
            </Text>
          </View>
          <SeekBar
            minimumValue={0.1}
            maximumValue={1.5}
            step={0.1}
            value={duration}
            onValueChange={setDuration}
          />
          <View className="mt-3">
            <Button
              title="Apply transition"
              variant="accent"
              onPress={() => {
                onApply(kind, kind === 'cut' ? 0 : duration);
                onClose();
              }}
            />
          </View>
          <View className="mt-2">
            <Button title="Cancel" variant="ghost" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
