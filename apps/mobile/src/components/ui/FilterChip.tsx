import { Pressable, Text } from 'react-native';
import { cn } from '@/lib/utils';

interface FilterChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  className?: string;
}

export function FilterChip({ label, selected, onPress, className }: FilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'min-h-11 justify-center rounded-xl px-3 py-2',
        selected ? 'bg-surfaceMuted' : 'bg-transparent',
        className,
      )}
    >
      <Text
        className={cn(
          'text-center text-sm font-medium',
          selected ? 'text-foreground' : 'text-muted',
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}
