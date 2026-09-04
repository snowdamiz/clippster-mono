import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { tokens } from '@/theme/tokens';

export function EditorTopBar({
  title,
  canUndo,
  canRedo,
  saving,
  onClose,
  onUndo,
  onRedo,
  onExport,
}: {
  title: string;
  canUndo: boolean;
  canRedo: boolean;
  saving: boolean;
  onClose: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
}) {
  return (
    <View className="h-12 flex-row items-center gap-1 border-b border-border px-2 pr-14">
      <IconButton icon="close" label="Close editor" onPress={onClose} />
      <Text className="flex-1 px-1 text-sm font-semibold text-foreground" numberOfLines={1}>
        {title}
      </Text>
      {saving ? <Text className="px-1 text-[10px] text-muted">Saving…</Text> : null}
      <IconButton icon="arrow-undo-outline" label="Undo" disabled={!canUndo} onPress={onUndo} />
      <IconButton icon="arrow-redo-outline" label="Redo" disabled={!canRedo} onPress={onRedo} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Export"
        onPress={onExport}
        className="min-h-10 justify-center rounded-lg bg-accent px-3 active:opacity-70"
      >
        <Text className="text-sm font-semibold text-white">Export</Text>
      </Pressable>
    </View>
  );
}

function IconButton({
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
      className={`min-h-10 min-w-10 items-center justify-center ${disabled ? 'opacity-25' : 'active:opacity-60'}`}
    >
      <Ionicons name={icon} size={22} color={tokens.colors.foreground} />
    </Pressable>
  );
}
