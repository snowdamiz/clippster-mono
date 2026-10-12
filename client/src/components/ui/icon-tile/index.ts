import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as IconTile } from './IconTile.vue'

/** Rounded square that frames an icon — used by modals, empty states, stats and list rows. */
export const iconTileVariants = cva('inline-grid shrink-0 place-items-center border [&_svg]:shrink-0', {
  variants: {
    tone: {
      neutral: 'border-line bg-surface-hover text-fg-muted',
      brand: 'border-brand-line bg-brand-soft text-brand',
      success: 'border-[var(--success-line)] bg-success-soft text-success',
      warning: 'border-[var(--warning-line)] bg-warning-soft text-warning',
      danger: 'border-[var(--danger-line)] bg-danger-soft text-danger',
      ai: 'border-[var(--ai-line)] bg-ai-soft text-ai',
    },
    size: {
      sm: 'size-6 rounded-md [&_svg]:size-3.5',
      md: 'size-8 rounded-lg [&_svg]:size-4',
      lg: 'size-10 rounded-[10px] [&_svg]:size-5',
      xl: 'size-12 rounded-xl [&_svg]:size-6',
    },
  },
  defaultVariants: {
    tone: 'neutral',
    size: 'md',
  },
})

export type IconTileVariants = VariantProps<typeof iconTileVariants>
