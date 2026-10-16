import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as Button } from './Button.vue'

/**
 * The one button style for the app. Use <Button> where possible; for elements
 * that must stay native (router-link, label, etc.) bind
 * `:class="buttonVariants({ variant, size })"`.
 */
export const buttonVariants = cva(
  [
    'relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap select-none',
    'rounded-[var(--radius-control)] font-medium leading-none',
    'transition-[background-color,border-color,color,box-shadow,opacity] duration-150',
    'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
    'disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        /** Main call to action — at most one per view. */
        primary: 'bg-[var(--primary-bg)] text-[var(--fg-on-light)] hover:bg-[var(--primary-bg-hover)] shadow-[var(--shadow-sm)]',
        /** Brand-tinted emphasis, for toggled/active or AI-forward actions. */
        brand: 'bg-brand text-brand-fg hover:bg-brand-hover',
        /** Default for most actions. */
        secondary: 'bg-surface-raised text-fg border border-line hover:bg-[#20242c] hover:border-line-strong',
        /** Low-emphasis actions in toolbars and lists. */
        ghost: 'text-fg-muted hover:text-fg hover:bg-surface-hover',
        /** Subtle filled, for in-card actions. */
        subtle: 'bg-surface-hover text-fg hover:bg-surface-active',
        outline: 'border border-line-strong text-fg hover:bg-surface-hover',
        destructive: 'bg-danger-solid text-white hover:bg-[#dc3a3a]',
        'destructive-soft': 'bg-danger-soft text-danger hover:bg-[rgba(248,113,113,0.18)]',
        link: 'text-brand hover:text-brand-hover underline-offset-4 hover:underline px-0 h-auto',
        /** Same as `primary` (the shadcn default). */
        default: 'bg-[var(--primary-bg)] text-[var(--fg-on-light)] hover:bg-[var(--primary-bg-hover)] shadow-[var(--shadow-sm)]',
      },
      size: {
        xs: 'h-[var(--control-xs)] px-2 text-xs rounded-md [&_svg]:size-3.5',
        sm: 'h-[var(--control-sm)] px-2.5 text-xs [&_svg]:size-3.5',
        md: 'h-[var(--control-md)] px-3 text-sm [&_svg]:size-4',
        lg: 'h-[var(--control-lg)] px-4 text-sm [&_svg]:size-4',
        xl: 'h-10 px-5 text-base [&_svg]:size-4',
        'icon-xs': 'size-[var(--control-xs)] rounded-md [&_svg]:size-3.5',
        'icon-sm': 'size-[var(--control-sm)] [&_svg]:size-4',
        icon: 'size-[var(--control-md)] [&_svg]:size-4',
        'icon-lg': 'size-[var(--control-lg)] [&_svg]:size-[18px]',
        /** Legacy alias of `md`. */
        default: 'h-[var(--control-md)] px-3 text-sm [&_svg]:size-4',
      },
      block: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

export type ButtonVariants = VariantProps<typeof buttonVariants>
