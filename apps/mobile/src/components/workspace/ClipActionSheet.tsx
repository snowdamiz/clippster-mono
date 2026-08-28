import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, Text, View } from 'react-native';
import { tokens } from '@/theme/tokens';

interface ClipActionSheetProps {
  visible: boolean;
  clipName: string;
  onClose: () => void;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ClipActionSheet({
  visible,
  clipName,
  onClose,
  onOpen,
  onEdit,
  onDelete,
}: ClipActionSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/70" onPress={onClose}>
        <Pressable className="rounded-t-2xl border-t border-border bg-background px-4 pb-8 pt-4" onPress={() => {}}>
          <Text className="mb-1 text-lg font-semibold text-foreground" numberOfLines={1}>
            {clipName}
          </Text>
          <Text className="mb-4 text-xs text-muted">Clip actions</Text>
          <Pressable
            onPress={onOpen}
            className="flex-row items-center gap-3 rounded-lg px-2 py-3 active:bg-white/5"
          >
            <Ionicons name="cut-outline" size={20} color={tokens.colors.foreground} />
            <Text className="text-sm font-medium text-foreground">Adjust clip</Text>
          </Pressable>
          <Pressable
            onPress={onEdit}
            className="flex-row items-center gap-3 rounded-lg px-2 py-3 active:bg-white/5"
          >
            <Ionicons name="film-outline" size={20} color={tokens.colors.foreground} />
            <Text className="text-sm font-medium text-foreground">Edit clip</Text>
          </Pressable>
          <Pressable
            onPress={onDelete}
            className="flex-row items-center gap-3 rounded-lg px-2 py-3 active:bg-white/5"
          >
            <Ionicons name="trash-outline" size={20} color={tokens.colors.destructive} />
            <Text className="text-sm font-medium text-destructive">Delete clip</Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            className="mt-2 items-center rounded-lg border border-border py-3"
          >
            <Text className="text-sm font-semibold text-foreground">Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
