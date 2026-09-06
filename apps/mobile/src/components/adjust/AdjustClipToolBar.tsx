import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { CLIP_ADJUST_CONTEXT_SECONDS, canExtendBuffer } from '@/lib/clipAdjust';
import { tokens } from '@/theme/tokens';

export function AdjustClipToolBar({
  bufferStart,
  bufferEnd,
  selectStart,
  selectEnd,
  mediaDuration,
  dirty,
  onExtend,
  onReset,
}: {
  bufferStart: number;
  bufferEnd: number;
  selectStart: number;
  selectEnd: number;
  mediaDuration: number;
  dirty: boolean;
  onExtend: (edge: 'start' | 'end') => void;
  onReset: () => void;
}) {
  const canLeft =
    selectStart <= bufferStart + 0.08 &&
    canExtendBuffer('start', bufferStart, bufferEnd, mediaDuration);
  const canRight =
    selectEnd >= bufferEnd - 0.08 &&
    canExtendBuffer('end', bufferStart, bufferEnd, mediaDuration);

  return (
    <View className="border-t border-white/10 bg-black px-2 py-2">
      <View className="flex-row items-center justify-center gap-2">
        <ToolButton
          icon="arrow-back-circle-outline"
          label={`−${CLIP_ADJUST_CONTEXT_SECONDS}s`}
          disabled={!canLeft}
          onPress={() => onExtend('start')}
        />
        <ToolButton
          icon="refresh-outline"
          label="Reset"
          disabled={!dirty}
          onPress={onReset}
        />
        <ToolButton
          icon="arrow-forward-circle-outline"
          label={`+${CLIP_ADJUST_CONTEXT_SECONDS}s`}
          disabled={!canRight}
          onPress={() => onExtend('end')}
        />
      </View>
    </View>
  );
}

function ToolButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      className={`h-10 min-w-[88px] flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-[#202023] px-2 ${
        disabled ? 'opacity-30' : 'active:opacity-60'
      }`}
    >
      <Ionicons name={icon} size={18} color={tokens.colors.foreground} />
      <Text className="text-xs text-muted">{label}</Text>
    </Pressable>
  );
}
