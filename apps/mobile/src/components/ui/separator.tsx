import { View } from 'react-native';
import { cn } from '@/lib/utils';

export function Separator({ className }: { className?: string }) {
  return <View className={cn('h-px w-full bg-border', className)} />;
}
