import { ref, nextTick, type Ref } from 'vue';

/**
 * Options for useInlineEdit
 */
export interface InlineEditOptions {
  /** Initial value to edit */
  initialValue?: string;
  /** Callback when edit is saved */
  onSave?: (newValue: string) => void;
  /** Callback when edit is cancelled */
  onCancel?: () => void;
}

/**
 * Return type for useInlineEdit
 */
export interface InlineEditReturn {
  /** Whether edit mode is active */
  isEditing: Ref<boolean>;
  /** Current edited value */
  editedValue: Ref<string>;
  /** Reference to the input element */
  inputRef: Ref<HTMLInputElement | null>;
  /** Start editing with optional initial value */
  startEditing: (value?: string) => void;
  /** Save the current edited value */
  saveEdit: () => void;
  /** Cancel editing and discard changes */
  cancelEdit: () => void;
  /** Stop event propagation (for keyboard events during editing) */
  stopPropagation: (event: KeyboardEvent) => void;
}

/**
 * useInlineEdit - Extract inline edit mode logic
 *
 * Extracted from ClipEditorHeader.vue:
 * - isEditingTitle state (line 75)
 * - editedTitle state (line 76)
 * - titleInputRef state (line 77)
 * - startEditingTitle() (lines 79-86)
 * - saveTitle() (lines 88-93)
 * - cancelEdit() (lines 95-98)
 * - stopPropagation() (lines 100-104)
 *
 * This composable handles:
 * - Toggle between view and edit mode
 * - Auto-focus and select input on edit start
 * - Save/cancel operations
 * - Preventing keyboard shortcuts from triggering during edit
 *
 * Usage:
 * ```ts
 * const {
 *   isEditing,
 *   editedValue,
 *   inputRef,
 *   startEditing,
 *   saveEdit,
 *   cancelEdit,
 *   stopPropagation,
 * } = useInlineEdit({
 *   onSave: (value) => emit('titleUpdate', value),
 * });
 *
 * // In template
 * <input
 *   v-if="isEditing"
 *   ref="inputRef"
 *   v-model="editedValue"
 *   @blur="saveEdit"
 *   @keydown.enter="saveEdit"
 *   @keydown.esc="cancelEdit"
 *   @keydown="stopPropagation"
 * />
 * <span v-else @click="startEditing(currentTitle)">{{ currentTitle }}</span>
 * ```
 */
export function useInlineEdit(options: InlineEditOptions = {}): InlineEditReturn {
  const { initialValue = '', onSave, onCancel } = options;

  const isEditing = ref(false);
  const editedValue = ref(initialValue);
  const inputRef = ref<HTMLInputElement | null>(null);

  // Store original value for comparison
  let originalValue = initialValue;

  /**
   * Start editing with an optional initial value
   * @param value - Initial value to edit (uses current editedValue if not provided)
   */
  function startEditing(value?: string): void {
    if (value !== undefined) {
      editedValue.value = value;
      originalValue = value;
    }
    isEditing.value = true;
    nextTick(() => {
      inputRef.value?.focus();
      inputRef.value?.select();
    });
  }

  /**
   * Save the current edited value
   * Only triggers onSave if value has changed and is not empty
   */
  function saveEdit(): void {
    const trimmedValue = editedValue.value.trim();
    if (trimmedValue && trimmedValue !== originalValue) {
      onSave?.(trimmedValue);
    }
    isEditing.value = false;
  }

  /**
   * Cancel editing and discard changes
   */
  function cancelEdit(): void {
    isEditing.value = false;
    editedValue.value = originalValue;
    onCancel?.();
  }

  /**
   * Stop keyboard event propagation
   * Prevents editor shortcuts (S for split, Delete, etc.) from triggering while editing
   * @param event - Keyboard event to stop
   */
  function stopPropagation(event: KeyboardEvent): void {
    event.stopPropagation();
  }

  return {
    isEditing,
    editedValue,
    inputRef,
    startEditing,
    saveEdit,
    cancelEdit,
    stopPropagation,
  };
}
