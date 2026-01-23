import { ref, computed, type Ref, type ComputedRef } from 'vue';

/**
 * Selection item types in the clip editor
 */
export type SelectionItemType = 'video' | 'audio' | 'text' | 'sticker' | 'watermark' | null;

/**
 * Base interface for selectable items
 */
export interface SelectableItem {
  id: string;
  start_time: number;
  end_time: number;
}

/**
 * Return type for useEditorSelection
 */
export interface EditorSelectionReturn {
  /** Currently selected item (can be any timeline item type) */
  selectedItem: Ref<any>;
  /** Type of the currently selected item */
  selectedItemType: Ref<SelectionItemType>;
  /** Computed property that returns true if something is selected */
  hasSelection: ComputedRef<boolean>;
  /** Select an item with its type */
  select: (item: any, type: SelectionItemType) => void;
  /** Clear the current selection */
  deselect: () => void;
  /** Check if a specific item is selected by ID */
  isSelected: (itemId: string) => boolean;
  /** Get the ID of the currently selected item */
  selectedId: ComputedRef<string | null>;
}

/**
 * useEditorSelection - Centralized selection state management
 *
 * Manages selection state across all panels and the inspector.
 * Previously duplicated in:
 * - ClipEditorDialog (selectedItem, selectedItemType)
 * - StickersPanel (selectedStickerId)
 * - TextPanel (selectedTextId)
 *
 * Usage:
 * ```ts
 * const { selectedItem, selectedItemType, select, deselect, isSelected } = useEditorSelection();
 *
 * // Select an item
 * select(audioTrack, 'audio');
 *
 * // Check if selected
 * if (isSelected(someItem.id)) { ... }
 *
 * // Clear selection
 * deselect();
 * ```
 */
export function useEditorSelection(): EditorSelectionReturn {
  const selectedItem = ref<any>(null);
  const selectedItemType = ref<SelectionItemType>(null);

  const hasSelection = computed(() => selectedItem.value !== null);

  const selectedId = computed(() => {
    return selectedItem.value?.id ?? null;
  });

  function select(item: any, type: SelectionItemType): void {
    selectedItem.value = item;
    selectedItemType.value = type;
  }

  function deselect(): void {
    selectedItem.value = null;
    selectedItemType.value = null;
  }

  function isSelected(itemId: string): boolean {
    return selectedItem.value?.id === itemId;
  }

  return {
    selectedItem,
    selectedItemType,
    hasSelection,
    select,
    deselect,
    isSelected,
    selectedId,
  };
}

/**
 * Create a panel-specific selection tracker that syncs with global selection
 *
 * Use this in panels that need to track their own selection state while
 * still participating in the global selection system.
 *
 * @param globalSelection - The global selection state from useEditorSelection
 * @param itemType - The type of items this panel manages
 */
export function usePanelSelection<T extends SelectableItem>(
  globalSelection: EditorSelectionReturn,
  itemType: SelectionItemType
) {
  const localSelectedId = computed(() => {
    if (globalSelection.selectedItemType.value === itemType) {
      return globalSelection.selectedId.value;
    }
    return null;
  });

  function selectItem(item: T): void {
    globalSelection.select(item, itemType);
  }

  function isItemSelected(itemId: string): boolean {
    return localSelectedId.value === itemId;
  }

  return {
    selectedId: localSelectedId,
    selectItem,
    isItemSelected,
  };
}
