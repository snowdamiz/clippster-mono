import { View, type ViewProps } from 'react-native';
import { cn } from '@/lib/utils';

export function Card({ className, style, ...props }: ViewProps & { className?: string }) {
  return (
    <View
      className={cn('rounded-[18px] bg-surface p-4', className)}
      style={style}
      {...props}
    />
  );
}
