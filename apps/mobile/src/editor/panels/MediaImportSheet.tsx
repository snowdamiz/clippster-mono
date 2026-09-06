import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, Text, View } from 'react-native';

import { tokens } from '@/theme/tokens';

type MediaKind = 'video' | 'image' | 'audio';

const OPTIONS: {
  kind: MediaKind;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    kind: 'video',
    title: 'Add video',
    description: 'Choose a video for the primary timeline',
    icon: 'videocam-outline',
  },
  {
    kind: 'image',
    title: 'Add image',
    description: 'Place an image overlay at the playhead',
    icon: 'image-outline',
  },
  {
    kind: 'audio',
    title: 'Add audio',
    description: 'Add music, sound, or voice audio',
    icon: 'musical-notes-outline',
  },
];

export function MediaImportSheet({
  visible,
  busy,
  onClose,
  onSelect,
  allowedKinds = ['video', 'image', 'audio'],
}: {
  visible: boolean;
  busy: boolean;
  onClose: () => void;
  onSelect: (kind: MediaKind) => void;
  allowedKinds?: MediaKind[];
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/70" onPress={onClose}>
        <Pressable
          className="rounded-t-3xl border-t border-border bg-background px-4 pb-8 pt-3"
          onPress={() => {}}
        >
          <View className="mb-5 h-1 w-10 self-center rounded-full bg-border" />
          <Text className="text-xl font-bold text-foreground">Add media</Text>
          <Text className="mb-4 mt-1 text-sm text-muted">
            Import media from this device into the timeline.
          </Text>
          {OPTIONS.filter((option) => allowedKinds.includes(option.kind)).map((option) => (
            <Pressable
              key={option.kind}
              accessibilityRole="button"
              accessibilityLabel={option.title}
              disabled={busy}
              onPress={() => onSelect(option.kind)}
              className="mb-2 min-h-16 flex-row items-center gap-4 rounded-xl border border-border bg-surface px-4 active:bg-white/5"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-accent/15">
                <Ionicons name={option.icon} size={22} color={tokens.colors.accent} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">
                  {busy ? 'Opening…' : option.title}
                </Text>
                <Text className="text-xs text-muted">{option.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={tokens.colors.muted} />
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            disabled={busy}
            onPress={onClose}
            className="mt-2 min-h-12 items-center justify-center"
          >
            <Text className="text-sm font-semibold text-foreground">Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export type { MediaKind };
