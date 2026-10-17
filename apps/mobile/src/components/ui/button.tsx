import { Pressable, Text, type PressableProps } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { tokens } from '@/theme/tokens';

// default = near-white like desktop .dark; accent = cyan brand CTA; outline = translucent surface.
const buttonVariants = cva(
  'min-h-12 flex-row items-center justify-center rounded-xl px-4 py-3',
  {
    variants: {
      variant: {
        default: 'bg-primary',
        accent: 'bg-accent',
        outline: 'border border-border bg-white/5',
        ghost: 'bg-transparent',
        google: 'border border-border bg-white/5',
        destructive: 'bg-destructive',
      },
      disabled: {
        true: 'opacity-50',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      disabled: false,
    },
  },
);

const textVariants = cva('text-sm font-semibold', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      accent: 'text-white',
      outline: 'text-foreground',
      ghost: 'text-foreground',
      google: 'text-foreground',
      destructive: 'text-white',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

type ButtonProps = PressableProps &
  VariantProps<typeof buttonVariants> & {
    title: string;
    className?: string;
    textClassName?: string;
  };

export function Button({
  title,
  variant = 'default',
  disabled,
  className,
  textClassName,
  style,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      className={cn(buttonVariants({ variant, disabled: !!disabled }), className)}
      style={(state) => [{
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: variant === 'accent' ? tokens.colors.accent :
          variant === 'default' ? tokens.colors.primary :
          variant === 'destructive' ? tokens.colors.destructive :
          variant === 'ghost' ? 'transparent' : tokens.colors.surfaceMuted,
        borderWidth: variant === 'outline' || variant === 'google' ? 1 : 0,
        borderColor: tokens.colors.border,
        opacity: disabled ? 0.55 : state.pressed ? 0.8 : 1,
      }, typeof style === 'function' ? style(state) : style]}
      disabled={disabled}
      {...props}
    >
      <Text className={cn(textVariants({ variant }), textClassName)} style={{
        color: variant === 'accent' ? tokens.colors.primaryForeground : variant === 'destructive' ? '#fff' :
          variant === 'default' ? tokens.colors.primaryForeground : tokens.colors.foreground,
        fontSize: 14,
        fontWeight: '600',
      }}>{title}</Text>
    </Pressable>
  );
}
