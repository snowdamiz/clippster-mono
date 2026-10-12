<script setup lang="ts">
  import type { CheckboxRootEmits, CheckboxRootProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { reactiveOmit } from '@vueuse/core'
  import { Check } from 'lucide-vue-next'
  import { CheckboxIndicator, CheckboxRoot, useForwardPropsEmits } from 'reka-ui'
  import { cn } from '@/lib/utils'

  const props = defineProps<CheckboxRootProps & { class?: HTMLAttributes['class'] }>()
  const emits = defineEmits<CheckboxRootEmits>()

  const delegatedProps = reactiveOmit(props, 'class')

  const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <CheckboxRoot
    v-bind="forwarded"
    :class="
      cn(
        'grid place-content-center peer size-4 shrink-0 rounded-[4px] border border-line-strong bg-surface-raised transition-colors focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-brand-fg',
        props.class
      )
    "
  >
    <CheckboxIndicator class="grid place-content-center text-current">
      <slot><Check class="h-4 w-4" /></slot>
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
