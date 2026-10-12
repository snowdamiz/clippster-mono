<script setup lang="ts">
  /**
   * Compact search input with a leading icon and a clear button — the one
   * search box used in page headers, toolbars and panels.
   */
  import type { HTMLAttributes } from 'vue'
  import { ref } from 'vue'
  import { Loader2, Search, X } from 'lucide-vue-next'
  import { cn } from '@/lib/utils'

  const props = withDefaults(
    defineProps<{
      modelValue?: string
      placeholder?: string
      loading?: boolean
      disabled?: boolean
      autofocus?: boolean
      size?: 'sm' | 'md'
      class?: HTMLAttributes['class']
      inputClass?: HTMLAttributes['class']
    }>(),
    { modelValue: '', placeholder: 'Search…', size: 'md' }
  )

  const emit = defineEmits<{
    'update:modelValue': [value: string]
    submit: [value: string]
    clear: []
  }>()

  const input = ref<HTMLInputElement | null>(null)

  function clear() {
    emit('update:modelValue', '')
    emit('clear')
    input.value?.focus()
  }

  defineExpose({ focus: () => input.value?.focus() })
</script>

<template>
  <label
    :class="
      cn(
        'group relative flex w-full min-w-0 items-center rounded-[var(--radius-control)] border border-line bg-surface-raised text-fg transition-[border-color,box-shadow]',
        'hover:border-line-strong focus-within:border-brand-line focus-within:shadow-[0_0_0_3px_var(--brand-soft)]',
        size === 'sm' ? 'h-[var(--control-sm)]' : 'h-[var(--control-md)]',
        disabled && 'pointer-events-none opacity-50',
        props.class
      )
    "
  >
    <Loader2 v-if="loading" class="pointer-events-none ml-2.5 size-3.5 shrink-0 animate-spin text-fg-subtle" />
    <Search v-else class="pointer-events-none ml-2.5 size-3.5 shrink-0 text-fg-subtle group-focus-within:text-fg-muted" />
    <input
      ref="input"
      :value="modelValue"
      type="text"
      :placeholder="placeholder"
      :disabled="disabled"
      :autofocus="autofocus"
      spellcheck="false"
      autocomplete="off"
      :class="
        cn(
          'h-full w-full min-w-0 bg-transparent pl-2 pr-7 text-sm text-fg placeholder:text-fg-subtle focus:outline-none',
          inputClass
        )
      "
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @keydown.enter="emit('submit', modelValue)"
      @keydown.esc="modelValue ? clear() : undefined"
    />
    <button
      v-if="modelValue && !disabled"
      type="button"
      class="absolute right-1 grid size-5 place-items-center rounded text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
      aria-label="Clear search"
      @click.prevent="clear"
    >
      <X class="size-3.5" />
    </button>
  </label>
</template>
