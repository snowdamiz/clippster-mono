import { onMounted, onUnmounted } from 'vue';

/**
 * Keyboard shortcut handlers configuration
 */
export interface KeyboardShortcutHandlers {
  /** Ctrl+Z - Undo */
  onUndo?: () => void;
  /** Ctrl+Y / Ctrl+Shift+Z - Redo */
  onRedo?: () => void;
  /** Space - Play/Pause toggle */
  onPlayPause?: () => void;
  /** Ctrl+S - Save */
  onSave?: () => void;
  /** Ctrl+E - Export */
  onExport?: () => void;
  /** S - Split at playhead */
  onSplit?: () => void;
  /** Delete/Backspace - Delete selected */
  onDelete?: () => void;
  /** Escape - Close */
  onClose?: () => void;
  /** Left Arrow - Step backward */
  onStepBackward?: () => void;
  /** Right Arrow - Step forward */
  onStepForward?: () => void;
}

/**
 * Options for useEditorKeyboardShortcuts
 */
export interface KeyboardShortcutsOptions {
  /** Handlers for each shortcut */
  handlers: KeyboardShortcutHandlers;
  /** Whether to auto-register on mount (default: true) */
  autoRegister?: boolean;
}

/**
 * Return type for useEditorKeyboardShortcuts
 */
export interface KeyboardShortcutsReturn {
  /** Manually register keyboard shortcuts */
  register: () => void;
  /** Manually unregister keyboard shortcuts */
  unregister: () => void;
}

/**
 * useEditorKeyboardShortcuts - Centralized keyboard shortcut handling
 *
 * Extracts the keyboard shortcut handling from ClipEditorDialog (lines 703-763).
 * Provides a clean, declarative way to register editor shortcuts.
 *
 * Usage:
 * ```ts
 * const { register, unregister } = useEditorKeyboardShortcuts({
 *   handlers: {
 *     onUndo: () => commandHistory.undo(),
 *     onRedo: () => commandHistory.redo(),
 *     onPlayPause: () => isPlaying.value ? pause() : play(),
 *     onSplit: handleSplit,
 *     onDelete: handleDelete,
 *     onExport: handleExport,
 *     onClose: handleClose,
 *   },
 * });
 * ```
 */
export function useEditorKeyboardShortcuts(
  options: KeyboardShortcutsOptions
): KeyboardShortcutsReturn {
  const { handlers, autoRegister = true } = options;

  /**
   * Check if the event target is an input element
   */
  function isInputElement(target: EventTarget | null): boolean {
    if (!target || !(target instanceof HTMLElement)) return false;
    const tagName = target.tagName.toLowerCase();
    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      target.isContentEditable
    );
  }

  /**
   * Handle keydown events
   */
  function handleKeyDown(event: KeyboardEvent): void {
    // Don't handle shortcuts when typing in inputs (except for specific global shortcuts)
    const isInput = isInputElement(event.target);

    // Ctrl+Z - Undo (works even in inputs for consistency)
    if (event.ctrlKey && event.key === 'z' && !event.shiftKey) {
      event.preventDefault();
      handlers.onUndo?.();
      return;
    }

    // Ctrl+Y or Ctrl+Shift+Z - Redo
    if (
      (event.ctrlKey && event.key === 'y') ||
      (event.ctrlKey && event.shiftKey && event.key === 'z')
    ) {
      event.preventDefault();
      handlers.onRedo?.();
      return;
    }

    // Ctrl+S - Save (works even in inputs)
    if (event.ctrlKey && event.key === 's') {
      event.preventDefault();
      handlers.onSave?.();
      return;
    }

    // Ctrl+E - Export (works even in inputs)
    if (event.ctrlKey && event.key === 'e') {
      event.preventDefault();
      handlers.onExport?.();
      return;
    }

    // Skip other shortcuts if in input element
    if (isInput) return;

    // Space - Play/Pause
    if (event.key === ' ') {
      event.preventDefault();
      handlers.onPlayPause?.();
      return;
    }

    // S - Split at playhead (not in inputs, not with modifiers)
    if (event.key === 's' && !event.ctrlKey && !event.altKey && !event.shiftKey) {
      event.preventDefault();
      handlers.onSplit?.();
      return;
    }

    // Delete/Backspace - Delete selected item
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      handlers.onDelete?.();
      return;
    }

    // Left Arrow - Step backward
    if (event.key === 'ArrowLeft' && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      handlers.onStepBackward?.();
      return;
    }

    // Right Arrow - Step forward
    if (event.key === 'ArrowRight' && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      handlers.onStepForward?.();
      return;
    }

    // Escape - Close
    if (event.key === 'Escape') {
      event.preventDefault();
      handlers.onClose?.();
      return;
    }
  }

  /**
   * Register keyboard shortcuts
   */
  function register(): void {
    window.addEventListener('keydown', handleKeyDown);
  }

  /**
   * Unregister keyboard shortcuts
   */
  function unregister(): void {
    window.removeEventListener('keydown', handleKeyDown);
  }

  // Auto-register on mount if enabled
  if (autoRegister) {
    onMounted(() => {
      register();
    });

    onUnmounted(() => {
      unregister();
    });
  }

  return {
    register,
    unregister,
  };
}
