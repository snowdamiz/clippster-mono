import { Text, View } from 'react-native';

interface TypingIndicatorProps {
  names: string[];
}

export function TypingIndicator({ names }: TypingIndicatorProps) {
  if (names.length === 0) return null;

  const label =
    names.length === 1
      ? `${names[0]} is typing…`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing…`
        : 'Several people are typing…';

  return (
    <View className="px-4 py-1">
      <Text className="text-xs text-muted">{label}</Text>
    </View>
  );
}
