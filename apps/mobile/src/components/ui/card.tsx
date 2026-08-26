import { View, type ViewProps } from 'react-native';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: ViewProps & { className?: string }) {
  return (
    <View
      className={cn('rounded-xl border border-border bg-surface p-6', className)}
      {...props}
    />
  );
}
