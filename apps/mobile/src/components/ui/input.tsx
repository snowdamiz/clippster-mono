import { TextInput, type TextInputProps } from 'react-native';
import { cn } from '@/lib/utils';

export function Input({ className, ...props }: TextInputProps & { className?: string }) {
  return (
    <TextInput
      placeholderTextColor="#71717a"
      className={cn(
        'rounded-lg border border-border bg-surface px-4 py-3 text-base text-foreground',
        className,
      )}
      {...props}
    />
  );
}
