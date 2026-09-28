import { Text, type TextProps } from 'react-native';
import { cn } from '@/lib/utils';
import { tokens } from '@/theme/tokens';

export function Label({ className, style, ...props }: TextProps) {
  return (
    <Text
      className={cn('text-sm font-medium text-foreground', className)}
      style={[{ color: tokens.colors.foreground, fontSize: 14, fontWeight: '500' }, style]}
      {...props}
    />
  );
}
