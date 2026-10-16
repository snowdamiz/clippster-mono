<script setup lang="ts">
  import type { DialogContentEmits, DialogContentProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { reactiveOmit } from '@vueuse/core'
  import { X } from 'lucide-vue-next'
  import { DialogClose, DialogContent, DialogOverlay, DialogPortal, useForwardPropsEmits } from 'reka-ui'
  import { cn } from '@/lib/utils'

  const props = defineProps<DialogContentProps & { class?: HTMLAttributes['class'] }>()
  const emits = defineEmits<DialogContentEmits>()

  const delegatedProps = reactiveOmit(props, 'class')

  const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      class="fixed inset-0 top-[var(--titlebar-height)] z-[10040] grid place-items-center overflow-y-auto bg-[var(--overlay)] backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    >
      <DialogContent
        :class="
          cn(
            'relative z-[10040] my-8 grid w-[calc(100vw-2rem)] max-w-lg gap-4 rounded-[var(--radius-modal)] bg-surface-raised p-5 text-fg shadow-[var(--shadow-lg)] duration-150',
            props.class
          )
        "
        v-bind="forwarded"
        @pointer-down-outside="
          (event) => {
            const originalEvent = event.detail.originalEvent
            const target = originalEvent.target as HTMLElement
            if (originalEvent.offsetX > target.clientWidth || originalEvent.offsetY > target.clientHeight) {
              event.preventDefault()
            }
          }
        "
      >
        <slot />
        <DialogClose class="absolute right-3 top-3 grid size-7 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg">
          <X class="w-4 h-4" />
          <span class="sr-only">Close</span>
        </DialogClose>
      </DialogContent>
    </DialogOverlay>
  </DialogPortal>
</template>
