<script setup lang="ts">
  /**
   * The standard modal dialog. Every dialog in the app should use this rather
   * than hand-rolling an overlay: it provides the backdrop, focus trap, Escape
   * handling, header (icon + title + description + close), scrollable body
   * and a footer action row.
   *
   *   <Modal v-model:open="open" title="Rename project" :icon="Pencil">
   *     ...body...
   *     <template #footer>
   *       <Button variant="ghost" @click="open = false">Cancel</Button>
   *       <Button variant="primary" @click="save">Save</Button>
   *     </template>
   *   </Modal>
   */
  import type { Component, HTMLAttributes } from 'vue'
  import type { IconTileVariants } from '../icon-tile'
  import { computed } from 'vue'
  import { X } from 'lucide-vue-next'
  import {
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogOverlay,
    DialogPortal,
    DialogRoot,
    DialogTitle,
    VisuallyHidden,
  } from 'reka-ui'
  import { cn } from '@/lib/utils'
  import { IconTile } from '../icon-tile'

  type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'

  const props = withDefaults(
    defineProps<{
      open: boolean
      title?: string
      description?: string
      icon?: Component
      tone?: IconTileVariants['tone']
      size?: ModalSize
      /** Close on Escape and backdrop click. Disable for blocking flows. */
      dismissible?: boolean
      hideClose?: boolean
      /** Remove body padding (for full-bleed media, tables, split layouts). */
      flush?: boolean
      class?: HTMLAttributes['class']
      bodyClass?: HTMLAttributes['class']
      footerClass?: HTMLAttributes['class']
    }>(),
    {
      size: 'md',
      tone: 'neutral',
      dismissible: true,
      hideClose: false,
      flush: false,
    }
  )

  const emit = defineEmits<{
    'update:open': [value: boolean]
    close: []
  }>()

  const sizeClass: Record<ModalSize, string> = {
    sm: 'max-w-[400px]',
    md: 'max-w-[480px]',
    lg: 'max-w-[640px]',
    xl: 'max-w-[820px]',
    '2xl': 'max-w-[1040px]',
    full: 'max-w-[calc(100vw-2rem)] h-[calc(100vh-var(--titlebar-height)-2rem)]',
  }

  const hasHeader = computed(() => !!(props.title || props.icon))
  // Without a description, opt out of aria-describedby so reka doesn't warn.
  const describedBy = computed(() => (props.description ? {} : { 'aria-describedby': undefined }))

  function setOpen(value: boolean) {
    emit('update:open', value)
    if (!value) emit('close')
  }

  function guard(event: Event) {
    if (!props.dismissible) event.preventDefault()
  }
</script>

<template>
  <DialogRoot :open="open" @update:open="setOpen">
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-[10040] bg-[var(--overlay)] backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      />
      <DialogContent
        v-bind="describedBy"
        :class="
          cn(
            'fixed left-1/2 top-[calc(50%+var(--titlebar-height)/2)] z-[10040] flex max-h-[calc(100vh-var(--titlebar-height)-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden',
            'rounded-[var(--radius-modal)] bg-surface-raised text-fg shadow-[var(--shadow-lg)] outline-none',
            'duration-150 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.98] data-[state=open]:zoom-in-[0.98]',
            sizeClass[size],
            props.class
          )
        "
        @escape-key-down="guard"
        @pointer-down-outside="guard"
        @interact-outside="guard"
      >
        <slot name="header">
          <header v-if="hasHeader" class="flex shrink-0 items-start gap-3 px-5 pt-4 pb-1" :class="{ 'pr-12': !hideClose }">
            <IconTile v-if="icon" :icon="icon" :tone="tone" size="md" class="mt-0.5" />
            <div class="min-w-0 flex-1">
              <DialogTitle class="text-[15px] font-semibold leading-6 tracking-[-0.01em] text-fg">
                {{ title }}
              </DialogTitle>
              <DialogDescription v-if="description" class="mt-0.5 text-sm text-fg-muted">
                {{ description }}
              </DialogDescription>
            </div>
            <slot name="header-actions" />
          </header>
        </slot>
        <VisuallyHidden v-if="!hasHeader || $slots.header">
          <DialogTitle>{{ title || 'Dialog' }}</DialogTitle>
        </VisuallyHidden>

        <div
          :class="
            cn('min-h-0 flex-1 overflow-y-auto', flush ? '' : 'px-5 pt-3 pb-5', !hasHeader && !flush ? 'pt-5' : '', bodyClass)
          "
        >
          <slot />
        </div>

        <footer
          v-if="$slots.footer"
          :class="
            cn(
              'flex shrink-0 items-center justify-end gap-2 border-t border-line-subtle bg-surface px-5 py-3',
              footerClass
            )
          "
        >
          <slot name="footer" />
        </footer>

        <DialogClose
          v-if="!hideClose"
          class="absolute right-3 top-3 grid size-7 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg focus-visible:shadow-[var(--focus-ring)]"
          aria-label="Close"
        >
          <X class="size-4" />
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
