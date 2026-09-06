import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { SeekBar } from '@/components/ui/seek-bar';

export interface PropertySliderConfig {
  title: string;
  value: number;
  minimumValue: number;
  maximumValue: number;
  step: number;
  formatValue: (value: number) => string;
  apply: (value: number) => void;
}

export function PropertySliderSheet({
  config,
  onClose,
}: {
  config: PropertySliderConfig | null;
  onClose: () => void;
}) {
  const [value, setValue] = useState(config?.value ?? 0);

  useEffect(() => {
    if (config) setValue(config.value);
  }, [config]);

  return (
    <Modal visible={Boolean(config)} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/70" onPress={onClose}>
        <Pressable
          className="rounded-t-3xl border-t border-border bg-background px-5 pb-8 pt-3"
          onPress={() => {}}
        >
          <View className="mb-5 h-1 w-10 self-center rounded-full bg-border" />
          <Text className="text-xl font-bold text-foreground">{config?.title}</Text>
          <Text className="mb-4 mt-2 text-center text-2xl font-semibold text-accent">
            {config?.formatValue(value)}
          </Text>
          {config ? (
            <SeekBar
              minimumValue={config.minimumValue}
              maximumValue={config.maximumValue}
              step={config.step}
              value={value}
              onValueChange={setValue}
            />
          ) : null}
          <View className="mt-4">
            <Button
              title="Apply"
              variant="accent"
              onPress={() => {
                config?.apply(value);
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
