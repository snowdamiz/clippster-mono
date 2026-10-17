import { View } from 'react-native';
import { cn } from '@/lib/utils';
import { tokens } from '@/theme/tokens';

export function Separator({ className }: { className?: string }) {
  return <View className={cn('h-px w-full bg-border', className)} style={{ height: 1, width: '100%', backgroundColor: tokens.colors.border }} />;
}
