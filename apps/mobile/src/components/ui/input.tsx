import { TextInput, type TextInputProps } from 'react-native';
import { cn } from '@/lib/utils';
import { tokens } from '@/theme/tokens';

export function Input({ className, style, ...props }: TextInputProps & { className?: string }) {
  return (
    <TextInput
      placeholderTextColor={tokens.colors.muted}
      style={[{
        minHeight: 48,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: tokens.colors.border,
        backgroundColor: tokens.colors.surface,
        paddingHorizontal: 16,
        paddingVertical: 12,
        color: tokens.colors.foreground,
        fontSize: 16,
      }, style]}
      className={cn(
        'min-h-12 rounded-xl border border-border bg-surface px-4 py-3 text-base text-foreground',
        className,
      )}
      {...props}
    />
  );
}
