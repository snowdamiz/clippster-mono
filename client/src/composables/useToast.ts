import { reactive } from 'vue';
import type { ToastCategory } from '@/stores/userPreferences';
import { useUserPreferencesStore } from '@/stores/userPreferences';

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'loading';
  duration?: number;
  open: boolean;
  category?: ToastCategory;
}

interface ToastOptions {
  title?: string;
  description?: string;
  type?: 'success' | 'error' | 'warning' | 'info' | 'loading';
  duration?: number;
  category?: ToastCategory;
}

const state = reactive<{ toasts: Toast[] }>({
  toasts: [],
});

let toastIdCounter = 0;

// Notification sound via Web Audio API (no external file needed)
let audioCtx: AudioContext | null = null;

function playNotificationSound() {
  try {
    if (!audioCtx) {
      audioCtx = new AudioContext();
    }
    // Short pleasant two-tone chime
    const now = audioCtx.currentTime;

    // First tone (higher)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.value = 880; // A5
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Second tone (slightly lower, delayed)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = 1174.66; // D6
    gain2.gain.setValueAtTime(0.12, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.25);
  } catch {
    // Ignore audio errors (e.g., AudioContext not allowed)
  }
}

/**
 * Get preferences store safely.
 * Wrapped in try/catch because Pinia may not be initialized yet during early app boot.
 */
function getPreferencesStore() {
  try {
    return useUserPreferencesStore();
  } catch {
    return null;
  }
}

function generateId(): string {
  return `toast-${Date.now()}-${toastIdCounter++}`;
}

function addToast(options: ToastOptions): string {
  const prefs = getPreferencesStore();

  // If preferences aren't loaded yet, show the toast anyway (fail-open for better UX)
  if (!prefs) {
    console.log('[Toast] Preferences not loaded yet, showing toast anyway:', options.title);
  } else {
    // Check if toasts are globally disabled
    if (!prefs.toastEnabled && options.type !== 'loading') {
      console.log('[Toast] Toasts globally disabled, skipping:', options.title);
      return '';
    }

    // Check if this category is enabled
    if (options.category && !prefs.isCategoryEnabled(options.category)) {
      console.log('[Toast] Category disabled, skipping:', options.category, options.title);
      return '';
    }

    console.log('[Toast] Showing toast:', {
      title: options.title,
      category: options.category,
      type: options.type,
      categoryEnabled: options.category ? prefs.isCategoryEnabled(options.category) : 'N/A',
    });
  }

  // Use user's preferred duration if not explicitly set
  const defaultDuration = prefs?.toastDuration ?? 5000;
  // Duration of 0 means "until dismissed"
  const effectiveDuration = options.duration ?? (defaultDuration === 0 ? Infinity : defaultDuration);

  const id = generateId();
  const toast: Toast = {
    id,
    title: options.title,
    description: options.description,
    type: options.type || 'info',
    duration: effectiveDuration,
    open: true,
    category: options.category,
  };

  state.toasts.push(toast);

  // Play notification sound if enabled
  if (prefs?.toastSoundEnabled && options.type !== 'loading') {
    playNotificationSound();
  }

  // Show background notification if app is not focused and setting is enabled
  const shouldShowBackground = prefs?.toastBackgroundEnabled && options.type !== 'loading' && typeof document !== 'undefined' && !document.hasFocus();
  console.log('[Toast] Background notification check:', {
    toastBackgroundEnabled: prefs?.toastBackgroundEnabled,
    isNotLoading: options.type !== 'loading',
    documentExists: typeof document !== 'undefined',
    appNotFocused: typeof document !== 'undefined' ? !document.hasFocus() : 'N/A',
    willShow: shouldShowBackground,
  });
  
  if (shouldShowBackground) {
    showBackgroundNotification(toast);
  }

  return id;
}

/**
 * Show a Steam-style Tauri notification window when the app is in the background.
 */
async function showBackgroundNotification(toast: Toast) {
  console.log('[Toast] showBackgroundNotification called for:', toast.title);
  try {
    const { WebviewWindow, getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const { currentMonitor, UserAttentionType } = await import('@tauri-apps/api/window');

    // Flash the taskbar icon to get user's attention (like Discord/Steam)
    try {
      const mainWindow = getCurrentWebviewWindow();
      await mainWindow.requestUserAttention(UserAttentionType.Informational);
      console.log('[Toast] Taskbar icon flashing');
    } catch (err) {
      console.warn('[Toast] Failed to flash taskbar icon:', err);
    }

    const prefs = getPreferencesStore();
    const position = prefs?.toastPosition ?? 'bottom-right';
    const duration = toast.duration === Infinity ? 10000 : (toast.duration ?? 5000);

    const monitor = await currentMonitor();
    if (!monitor) {
      console.warn('[Toast] No monitor found, cannot show notification');
      return;
    }

    const winWidth = 400;
    const winHeight = 100;
    const padding = 16;
    const { width: screenW, height: screenH } = monitor.size;

    let x = 0;
    let y = 0;
    if (position === 'bottom-right') {
      x = screenW - winWidth - padding;
      y = screenH - winHeight - padding - 48;
    } else if (position === 'bottom-left') {
      x = padding;
      y = screenH - winHeight - padding - 48;
    } else if (position === 'top-right') {
      x = screenW - winWidth - padding;
      y = padding;
    } else if (position === 'top-left') {
      x = padding;
      y = padding;
    }

    const label = `notification-${toast.id}`;
    const params = encodeURIComponent(JSON.stringify({
      title: toast.title,
      description: toast.description,
      type: toast.type,
    }));

    const notifWindow = new WebviewWindow(label, {
      url: `/notification.html?data=${params}`,
      title: '',
      width: winWidth,
      height: winHeight,
      x,
      y,
      decorations: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      focus: false,
      transparent: true,
      visible: false,
      shadow: false, // Prevent Windows from rendering a shadow/ghost box behind the transparent window
    });

    // Wait for window to be created, then show it after a tiny delay
    notifWindow.once('tauri://created', async () => {
      console.log('[Toast] Notification window created successfully:', label);
      // Small delay to let Windows settle before showing
      setTimeout(async () => {
        try {
          await notifWindow.show();
          console.log('[Toast] Notification window shown');
        } catch (err) {
          console.error('[Toast] Failed to show notification window:', err);
        }
      }, 100);
    });

    notifWindow.once('tauri://error', (e) => {
      console.error('[Toast] Notification window creation failed:', e);
    });

    // Auto-close after duration
    setTimeout(async () => {
      try {
        await notifWindow.close();
        console.log('[Toast] Notification window closed');
      } catch (err) {
        console.warn('[Toast] Failed to close notification window:', err);
      }
    }, duration);
  } catch (error) {
    console.error('[Toast] Failed to show background notification:', error);
  }
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

// Convenience methods with optional category
function success(title: string, description?: string, duration?: number, category?: ToastCategory) {
  return addToast({ title, description, type: 'success', duration, category });
}

function error(title: string, description?: string, duration?: number, category?: ToastCategory) {
  return addToast({ title, description, type: 'error', duration, category });
}

function warning(title: string, description?: string, duration?: number, category?: ToastCategory) {
  return addToast({ title, description, type: 'warning', duration, category });
}

function info(title: string, description?: string, duration?: number, category?: ToastCategory) {
  return addToast({ title, description, type: 'info', duration, category });
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
function showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', category?: ToastCategory) {
  return addToast({ title: message, type, category });
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
