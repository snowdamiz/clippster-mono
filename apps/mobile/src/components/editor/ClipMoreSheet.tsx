import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, Text, View } from 'react-native';
import { tokens } from '@/theme/tokens';

export type EditorToolId =
  | 'edit'
  | 'framing'
  | 'subtitles'
  | 'text'
  | 'ratio-9-16'
  | 'ratio-16-9'
  | 'transcribe';

interface ClipMoreSheetProps {
  visible: boolean;
  activeRatio: '9:16' | '16:9';
  hasTranscript: boolean;
  aiBusy: boolean;
  onClose: () => void;
  onToolPress: (tool: EditorToolId) => void;
}

const TOOLS: Array<{ id: EditorToolId; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'edit', label: 'Edit', icon: 'film-outline' },
  { id: 'transcribe', label: 'Transcribe', icon: 'mic-outline' },
  { id: 'framing', label: 'Framing', icon: 'crop-outline' },
  { id: 'subtitles', label: 'Captions', icon: 'chatbubble-ellipses-outline' },
  { id: 'text', label: 'Text overlay', icon: 'text-outline' },
];

export function ClipMoreSheet({
  visible,
  activeRatio,
  hasTranscript,
  aiBusy,
  onClose,
  onToolPress,
}: ClipMoreSheetProps) {
  function handlePress(tool: EditorToolId) {
    onToolPress(tool);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/70" onPress={onClose}>
        <Pressable className="rounded-t-2xl border-t border-border bg-background px-4 pb-8 pt-4" onPress={() => {}}>
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-foreground">Clip options</Text>
            <Pressable onPress={onClose} className="p-2">
              <Ionicons name="close" size={22} color={tokens.colors.muted} />
            </Pressable>
          </View>

          <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Preview ratio</Text>
          <View className="mb-4 flex-row gap-2">
            {(['9:16', '16:9'] as const).map((ratio) => (
              <Pressable
                key={ratio}
                onPress={() => handlePress(ratio === '9:16' ? 'ratio-9-16' : 'ratio-16-9')}
                className={`flex-1 items-center rounded-lg py-2.5 ${
                  activeRatio === ratio ? 'bg-primary' : 'border border-border bg-surface'
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    activeRatio === ratio ? 'text-primary-foreground' : 'text-foreground'
                  }`}
                >
                  {ratio}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Tools</Text>
          <View className="gap-1">
            {TOOLS.map((tool) => {
              if (tool.id === 'transcribe' && hasTranscript) return null;
              const disabled = aiBusy || (tool.id === 'transcribe' && hasTranscript);
              return (
                <Pressable
                  key={tool.id}
                  onPress={() => handlePress(tool.id)}
                  disabled={disabled}
                  className={`flex-row items-center gap-3 rounded-lg px-3 py-3 ${
                    disabled ? 'opacity-40' : 'active:bg-white/5'
                  }`}
                >
                  <Ionicons name={tool.icon} size={22} color={tokens.colors.foreground} />
                  <Text className="text-sm font-medium text-foreground">{tool.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
