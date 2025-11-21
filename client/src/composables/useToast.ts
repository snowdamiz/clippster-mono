import { reactive, readonly } from 'vue';

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'loading';
  duration?: number;
  open: boolean;
}

interface ToastOptions {
  title?: string;
  description?: string;
  type?: 'success' | 'error' | 'warning' | 'info' | 'loading';
  duration?: number;
}

const state = reactive<{ toasts: Toast[] }>({
  toasts: [],
});

let toastIdCounter = 0;

function generateId(): string {
  return `toast-${Date.now()}-${toastIdCounter++}`;
}

function addToast(options: ToastOptions): string {
  const id = generateId();
  const toast: Toast = {
    id,
    title: options.title,
    description: options.description,
    type: options.type || 'info',
    duration: options.duration || 5000,
    open: true,
  };

  state.toasts.push(toast);
  return id;
}

function removeToast(id: string) {
  const index = state.toasts.findIndex((t) => t.id === id);
  if (index !== -1) {
    state.toasts.splice(index, 1);
  }
}

function clearAllToasts() {
  state.toasts = [];
}

// Convenience methods
function success(title: string, description?: string, duration?: number) {
  return addToast({ title, description, type: 'success', duration });
}

function error(title: string, description?: string, duration?: number) {
  return addToast({ title, description, type: 'error', duration });
}

function warning(title: string, description?: string, duration?: number) {
  return addToast({ title, description, type: 'warning', duration });
}

function info(title: string, description?: string, duration?: number) {
  return addToast({ title, description, type: 'info', duration });
}

export function useToastStore() {
  return {
    toasts: readonly(state.toasts),
    addToast,
    removeToast,
    clearAllToasts,
    success,
    error,
    warning,
    info,
  };
}

export function useToast() {
  return {
    toast: addToast,
    success,
    error,
    warning,
    info,
  };
}
