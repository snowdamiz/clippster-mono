import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ReactNativeUploadFile } from '@clippster/api-client';
import { tokens } from '@/theme/tokens';

interface MessageComposerProps {
  disabled?: boolean;
  sending?: boolean;
  onSend: (content: string, attachmentData?: unknown[]) => Promise<void>;
  onTyping?: () => void;
  onPickImages?: (files: ReactNativeUploadFile[]) => Promise<unknown[]>;
  editingContent?: string | null;
  onCancelEdit?: () => void;
}

export function MessageComposer({
  disabled,
  sending,
  onSend,
  onTyping,
  onPickImages,
  editingContent = null,
  onCancelEdit,
}: MessageComposerProps) {
  const isEditing = editingContent != null;
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const lastTypingRef = useRef(0);

  useEffect(() => {
    if (editingContent != null) {
      setText(editingContent);
    } else {
      setText('');
    }
  }, [editingContent]);

  const handleChange = (value: string) => {
    setText(value);
    const now = Date.now();
    if (onTyping && !isEditing && now - lastTypingRef.current > 1500) {
      lastTypingRef.current = now;
      onTyping();
    }
  };

  const handleSend = async () => {
    const content = text.trim();
    if (!content) return;
    if (disabled || sending || uploading) return;
    if (!isEditing) setText('');
    await onSend(content);
  };

  const handleAttach = async () => {
    if (!onPickImages || disabled || sending || uploading || isEditing) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 4,
    });
    if (result.canceled || result.assets.length === 0) return;

    const files: ReactNativeUploadFile[] = result.assets.map((asset, index) => ({
      uri: asset.uri,
      name: asset.fileName || `image-${Date.now()}-${index}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    }));

    setUploading(true);
    try {
      const attachments = await onPickImages(files);
      const caption = text.trim();
      setText('');
      await onSend(caption || ' ', attachments);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View className="border-t border-border bg-background px-3 pb-2 pt-2">
      {isEditing ? (
        <View className="mb-2 flex-row items-center justify-between rounded-lg bg-accent/10 px-3 py-1.5">
          <View className="flex-row items-center gap-2">
            <Ionicons name="pencil" size={14} color={tokens.colors.accent} />
            <Text className="text-xs text-accent">Editing message</Text>
          </View>
          <Pressable onPress={onCancelEdit} className="p-1">
            <Ionicons name="close" size={18} color={tokens.colors.muted} />
          </Pressable>
        </View>
      ) : null}

      <View className="flex-row items-end gap-2">
        {onPickImages && !isEditing ? (
          <Pressable
            onPress={() => void handleAttach()}
            disabled={disabled || sending || uploading}
            className="mb-1 h-10 w-10 items-center justify-center rounded-full bg-surfaceMuted"
          >
            {uploading ? (
              <ActivityIndicator size="small" color={tokens.colors.accent} />
            ) : (
              <Ionicons name="image-outline" size={20} color={tokens.colors.accent} />
            )}
          </Pressable>
        ) : null}

        <TextInput
          value={text}
          onChangeText={handleChange}
          placeholder={isEditing ? 'Edit message' : 'Message'}
          placeholderTextColor={tokens.colors.muted}
          multiline
          className="max-h-28 min-h-[40px] flex-1 rounded-2xl border border-border bg-white/5 px-4 py-2.5 text-[15px] text-foreground"
          editable={!disabled && !sending}
        />

        <Pressable
          onPress={() => void handleSend()}
          disabled={disabled || sending || uploading || !text.trim()}
          className={`mb-1 h-10 w-10 items-center justify-center rounded-full ${
            text.trim() ? 'bg-accent' : 'bg-surfaceMuted'
          }`}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons
              name={isEditing ? 'checkmark' : 'send'}
              size={18}
              color={text.trim() ? '#fff' : tokens.colors.muted}
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}
