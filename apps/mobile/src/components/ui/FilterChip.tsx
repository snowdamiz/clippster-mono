import { Pressable, Text } from 'react-native';
import { cn } from '@/lib/utils';

interface FilterChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  className?: string;
}

/** Selection chip matching Home/Accounts accent styling. */
export function FilterChip({ label, selected, onPress, className }: FilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'rounded-lg border px-3 py-2',
        selected ? 'border-accent bg-accent/10' : 'border-border bg-surface',
        className,
      )}
    >
      <Text
        className={cn(
          'text-center text-sm font-medium',
          selected ? 'text-accent' : 'text-foreground',
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}
