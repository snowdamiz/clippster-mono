<template>
  <div class="flex flex-col items-center justify-center min-h-[calc(100vh-16rem)]">
    <div class="p-5 bg-muted rounded-full mb-6">
      <slot name="icon">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </slot>
    </div>
    <h3 class="text-xl font-semibold text-foreground mb-2">{{ title }}</h3>
    <p class="text-muted-foreground mb-6">{{ description }}</p>
    <slot name="action">
      <button 
        v-if="buttonText"
        @click="$emit('action')"
        class="px-5 py-2.5 bg-gradient-to-br from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 text-white rounded-lg font-medium shadow-sm transition-all"
      >
        {{ buttonText }}
      </button>
    </slot>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  description: string
  buttonText?: string
}>()

defineEmits<{
  action: []
}>()
</script>
