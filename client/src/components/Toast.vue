<template>
  <ToastProvider>
    <ToastRoot
      v-for="toast in toasts"
      :key="toast.id"
      v-model:open="toast.open"
      :duration="toast.duration"
      class="toast-root"
      :class="[`toast-root--${toast.type}`]"
      @update:open="(open) => !open && removeToast(toast.id)"
    >
      <!-- Accent Bar -->
      <div class="toast-accent" :class="[`toast-accent--${toast.type}`]"></div>

      <div class="toast-content">
        <!-- Icon -->
        <div class="toast-icon" :class="[`toast-icon--${toast.type}`]">
          <CheckCircle v-if="toast.type === 'success'" class="h-5 w-5" />
          <XCircle v-else-if="toast.type === 'error'" class="h-5 w-5" />
          <AlertTriangle v-else-if="toast.type === 'warning'" class="h-5 w-5" />
          <Loader2 v-else-if="toast.type === 'loading'" class="h-5 w-5 animate-spin" />
          <Info v-else class="h-5 w-5" />
        </div>

        <!-- Text Content -->
        <div class="toast-text">
          <ToastTitle v-if="toast.title" class="toast-title">{{ toast.title }}</ToastTitle>
          <ToastDescription v-if="toast.description" class="toast-description">
            {{ toast.description }}
          </ToastDescription>
        </div>

        <!-- Close Button -->
        <ToastClose class="toast-close" aria-label="Close">
          <X class="h-4 w-4" />
        </ToastClose>
      </div>
    </ToastRoot>
    <ToastViewport
      class="fixed bottom-6 right-6 flex flex-col gap-3 w-[380px] max-w-[calc(100vw-3rem)] z-[9999] outline-none"
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
  /* ===== Toast Root ===== */
  .toast-root {
    position: relative;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    overflow: hidden;
    box-shadow:
      0 10px 40px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(255, 255, 255, 0.03) inset;
    backdrop-filter: blur(12px);
  }

  .toast-root[data-state='open'] {
    animation: toastSlideIn 250ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .toast-root[data-state='closed'] {
    animation: toastFadeOut 150ms ease-out;
  }

  .toast-root[data-swipe='move'] {
    transform: translateX(var(--radix-toast-swipe-move-x));
  }

  .toast-root[data-swipe='cancel'] {
    transform: translateX(0);
    transition: transform 200ms ease-out;
  }

  .toast-root[data-swipe='end'] {
    animation: toastSwipeOut 150ms ease-out;
  }

  /* ===== Accent Bar ===== */
  .toast-accent {
    height: 3px;
    width: 100%;
    flex-shrink: 0;
  }

  .toast-accent--success {
    background: linear-gradient(90deg, #10b981, #34d399, #6ee7b7);
  }

  .toast-accent--error {
    background: linear-gradient(90deg, #ef4444, #f87171, #fca5a5);
  }

  .toast-accent--warning {
    background: linear-gradient(90deg, #f59e0b, #fbbf24, #fcd34d);
  }

  .toast-accent--loading,
  .toast-accent--info {
    background: linear-gradient(90deg, #06b6d4, #0ea5e9, #38bdf8);
  }

  /* ===== Toast Content ===== */
  .toast-content {
    display: flex;
    align-items: flex-start;
    gap: 0.875rem;
    padding: 1rem;
  }

  /* ===== Icon Styles ===== */
  .toast-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    transition: all 200ms ease;
  }

  .toast-icon--success {
    background-color: rgba(16, 185, 129, 0.15);
    color: #10b981;
    box-shadow: 0 0 20px rgba(16, 185, 129, 0.2);
  }

  .toast-icon--error {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
    box-shadow: 0 0 20px rgba(239, 68, 68, 0.2);
  }

  .toast-icon--warning {
    background-color: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    box-shadow: 0 0 20px rgba(245, 158, 11, 0.2);
  }

  .toast-icon--loading,
  .toast-icon--info {
    background-color: rgba(6, 182, 212, 0.15);
    color: #06b6d4;
    box-shadow: 0 0 20px rgba(6, 182, 212, 0.2);
  }

  /* ===== Text Content ===== */
  .toast-text {
    flex: 1;
    min-width: 0;
    padding-top: 0.125rem;
  }

  .toast-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    line-height: 1.4;
    letter-spacing: -0.01em;
  }

  .toast-description {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.25rem;
    line-height: 1.5;
  }

  /* ===== Close Button ===== */
  .toast-close {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: transparent;
    border: none;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
    margin-top: -0.125rem;
    margin-right: -0.25rem;
  }

  .toast-close:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .toast-close:active {
    background-color: rgba(255, 255, 255, 0.1);
  }

  /* ===== Animations ===== */
  @keyframes toastSlideIn {
    from {
      opacity: 0;
      transform: translateX(calc(100% + 1.5rem)) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateX(0) scale(1);
    }
  }

  @keyframes toastFadeOut {
    from {
      opacity: 1;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(0.95);
    }
  }

  @keyframes toastSwipeOut {
    from {
      transform: translateX(var(--radix-toast-swipe-end-x));
    }
    to {
      transform: translateX(calc(100% + 1.5rem));
    }
  }
</style>
