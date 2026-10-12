import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as Badge } from './Badge.vue'

/**
 * Small status/label pill. Tone carries meaning — keep it semantic:
 * neutral (default), brand, success, warning, danger, ai, live.
 */
export const badgeVariants = cva(
  'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border font-medium leading-none [&_svg]:size-3 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        neutral: 'border-line bg-surface-hover text-fg-muted',
        brand: 'border-brand-line bg-brand-soft text-brand',
        success: 'border-[var(--success-line)] bg-success-soft text-success',
        warning: 'border-[var(--warning-line)] bg-warning-soft text-warning',
        danger: 'border-[var(--danger-line)] bg-danger-soft text-danger',
        ai: 'border-[var(--ai-line)] bg-ai-soft text-ai',
        live: 'border-transparent bg-live text-white uppercase tracking-[0.04em]',
        solid: 'border-transparent bg-fg text-[var(--fg-on-light)]',
        outline: 'border-line-strong bg-transparent text-fg-muted',
        /* shadcn aliases */
        default: 'border-transparent bg-fg text-[var(--fg-on-light)]',
        secondary: 'border-line bg-surface-hover text-fg-muted',
        destructive: 'border-[var(--danger-line)] bg-danger-soft text-danger',
      },
      size: {
        sm: 'h-[18px] px-1.5 text-2xs',
        md: 'h-5 px-2 text-xs',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'sm',
    },
  }
)

export type BadgeVariants = VariantProps<typeof badgeVariants>
