import { reactive } from 'vue';

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

function loading(title: string, description?: string) {
  // Loading toasts don't auto-dismiss - they stay until manually removed or updated
  return addToast({ title, description, type: 'loading', duration: Infinity });
}

function updateToast(id: string, options: Partial<ToastOptions>) {
  const toast = state.toasts.find((t) => t.id === id);
  if (toast) {
    if (options.title !== undefined) toast.title = options.title;
    if (options.description !== undefined) toast.description = options.description;
    if (options.type !== undefined) toast.type = options.type;
    if (options.duration !== undefined) toast.duration = options.duration;
  }
}

export function useToastStore() {
  return {
    // Note: toasts is NOT readonly because Toast.vue needs to mutate toast.open via v-model
    toasts: state.toasts,
    addToast,
    removeToast,
    updateToast,
    clearAllToasts,
    success,
    error,
    warning,
    info,
    loading,
  };
}

// Convenience function matching the showToast(message, type) pattern
function showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
  return addToast({ title: message, type });
}

export function useToast() {
  return {
    toast: addToast,
    showToast,
    success,
    error,
    warning,
    info,
    loading,
    updateToast,
    removeToast,
  };
}
