<template>
  <div class="relative w-full max-w-md" :class="containerClass">
    <div class="relative flex items-center">
      <!-- Search Icon on the left -->
      <div class="absolute left-3 flex items-center pointer-events-none">
        <svg
          v-if="!loading"
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <svg
          v-else
          class="animate-spin h-5 w-5 text-muted-foreground"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>

          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      </div>
      <!-- Input field -->
      <input
        v-model="inputValue"
        :type="type"
        :placeholder="placeholder"
        :disabled="disabled || loading"
        :class="
          cn(
            'w-full h-12 pl-12 pr-16 bg-muted border-l border-t border-b border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed',
            inputClass
          )
        "
        @keyup.enter="handleEnter"
        @input="handleInput"
      />
      <!-- Search button on the right -->
      <button
        @click="handleSearch"
        :disabled="disabled || loading || !inputValue?.trim()"
        :title="loading ? 'Searching...' : 'Search'"
        :class="
          cn(
            'absolute right-0 top-0 h-12 w-12 bg-gradient-to-br from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 text-white rounded-r-lg flex items-center justify-center font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed',
            buttonClass
          )
        "
      >
        <svg
          v-if="!loading"
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <svg v-else class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>

          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { HTMLAttributes } from 'vue'
  import { cn } from '@/lib/utils'
  import { useVModel } from '@vueuse/core'

  interface Props {
    modelValue?: string
    placeholder?: string
    type?: 'text' | 'search' | 'url'
    disabled?: boolean
    loading?: boolean
    containerClass?: HTMLAttributes['class']
    inputClass?: HTMLAttributes['class']
    buttonClass?: HTMLAttributes['class']
    autoSearch?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    placeholder: 'Search...',
    type: 'text',
    disabled: false,
    loading: false,
    autoSearch: true
  })

  const emits = defineEmits<{
    (e: 'update:modelValue', payload: string): void
    (e: 'search'): void
    (e: 'input', payload: string): void
  }>()

  const inputValue = useVModel(props, 'modelValue', emits, {
    passive: true
  })

  function handleInput() {
    emits('input', inputValue.value || '')
  }

  function handleEnter() {
    if (!props.disabled && !props.loading && inputValue.value?.trim()) {
      handleSearch()
    }
  }

  function handleSearch() {
    if (!props.disabled && !props.loading && inputValue.value?.trim()) {
      emits('search')
    }
  }
</script>
