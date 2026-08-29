import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { ClipSpeed, TransitionKind } from '@/lib/timeline/editDocument';
import { tokens } from '@/theme/tokens';

interface EditorToolDockProps {
  canUndo: boolean;
  canRedo: boolean;
  canSplit: boolean;
  canDelete: boolean;
  selectedVideo: boolean;
  muted: boolean;
  speed: ClipSpeed;
  transition: TransitionKind | null;
  onUndo: () => void;
  onRedo: () => void;
  onSplit: () => void;
  onDelete: () => void;
  onCaptions: () => void;
  onEffects: () => void;
  hasEffect: boolean;
  onAdd: () => void;
  onMute: () => void;
  onSpeed: (speed: ClipSpeed) => void;
  onCycleTransition: () => void;
}

const SPEEDS: ClipSpeed[] = [0.5, 1, 1.5, 2];

function ToolButton({
  icon,
  label,
  disabled,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  disabled?: boolean;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`w-14 items-center gap-1 py-2 ${disabled ? 'opacity-30' : 'active:opacity-70'}`}
    >
      <Ionicons name={icon} size={20} color={active ? tokens.colors.accent : tokens.colors.foreground} />
      <Text className={`text-[10px] ${active ? 'text-accent' : 'text-muted'}`}>{label}</Text>
    </Pressable>
  );
}

export function EditorToolDock({
  canUndo,
  canRedo,
  canSplit,
  canDelete,
  selectedVideo,
  muted,
  speed,
  transition,
  onUndo,
  onRedo,
  onSplit,
  onDelete,
  onCaptions,
  onEffects,
  hasEffect,
  onAdd,
  onMute,
  onSpeed,
  onCycleTransition,
}: EditorToolDockProps) {
  return (
    <View className="border-t border-border bg-background px-1 pb-2 pt-1">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="items-center">
        <ToolButton icon="add-circle-outline" label="Add" onPress={onAdd} />
        <ToolButton icon="arrow-undo-outline" label="Undo" disabled={!canUndo} onPress={onUndo} />
        <ToolButton icon="arrow-redo-outline" label="Redo" disabled={!canRedo} onPress={onRedo} />
        <ToolButton icon="cut-outline" label="Split" disabled={!canSplit} onPress={onSplit} />
        <ToolButton icon="trash-outline" label="Delete" disabled={!canDelete} onPress={onDelete} />
        <ToolButton icon="chatbubble-ellipses-outline" label="Captions" onPress={onCaptions} />
        <ToolButton icon="color-filter-outline" label="Effects" active={hasEffect} onPress={onEffects} />
        <ToolButton
          icon={muted ? 'volume-mute-outline' : 'volume-high-outline'}
          label={muted ? 'Unmute' : 'Mute'}
          disabled={!selectedVideo}
          active={muted}
          onPress={onMute}
        />
        {transition != null ? (
          <ToolButton
            icon="sparkles-outline"
            label={transition === 'none' ? 'Cut' : transition}
            onPress={onCycleTransition}
          />
        ) : null}
      </ScrollView>
      {selectedVideo ? (
        <View className="mt-1 flex-row items-center justify-center gap-2">
          {SPEEDS.map((value) => (
            <Pressable
              key={value}
              onPress={() => onSpeed(value)}
              className={`rounded-full px-3 py-1 ${speed === value ? 'bg-primary' : 'bg-surface'}`}
            >
              <Text
                className={`text-xs font-semibold ${
                  speed === value ? 'text-primary-foreground' : 'text-muted'
                }`}
              >
                {value}x
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
