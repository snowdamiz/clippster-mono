import { Pressable, Text, View } from 'react-native';

import type { CanvasRatio } from '../model/schema';

export function CanvasControls({
  activeRatio,
  safeAreaVisible,
  onRatioChange,
  onToggleSafeArea,
}: {
  activeRatio: CanvasRatio;
  safeAreaVisible: boolean;
  onRatioChange: (ratio: CanvasRatio) => void;
  onToggleSafeArea: () => void;
}) {
  return (
    <View className="absolute right-2 top-2 z-20 flex-row gap-1">
      {(['9:16', '16:9'] as const).map((ratio) => (
        <Pressable
          key={ratio}
          accessibilityRole="button"
          accessibilityLabel={`Use ${ratio} canvas`}
          onPress={() => onRatioChange(ratio)}
          className={`min-h-9 justify-center rounded-full px-3 ${
            activeRatio === ratio ? 'bg-primary' : 'bg-black/70'
          }`}
        >
          <Text
            className={`text-xs font-semibold ${
              activeRatio === ratio ? 'text-primary-foreground' : 'text-foreground'
            }`}
          >
            {ratio}
          </Text>
        </Pressable>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Toggle platform safe area"
        onPress={onToggleSafeArea}
        className={`min-h-9 justify-center rounded-full px-3 ${
          safeAreaVisible ? 'bg-accent' : 'bg-black/70'
        }`}
      >
        <Text className="text-xs font-semibold text-foreground">Safe</Text>
      </Pressable>
    </View>
  );
}
