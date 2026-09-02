import { Modal, Pressable, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type DialogButtonStyle = 'default' | 'cancel' | 'destructive';

export interface DialogButton {
  text: string;
  style?: DialogButtonStyle;
  onPress?: () => void | Promise<void>;
}

interface DialogProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons: DialogButton[];
  onRequestClose: () => void;
  onButtonPress: (button: DialogButton) => void;
}

function buttonVariant(style: DialogButtonStyle | undefined): 'default' | 'outline' | 'destructive' {
  if (style === 'destructive') return 'destructive';
  if (style === 'cancel') return 'outline';
  return 'default';
}

export function Dialog({
  visible,
  title,
  message,
  buttons,
  onRequestClose,
  onButtonPress,
}: DialogProps) {
  const stacked = buttons.length > 2;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <Pressable
        className="flex-1 items-center justify-center bg-black/75 px-6"
        onPress={onRequestClose}
      >
        <Pressable
          className="w-full max-w-sm overflow-hidden rounded-xl border border-border bg-surface"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="h-[3px] bg-accent" />
          <View className="px-5 pb-2 pt-5">
            <Text className="text-lg font-semibold text-foreground">{title}</Text>
            {message ? (
              <Text className="mt-2 text-sm leading-5 text-muted">{message}</Text>
            ) : null}
          </View>
          <View
            className={cn(
              'gap-2 px-5 pb-5 pt-4',
              stacked ? 'flex-col' : 'flex-row justify-end',
            )}
          >
            {buttons.map((button, index) => (
              <Button
                key={`${button.text}-${index}`}
                title={button.text}
                variant={buttonVariant(button.style)}
                className={cn(stacked ? 'w-full' : 'min-w-[88px] px-4 py-2.5')}
                textClassName="text-sm"
                onPress={() => onButtonPress(button)}
              />
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
