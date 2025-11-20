<template>
  <div class="flex flex-col items-center justify-center min-h-[calc(100vh-16rem)]">
    <div class="p-5 bg-muted rounded-full mb-6">
      <slot name="icon">
        <File class="h-16 w-16 text-muted-foreground" />
      </slot>
    </div>

    <h3 class="text-xl font-semibold text-foreground mb-2">{{ title }}</h3>

    <p class="text-muted-foreground mb-6">{{ description }}</p>
    <slot name="action">
      <button
        v-if="buttonText"
        @click="$emit('action')"
        class="px-5 py-2.5 bg-gradient-to-br from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 text-white rounded-md font-medium shadow-sm transition-all"
      >
        {{ buttonText }}
      </button>
    </slot>
  </div>
</template>

<script setup lang="ts">
  import { File } from 'lucide-vue-next';

  defineProps<{
    title: string;
    description: string;
    buttonText?: string;
  }>();

  defineEmits<{
    action: [];
  }>();
</script>
