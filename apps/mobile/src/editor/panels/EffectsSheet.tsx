import {
  CLIP_EFFECT_PRESETS,
  type ClipEffect,
  type ClipEffectType,
} from '@clippster/clip-export';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { SeekBar } from '@/components/ui/seek-bar';

export type EffectsSheetMode = 'filters' | 'effects' | 'adjust';

const SUPPORTED_STYLE = new Set<ClipEffectType>([
  'vignette',
  'grain',
  'mirror',
  'letterbox',
  'blur',
  'sharpen',
  'glitch',
]);

function presetsForMode(mode: EffectsSheetMode) {
  // LUT is intentionally absent from CLIP_EFFECT_PRESETS until provenance ships.
  return CLIP_EFFECT_PRESETS.filter((preset) => {
    if (mode === 'filters') return preset.category === 'color';
    if (mode === 'adjust') return preset.category === 'adjust';
    return preset.category === 'style' && SUPPORTED_STYLE.has(preset.type);
  });
}

function titleForMode(mode: EffectsSheetMode): string {
  if (mode === 'filters') return 'Filters';
  if (mode === 'adjust') return 'Adjust';
  return 'Effects';
}

function defaultIntensity(mode: EffectsSheetMode, type: ClipEffectType | null): number {
  if (!type) return mode === 'adjust' ? 50 : 70;
  if (mode === 'adjust') return 50;
  return 70;
}

export function EffectsSheet({
  visible,
  initialEffect,
  onClose,
  onApply,
  mode = 'filters',
}: {
  visible: boolean;
  initialEffect?: ClipEffect;
  onClose: () => void;
  onApply: (effect: ClipEffect | null) => void;
  mode?: EffectsSheetMode;
}) {
  const presets = presetsForMode(mode);
  const [type, setType] = useState<ClipEffectType | null>(initialEffect?.type ?? null);
  const [intensity, setIntensity] = useState(
    initialEffect?.intensity ?? defaultIntensity(mode, initialEffect?.type ?? null),
  );

  useEffect(() => {
    if (!visible) return;
    const nextType = initialEffect?.type ?? null;
    setType(nextType);
    setIntensity(initialEffect?.intensity ?? defaultIntensity(mode, nextType));
  }, [initialEffect, mode, visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/70" onPress={onClose}>
        <Pressable
          className="rounded-t-3xl border-t border-border bg-background px-4 pb-8 pt-3"
          onPress={() => {}}
        >
          <View className="mb-4 h-1 w-10 self-center rounded-full bg-border" />
          <Text className="text-xl font-bold text-foreground">{titleForMode(mode)}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 py-4"
          >
            <EffectOption label="None" selected={!type} onPress={() => setType(null)} />
            {presets.map((preset) => (
              <EffectOption
                key={preset.type}
                label={preset.label}
                selected={type === preset.type}
                onPress={() => {
                  setType(preset.type);
                  if (mode === 'adjust' && type !== preset.type) setIntensity(50);
                }}
              />
            ))}
          </ScrollView>
          <View className="mb-1 flex-row justify-between">
            <Text className="text-sm text-muted">
              {mode === 'adjust' ? 'Amount (50 = neutral)' : 'Intensity'}
            </Text>
            <Text className="text-sm font-semibold text-foreground">{Math.round(intensity)}%</Text>
          </View>
          <SeekBar
            minimumValue={0}
            maximumValue={100}
            step={1}
            value={intensity}
            onValueChange={setIntensity}
          />
          <View className="mt-3">
            <Button
              title={`Apply ${titleForMode(mode).toLowerCase()}`}
              variant="accent"
              onPress={() => onApply(type ? { type, intensity } : null)}
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

function EffectOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`h-16 min-w-20 items-center justify-center rounded-xl border px-3 ${
        selected ? 'border-accent bg-accent/20' : 'border-border bg-surface'
      }`}
    >
      <Text className="text-sm font-semibold text-foreground">{label}</Text>
    </Pressable>
  );
}
