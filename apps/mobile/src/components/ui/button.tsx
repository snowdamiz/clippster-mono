import { Pressable, Text, type PressableProps } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// default = near-white like desktop .dark; accent = cyan brand CTA; outline = translucent surface.
const buttonVariants = cva(
  'flex-row items-center justify-center rounded-md px-4 py-3',
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
  variant,
  disabled,
  className,
  textClassName,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      className={cn(buttonVariants({ variant, disabled: !!disabled }), className)}
      disabled={disabled}
      {...props}
    >
      <Text className={cn(textVariants({ variant }), textClassName)}>{title}</Text>
    </Pressable>
  );
}
