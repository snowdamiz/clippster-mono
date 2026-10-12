import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as Alert } from './Alert.vue'
export { default as AlertDescription } from './AlertDescription.vue'
export { default as AlertTitle } from './AlertTitle.vue'

export const alertVariants = cva(
  'relative w-full rounded-[var(--radius-card)] border px-3.5 py-3 text-sm [&>svg+div]:translate-y-[-2px] [&>svg]:absolute [&>svg]:left-3.5 [&>svg]:top-3.5 [&>svg]:size-4 [&>svg~*]:pl-6',
  {
    variants: {
      variant: {
        default: 'border-line bg-surface text-fg [&>svg]:text-fg-muted',
        info: 'border-brand-line bg-brand-soft text-fg [&>svg]:text-brand',
        success: 'border-[var(--success-line)] bg-success-soft text-fg [&>svg]:text-success',
        warning: 'border-[var(--warning-line)] bg-warning-soft text-fg [&>svg]:text-warning',
        destructive: 'border-[var(--danger-line)] bg-danger-soft text-fg [&>svg]:text-danger',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export type AlertVariants = VariantProps<typeof alertVariants>
