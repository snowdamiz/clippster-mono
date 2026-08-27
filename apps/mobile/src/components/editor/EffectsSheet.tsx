import type { ClipEffect, ClipEffectType } from '@clippster/clip-export';
import { CLIP_EFFECT_PRESETS } from '@clippster/clip-export';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { tokens } from '@/theme/tokens';

const ICONS: Record<ClipEffectType, keyof typeof Ionicons.glyphMap> = {
  grayscale: 'contrast-outline',
  sepia: 'sunny-outline',
  negative: 'swap-vertical-outline',
  warm: 'flame-outline',
  cool: 'snow-outline',
  vignette: 'ellipse-outline',
  grain: 'aperture-outline',
  blur: 'water-outline',
  sharpen: 'diamond-outline',
  letterbox: 'tablet-landscape-outline',
  glitch: 'pulse-outline',
  mirror: 'phone-landscape-outline',
};

interface EffectsSheetProps {
  visible: boolean;
  effect?: ClipEffect | null;
  disabled?: boolean;
  onClose: () => void;
  onChange: (effect: ClipEffect | null) => void;
}

export function EffectsSheet({ visible, effect, disabled, onClose, onChange }: EffectsSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/70" onPress={onClose}>
        <Pressable className="rounded-t-2xl border-t border-border bg-background" onPress={() => {}}>
          <View className="flex-row items-center justify-between px-4 pt-4">
            <View>
              <Text className="text-lg font-semibold text-foreground">Effects</Text>
              <Text className="text-xs text-muted">
                {disabled ? 'Select a clip first' : 'Applies to the selected clip'}
              </Text>
            </View>
            <Pressable onPress={onClose} className="p-2">
              <Ionicons name="close" size={22} color={tokens.colors.muted} />
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4 py-4">
            <EffectTile
              label="None"
              icon="close-circle-outline"
              selected={!effect}
              disabled={disabled}
              onPress={() => onChange(null)}
            />
            {CLIP_EFFECT_PRESETS.map((preset) => (
              <EffectTile
                key={preset.type}
                label={preset.label}
                icon={ICONS[preset.type]}
                selected={effect?.type === preset.type}
                disabled={disabled}
                onPress={() =>
                  onChange(
                    effect?.type === preset.type
                      ? null
                      : { type: preset.type, intensity: effect?.intensity ?? 70 },
                  )
                }
              />
            ))}
          </ScrollView>

          {effect ? (
            <View className="px-4 pb-6">
              <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Intensity {Math.round(effect.intensity)}
              </Text>
              <View className="flex-row gap-2">
                {[30, 50, 70, 100].map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => onChange({ ...effect, intensity: value })}
                    className={`flex-1 rounded-full py-2 ${effect.intensity === value ? 'bg-primary' : 'bg-surface'}`}
                  >
                    <Text
                      className={`text-center text-xs font-semibold ${
                        effect.intensity === value ? 'text-primary-foreground' : 'text-muted'
                      }`}
                    >
                      {value}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <View className="h-4" />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function EffectTile({
  label,
  icon,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`w-20 items-center gap-2 rounded-xl border px-2 py-3 ${
        selected ? 'border-accent bg-surface' : 'border-border bg-surfaceMuted'
      } ${disabled ? 'opacity-40' : ''}`}
    >
      <Ionicons name={icon} size={22} color={selected ? tokens.colors.accent : tokens.colors.foreground} />
      <Text className={`text-[11px] font-medium ${selected ? 'text-accent' : 'text-foreground'}`}>{label}</Text>
    </Pressable>
  );
}
