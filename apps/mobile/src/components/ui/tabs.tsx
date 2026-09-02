import { View, Text, Pressable } from 'react-native';
import { cn } from '@/lib/utils';

interface TabItem {
  key: string;
  label: string;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}

// Active state mirrors the desktop sidebar/nav: cyan text on a cyan 10% tint.
export function Tabs({ items, value, onChange, className }: TabsProps) {
  return (
    <View className={cn('flex-row rounded-md border border-border bg-surface p-1', className)}>
      {items.map((item) => {
        const active = item.key === value;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            className={cn('flex-1 rounded-sm px-3 py-2', active && 'bg-accent/10')}
          >
            <Text className={cn('text-center text-sm font-medium', active ? 'text-accent' : 'text-muted')}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
