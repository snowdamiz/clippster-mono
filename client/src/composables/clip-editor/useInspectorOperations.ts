import { computed, type Ref } from 'vue';
import {
  updateVideoEditorAudioTrack,
  deleteVideoEditorAudioTrack,
  updateVideoEditorTextOverlay,
  deleteVideoEditorTextOverlay,
  updateVideoEditorSticker,
  deleteVideoEditorSticker,
} from '@/services/database/video-editor-edits';

/**
 * Supported item types for inspector operations
 */
export type InspectorItemType = 'audio' | 'text' | 'sticker' | 'watermark' | 'effect' | 'transition' | 'segment' | 'video';

/**
 * Item operation handlers
 */
interface ItemOperations {
  update: (id: string, data: Record<string, any>) => Promise<any>;
  delete: (id: string) => Promise<any>;
  label: string;
}

/**
 * Map of item types to their operations
 * Extensible for new item types (watermark, effect, transition)
 */
const ITEM_OPERATIONS: Partial<Record<InspectorItemType, ItemOperations>> = {
  audio: {
    update: updateVideoEditorAudioTrack,
    delete: deleteVideoEditorAudioTrack,
    label: 'Audio Track',
  },
  text: {
    update: updateVideoEditorTextOverlay,
    delete: deleteVideoEditorTextOverlay,
    label: 'Text Overlay',
  },
  sticker: {
    update: updateVideoEditorSticker,
    delete: deleteVideoEditorSticker,
    label: 'Sticker',
  },
};

/**
 * Labels for item types that don't have operations yet
 */
const ITEM_LABELS: Record<string, string> = {
  segment: 'Video Segment',
  video: 'Video Segment',
  audio: 'Audio Track',
  text: 'Text Overlay',
  sticker: 'Sticker',
  effect: 'Effect',
  transition: 'Transition',
  watermark: 'Watermark',
};

/**
 * Options for useInspectorOperations
 */
export interface InspectorOperationsOptions {
  /** The currently selected item */
  selectedItem: Ref<any>;
  /** The type of the selected item */
  selectedItemType: Ref<string | null>;
  /** Callback when an update succeeds */
  onUpdate?: (property: string, value: any) => void;
  /** Callback when a delete succeeds */
  onDelete?: () => void;
}

/**
 * Return type for useInspectorOperations
 */
export interface InspectorOperationsReturn {
  /** Update a property on the selected item */
  updateProperty: (property: string, value: any) => Promise<void>;
  /** Delete the selected item */
  deleteItem: () => Promise<void>;
  /** Label for the current item type */
  typeLabel: Ref<string>;
  /** Whether the current item type supports operations */
  hasOperations: Ref<boolean>;
}

/**
 * useInspectorOperations - Centralized inspector operations for all item types
 *
 * Extracts the repetitive if-else dispatch pattern from ClipEditorInspector.vue
 * into a reusable, type-safe composable.
 *
 * Usage:
 * ```ts
 * const { updateProperty, deleteItem, typeLabel } = useInspectorOperations({
 *   selectedItem: toRef(props, 'selectedItem'),
 *   selectedItemType: toRef(props, 'selectedItemType'),
 *   onUpdate: (property, value) => emit('update', { property, value }),
 *   onDelete: () => emit('itemDeleted'),
 * });
 * ```
 */
export function useInspectorOperations(options: InspectorOperationsOptions): InspectorOperationsReturn {
  const { selectedItem, selectedItemType, onUpdate, onDelete } = options;

  /**
   * Update a property on the selected item
   */
  async function updateProperty(property: string, value: any): Promise<void> {
    const item = selectedItem.value;
    const type = selectedItemType.value as InspectorItemType | null;

    if (!item?.id || !type) return;

    const operations = ITEM_OPERATIONS[type];
    if (!operations) {
      console.warn(`[useInspectorOperations] No update operation for type: ${type}`);
      return;
    }

    try {
      await operations.update(item.id, { [property]: value });
      onUpdate?.(property, value);
    } catch (error) {
      console.error(`[useInspectorOperations] Failed to update ${type}:`, error);
      throw error;
    }
  }

  /**
   * Delete the selected item
   */
  async function deleteItem(): Promise<void> {
    const item = selectedItem.value;
    const type = selectedItemType.value as InspectorItemType | null;

    if (!item?.id || !type) return;

    const operations = ITEM_OPERATIONS[type];
    if (!operations) {
      console.warn(`[useInspectorOperations] No delete operation for type: ${type}`);
      return;
    }

    try {
      await operations.delete(item.id);
      onDelete?.();
    } catch (error) {
      console.error(`[useInspectorOperations] Failed to delete ${type}:`, error);
      throw error;
    }
  }

  /**
   * Label for the current item type
   */
  const typeLabel = computed(() => {
    const type = selectedItemType.value;
    if (!type) return 'Item';
    return ITEM_LABELS[type] || 'Item';
  });

  /**
   * Whether the current item type supports operations
   */
  const hasOperations = computed(() => {
    const type = selectedItemType.value as InspectorItemType | null;
    return type ? !!ITEM_OPERATIONS[type] : false;
  });

  return {
    updateProperty,
    deleteItem,
    typeLabel,
    hasOperations,
  };
}
