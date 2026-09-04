import { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function TextEditorSheet({
  visible,
  initialValue = '',
  title = 'Add text',
  submitLabel = 'Add text',
  onClose,
  onAdd,
}: {
  visible: boolean;
  initialValue?: string;
  title?: string;
  submitLabel?: string;
  onClose: () => void;
  onAdd: (text: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    setText(visible ? initialValue : '');
  }, [initialValue, visible]);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => setKeyboardHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        className="flex-1 justify-end"
      >
        <Pressable className="flex-1 bg-black/70" onPress={onClose} />
        <View
          className="rounded-t-3xl border-t border-border bg-background px-4 pt-3"
          style={{
            paddingBottom: Math.max(insets.bottom, 16) + (Platform.OS === 'android' ? keyboardHeight : 0),
          }}
        >
          <View className="mb-5 h-1 w-10 self-center rounded-full bg-border" />
          <Text className="text-xl font-bold text-foreground">{title}</Text>
          <Text className="mb-5 mt-1 text-sm text-muted">
            Text appears at the playhead and can be timed on its timeline lane.
          </Text>
          <Input
            value={text}
            onChangeText={setText}
            placeholder="Enter text"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => {
              if (text.trim()) onAdd(text);
            }}
          />
          <View className="mt-3">
            <Button
              title={submitLabel}
              variant="accent"
              disabled={!text.trim()}
              onPress={() => onAdd(text)}
            />
          </View>
          <View className="mt-2">
            <Button title="Cancel" variant="ghost" onPress={onClose} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
