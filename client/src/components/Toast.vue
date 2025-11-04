<template>
  <ToastProvider>
    <ToastRoot
      v-for="toast in toasts"
      :key="toast.id"
      v-model:open="toast.open"
      :duration="toast.duration"
      class="bg-card border border-border rounded-lg p-4 shadow-lg flex items-start gap-3 data-[state=open]:animate-slideIn data-[state=closed]:animate-hide data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=cancel]:translate-x-0 data-[swipe=end]:animate-swipeOut"
      @update:open="(open) => !open && removeToast(toast.id)"
    >
      <!-- Icon -->
      <div class="flex-shrink-0 mt-0.5">
        <div v-if="toast.type === 'success'" class="p-1.5 bg-green-500/10 rounded-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5 text-green-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clip-rule="evenodd"
            />
          </svg>
        </div>

        <div v-else-if="toast.type === 'error'" class="p-1.5 bg-red-500/10 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clip-rule="evenodd"
            />
          </svg>
        </div>

        <div v-else-if="toast.type === 'warning'" class="p-1.5 bg-yellow-500/10 rounded-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5 text-yellow-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clip-rule="evenodd"
            />
          </svg>
        </div>

        <div v-else class="p-1.5 bg-primary/10 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
      </div>
      <!-- Content -->
      <div class="flex-1 min-w-0">
        <ToastTitle v-if="toast.title" class="font-semibold text-foreground mb-1">{{ toast.title }}</ToastTitle>
        <ToastDescription v-if="toast.description" class="text-sm text-muted-foreground">
          {{ toast.description }}
        </ToastDescription>
      </div>
      <!-- Close Button -->
      <ToastClose class="flex-shrink-0 p-1 hover:bg-muted rounded-md transition-colors" aria-label="Close">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clip-rule="evenodd"
          />
        </svg>
      </ToastClose>
    </ToastRoot>
    <ToastViewport
      class="fixed bottom-0 right-0 flex flex-col p-6 gap-3 w-[390px] max-w-[100vw] m-0 list-none z-[2147483647] outline-none"
    />
  </ToastProvider>
</template>

<script setup lang="ts">
  import { ToastProvider, ToastRoot, ToastTitle, ToastDescription, ToastClose, ToastViewport } from 'radix-vue'
  import { useToastStore } from '@/composables/useToast'

  const { toasts, removeToast } = useToastStore()
</script>

<style>
  @keyframes slideIn {
    from {
      transform: translateX(calc(100% + 1.5rem));
    }
    to {
      transform: translateX(0);
    }
  }

  @keyframes hide {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }

  @keyframes swipeOut {
    from {
      transform: translateX(var(--radix-toast-swipe-end-x));
    }
    to {
      transform: translateX(calc(100% + 1.5rem));
    }
  }

  [data-state='open'] {
    animation: slideIn 150ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  [data-state='closed'] {
    animation: hide 100ms ease-in;
  }

  [data-swipe='move'] {
    transform: translateX(var(--radix-toast-swipe-move-x));
  }

  [data-swipe='cancel'] {
    transform: translateX(0);
    transition: transform 200ms ease-out;
  }

  [data-swipe='end'] {
    animation: swipeOut 100ms ease-out;
  }
</style>
