<script setup lang="ts">
  /**
   * "Paste a stream link" input used by Live streams, Download video and
   * Download audio. Looks like <SearchField>, but the leading icon swaps to the
   * detected platform's logo as the user types.
   */
  import type { HTMLAttributes } from 'vue'
  import { ref } from 'vue'
  import { Search, X } from 'lucide-vue-next'
  import { cn } from '@/lib/utils'
  import { PlatformLogo } from '@/components/ui/platform-logo'

  const props = withDefaults(
    defineProps<{
      modelValue: string
      /** Detected platform (any casing); null shows the search icon. */
      platform?: string | null
      placeholder?: string
      disabled?: boolean
      class?: HTMLAttributes['class']
    }>(),
    { platform: null, placeholder: 'Paste a stream link…' }
  )

  const emit = defineEmits<{
    'update:modelValue': [value: string]
    /** Fired after every keystroke, once the model has been updated. */
    input: [value: string]
    submit: []
  }>()

  const inputEl = ref<HTMLInputElement | null>(null)

  function onInput(event: Event) {
    const value = (event.target as HTMLInputElement).value
    emit('update:modelValue', value)
    emit('input', value)
  }

  function clear() {
    emit('update:modelValue', '')
    emit('input', '')
    inputEl.value?.focus()
  }

  defineExpose({ focus: () => inputEl.value?.focus() })
</script>

<template>
  <label
    :class="
      cn(
        'group relative flex h-[var(--control-md)] w-full min-w-0 items-center rounded-[var(--radius-control)] border border-line bg-surface-raised text-fg transition-[border-color,box-shadow]',
        'hover:border-line-strong focus-within:border-brand-line focus-within:shadow-[0_0_0_3px_var(--brand-soft)]',
        disabled && 'pointer-events-none opacity-50',
        props.class
      )
    "
  >
    <span class="pointer-events-none ml-2 grid size-4 shrink-0 place-items-center">
      <Transition
        mode="out-in"
        enter-active-class="transition duration-150"
        enter-from-class="scale-50 opacity-0"
        leave-active-class="transition duration-100"
        leave-to-class="scale-50 opacity-0"
      >
        <PlatformLogo v-if="platform" :key="platform" :platform="platform" size="xs" />
        <Search v-else class="size-3.5 text-fg-subtle group-focus-within:text-fg-muted" />
      </Transition>
    </span>
    <input
      ref="inputEl"
      :value="modelValue"
      type="text"
      :placeholder="placeholder"
      :disabled="disabled"
      spellcheck="false"
      autocomplete="off"
      class="h-full w-full min-w-0 bg-transparent pl-2 pr-7 text-sm text-fg placeholder:text-fg-subtle focus:outline-none"
      @input="onInput"
      @keyup.enter="emit('submit')"
    />
    <button
      v-if="modelValue && !disabled"
      type="button"
      class="absolute right-1 grid size-5 place-items-center rounded text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
      aria-label="Clear"
      @click.prevent="clear"
    >
      <X class="size-3.5" />
    </button>
  </label>
</template>
