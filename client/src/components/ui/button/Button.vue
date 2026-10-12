<script setup lang="ts">
  import type { PrimitiveProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import type { ButtonVariants } from '.'
  import { Primitive } from 'reka-ui'
  import { Loader2 } from 'lucide-vue-next'
  import { cn } from '@/lib/utils'
  import { buttonVariants } from '.'

  interface Props extends PrimitiveProps {
    variant?: ButtonVariants['variant']
    size?: ButtonVariants['size']
    block?: boolean
    /** Shows a spinner in place of the leading icon and disables the button. */
    loading?: boolean
    disabled?: boolean
    class?: HTMLAttributes['class']
  }

  const props = withDefaults(defineProps<Props>(), {
    as: 'button',
  })
</script>

<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    :disabled="as === 'button' ? disabled || loading : undefined"
    :aria-disabled="as !== 'button' && (disabled || loading) ? true : undefined"
    :aria-busy="loading || undefined"
    :class="cn(buttonVariants({ variant, size, block }), props.class)"
  >
    <Loader2 v-if="loading" class="animate-spin" />
    <slot />
  </Primitive>
</template>
