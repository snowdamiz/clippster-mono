import { View, type ViewProps } from 'react-native';
import { cn } from '@/lib/utils';
import { tokens } from '@/theme/tokens';

export function Card({ className, style, ...props }: ViewProps & { className?: string }) {
  return (
    <View
      className={cn('rounded-2xl bg-surface p-4', className)}
      style={[{ borderRadius: 16, backgroundColor: tokens.colors.surface, padding: 16 }, style]}
      {...props}
    />
  );
}
