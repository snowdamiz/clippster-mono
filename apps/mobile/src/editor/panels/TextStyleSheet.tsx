import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { SeekBar } from '@/components/ui/seek-bar';
import type { TextStyle } from '../model/schema';

const COLORS = ['#FFFFFF', '#FACC15', '#22D3EE', '#EF4444', '#F97316', '#A855F7'];
const ANIMATIONS = ['none', 'fade', 'pop', 'bounce', 'slide'] as const;

export function TextStyleSheet({
  visible,
  initialStyle,
  initialAnimation,
  onClose,
  onApply,
}: {
  visible: boolean;
  initialStyle?: TextStyle;
  initialAnimation?: string;
  onClose: () => void;
  onApply: (style: TextStyle, animation?: string) => void;
}) {
  const [style, setStyle] = useState<TextStyle | undefined>(initialStyle);
  const [animation, setAnimation] = useState(initialAnimation ?? 'none');

  useEffect(() => {
    if (!visible) return;
    setStyle(initialStyle);
    setAnimation(initialAnimation ?? 'none');
  }, [initialAnimation, initialStyle, visible]);

  if (!style) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/70" onPress={onClose}>
        <Pressable
          className="rounded-t-3xl border-t border-border bg-background px-4 pb-8 pt-3"
          onPress={() => {}}
        >
          <View className="mb-5 h-1 w-10 self-center rounded-full bg-border" />
          <Text className="text-xl font-bold text-foreground">Text style</Text>
          <Text className="mb-2 mt-4 text-sm text-muted">Color</Text>
          <View className="flex-row gap-3">
            {COLORS.map((color) => (
              <Pressable
                key={color}
                onPress={() => setStyle((current) => current ? { ...current, color } : current)}
                className={`h-10 w-10 rounded-full border-2 ${
                  style.color === color ? 'border-white' : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </View>
          <View className="mt-5 flex-row justify-between">
            <Text className="text-sm text-muted">Size</Text>
            <Text className="text-sm font-semibold text-foreground">{Math.round(style.fontSize)}</Text>
          </View>
          <SeekBar
            minimumValue={18}
            maximumValue={96}
            step={1}
            value={style.fontSize}
            onValueChange={(fontSize) =>
              setStyle((current) => current ? { ...current, fontSize } : current)
            }
          />
          <Text className="mb-2 mt-3 text-sm text-muted">Animation</Text>
          <View className="flex-row gap-2">
            {ANIMATIONS.map((option) => (
              <Pressable
                key={option}
                onPress={() => setAnimation(option)}
                className={`min-h-11 flex-1 items-center justify-center rounded-lg border ${
                  animation === option ? 'border-accent bg-accent/20' : 'border-border bg-surface'
                }`}
              >
                <Text className="text-xs capitalize text-foreground">{option}</Text>
              </Pressable>
            ))}
          </View>
          <View className="mt-5">
            <Button
              title="Apply style"
              variant="accent"
              onPress={() => {
                onApply(style, animation === 'none' ? undefined : animation);
                onClose();
              }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
