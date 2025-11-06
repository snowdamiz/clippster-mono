<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]"
    @click.self="$emit('close')"
  >
    <div class="bg-card rounded-2xl p-8 max-w-md w-full mx-4 border border-border">
      <h2 class="text-2xl font-bold mb-4">{{ title }}</h2>

      <div class="space-y-4">
        <p class="text-muted-foreground">
          {{ message }}
          <span v-if="itemName" class="font-semibold text-foreground">"{{ itemName }}"</span>
          {{ suffix }} This action cannot be undone.
        </p>
        <button
          class="w-full py-3 bg-gradient-to-r from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 text-white rounded-lg font-semibold transition-all"
          @click="$emit('confirm')"
        >
          {{ confirmText }}
        </button>
        <button
          class="w-full py-3 bg-muted text-foreground rounded-lg font-semibold hover:bg-muted/80 transition-all"
          @click="$emit('close')"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  interface Props {
    show: boolean;
    title?: string;
    message?: string;
    itemName?: string;
    suffix?: string;
    confirmText?: string;
  }

  interface Emits {
    (e: 'close'): void;
    (e: 'confirm'): void;
  }

  withDefaults(defineProps<Props>(), {
    title: 'Confirm Action',
    message: 'Are you sure you want to',
    suffix: '?',
    confirmText: 'Confirm',
  });

  defineEmits<Emits>();
</script>
