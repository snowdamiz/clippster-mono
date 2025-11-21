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
        <div v-if="toast.type === 'success'" class="p-1.5 bg-green-500/10 rounded-md">
          <CheckCircle class="h-5 w-5 text-green-500" />
        </div>

        <div v-else-if="toast.type === 'error'" class="p-1.5 bg-red-500/10 rounded-md">
          <XCircle class="h-5 w-5 text-red-500" />
        </div>

        <div v-else-if="toast.type === 'warning'" class="p-1.5 bg-yellow-500/10 rounded-md">
          <AlertTriangle class="h-5 w-5 text-yellow-500" />
        </div>

        <div v-else-if="toast.type === 'loading'" class="p-1.5 bg-blue-500/10 rounded-md">
          <Loader2 class="h-5 w-5 text-blue-500 animate-spin" />
        </div>

        <div v-else class="p-1.5 bg-primary/10 rounded-md">
          <Info class="h-5 w-5 text-primary" />
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
        <X class="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
      </ToastClose>
    </ToastRoot>
    <ToastViewport
      class="fixed bottom-0 right-0 flex flex-col p-6 gap-3 w-[390px] max-w-[100vw] m-0 list-none z-[2147483647] outline-none"
    />
  </ToastProvider>
</template>

<script setup lang="ts">
  import { ToastProvider, ToastRoot, ToastTitle, ToastDescription, ToastClose, ToastViewport } from 'radix-vue';
  import { useToastStore } from '@/composables/useToast';
  import { CheckCircle, XCircle, AlertTriangle, Info, X, Loader2 } from 'lucide-vue-next';

  const { toasts, removeToast } = useToastStore();
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
