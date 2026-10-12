<template>
  <ToastProvider>
    <ToastRoot
      v-for="toast in toasts"
      :key="toast.id"
      v-model:open="toast.open"
      :duration="toast.duration"
      class="toast-root group relative flex items-start gap-3 rounded-xl bg-surface-raised py-3 pl-3.5 pr-10 shadow-[var(--shadow-lg)]"
      :class="{ 'toast-root--left': isLeftPosition }"
      @update:open="(open) => !open && removeToast(toast.id)"
    >
      <span class="mt-px grid size-5 shrink-0 place-items-center" :class="iconClass[toast.type] ?? iconClass.info">
        <CheckCircle2 v-if="toast.type === 'success'" class="size-[18px]" />
        <XCircle v-else-if="toast.type === 'error'" class="size-[18px]" />
        <AlertTriangle v-else-if="toast.type === 'warning'" class="size-[18px]" />
        <Loader2 v-else-if="toast.type === 'loading'" class="size-[18px] animate-spin" />
        <Info v-else class="size-[18px]" />
      </span>
      <div class="min-w-0 flex-1">
        <ToastTitle v-if="toast.title" class="text-sm font-medium leading-5 text-fg">{{ toast.title }}</ToastTitle>
        <ToastDescription v-if="toast.description" class="mt-0.5 text-xs leading-[18px] text-fg-muted">
          {{ toast.description }}
        </ToastDescription>
      </div>
      <ToastClose
        class="absolute right-2 top-2 grid size-6 place-items-center rounded-md text-fg-subtle opacity-0 transition hover:bg-surface-hover hover:text-fg group-hover:opacity-100 focus-visible:opacity-100"
        aria-label="Close"
      >
        <X class="size-3.5" />
      </ToastClose>
    </ToastRoot>
    <ToastViewport
      class="fixed z-[10100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2 outline-none"
      :class="viewportPositionClass"
    />
  </ToastProvider>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { ToastProvider, ToastRoot, ToastTitle, ToastDescription, ToastClose, ToastViewport } from 'radix-vue';
  import { useToastStore } from '@/composables/useToast';
  import { useUserPreferencesStore } from '@/stores/userPreferences';
  import { CheckCircle2, XCircle, AlertTriangle, Info, X, Loader2 } from 'lucide-vue-next';

  const { toasts, removeToast } = useToastStore();

  const iconClass: Record<string, string> = {
    success: 'text-success',
    error: 'text-danger',
    warning: 'text-warning',
    loading: 'text-brand',
    info: 'text-brand',
  };

  // Dynamic toast position based on user preferences
  function getPrefsStore() {
    try {
      return useUserPreferencesStore();
    } catch {
      return null;
    }
  }

  const viewportPositionClass = computed(() => {
    const prefs = getPrefsStore();
    const position = prefs?.toastPosition ?? 'bottom-right';
    switch (position) {
      case 'top-right':
        return 'top-12 right-4';
      case 'top-left':
        return 'top-12 left-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'bottom-right':
      default:
        return 'bottom-4 right-4';
    }
  });

  const isLeftPosition = computed(() => {
    const prefs = getPrefsStore();
    const position = prefs?.toastPosition ?? 'bottom-right';
    return position === 'top-left' || position === 'bottom-left';
  });
</script>

<style>
  .toast-root[data-state='open'] {
    animation: toastSlideIn 220ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .toast-root--left[data-state='open'] {
    animation: toastSlideInLeft 220ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .toast-root[data-state='closed'] {
    animation: toastFadeOut 140ms ease-out;
  }
  .toast-root[data-swipe='move'] {
    transform: translateX(var(--radix-toast-swipe-move-x));
  }
  .toast-root[data-swipe='cancel'] {
    transform: translateX(0);
    transition: transform 200ms ease-out;
  }
  .toast-root[data-swipe='end'] {
    animation: toastSwipeOut 140ms ease-out;
  }
  @keyframes toastSlideIn {
    from {
      opacity: 0;
      transform: translateX(16px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  @keyframes toastSlideInLeft {
    from {
      opacity: 0;
      transform: translateX(-16px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  @keyframes toastFadeOut {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
  @keyframes toastSwipeOut {
    from {
      transform: translateX(var(--radix-toast-swipe-end-x));
    }
    to {
      transform: translateX(110%);
    }
  }
</style>
