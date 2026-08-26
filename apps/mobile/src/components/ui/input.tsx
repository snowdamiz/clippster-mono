import { TextInput, type TextInputProps } from 'react-native';
import { cn } from '@/lib/utils';
import { tokens } from '@/theme/tokens';

// Mirrors the desktop client's form inputs: translucent fill, #1f1f23 border, 8px radius.
export function Input({ className, ...props }: TextInputProps & { className?: string }) {
  return (
    <TextInput
      placeholderTextColor={tokens.colors.muted}
      className={cn(
        'rounded-md border border-border bg-white/5 px-4 py-3 text-sm text-foreground',
        className,
      )}
      {...props}
    />
  );
}
