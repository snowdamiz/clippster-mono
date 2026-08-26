import { Pressable, Text, View } from 'react-native';
import { cn } from '@/lib/utils';

interface TagSelectProps {
  label: string;
  options: readonly { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}

export function TagSelect({ label, options, selected, onChange }: TagSelectProps) {
  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option.value);
          return (
            <Pressable
              key={option.value}
              onPress={() => toggle(option.value)}
              className={cn(
                'rounded-full border px-3 py-1.5',
                active ? 'border-primary bg-primary/20' : 'border-border bg-surface',
              )}
            >
              <Text className={cn('text-sm', active ? 'text-primary' : 'text-foreground')}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
