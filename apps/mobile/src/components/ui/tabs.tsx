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

export function Tabs({ items, value, onChange, className }: TabsProps) {
  return (
    <View className={cn('flex-row rounded-lg border border-border bg-background p-1', className)}>
      {items.map((item) => {
        const active = item.key === value;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            className={cn('flex-1 rounded-md px-3 py-2', active && 'bg-surface')}
          >
            <Text className={cn('text-center text-sm font-medium', active ? 'text-foreground' : 'text-muted')}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
