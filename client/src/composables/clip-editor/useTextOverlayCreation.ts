/**
 * useTextOverlayCreation - Text overlay creation workflow
 *
 * Extracted from TextPanel.vue to centralize text overlay creation,
 * including default text and template-based creation.
 */

import { ref, type Ref } from 'vue';
import type { TextTemplate, TextOverlayData } from './useTextTemplates';

export interface TextOverlayCreationOptions {
  /** Edit ID for creating overlays */
  editId: Ref<string | null>;
  /** Current playhead time for positioning new overlays */
  currentTime: Ref<number>;
  /** Function to create the text overlay in the database */
  createText: (data: TextOverlayData) => Promise<any>;
  /** Function to create default text data */
  createDefaultTextData: (startTime: number) => TextOverlayData;
  /** Function to create text data from a template */
  createTextData: (template: TextTemplate, startTime: number) => TextOverlayData;
  /** Callback when text is successfully created */
  onTextCreated?: (textId: string, source: 'default' | 'template') => void;
  /** Callback when an error occurs */
  onError?: (error: unknown, source: 'default' | 'template') => void;
}

export interface TextOverlayCreationReturn {
  /** Whether text is currently being created */
  isCreating: Ref<boolean>;
  /** Add a default text overlay */
  addDefaultText: () => Promise<string | null>;
  /** Add text from a template */
  addTextFromTemplate: (template: TextTemplate) => Promise<string | null>;
  /** Add text with custom data */
  addTextWithData: (data: TextOverlayData) => Promise<string | null>;
}

/**
 * Composable for text overlay creation workflow
 */
export function useTextOverlayCreation(options: TextOverlayCreationOptions): TextOverlayCreationReturn {
  const {
    editId,
    currentTime,
    createText,
    createDefaultTextData,
    createTextData,
    onTextCreated,
    onError,
  } = options;

  const isCreating = ref(false);

  /**
   * Add text with custom data
   */
  async function addTextWithData(data: TextOverlayData): Promise<string | null> {
    if (!editId.value) {
      console.warn('[useTextOverlayCreation] No edit ID provided');
      return null;
    }

    isCreating.value = true;

    try {
      const newText = await createText(data);
      return newText.id;
    } catch (error) {
      console.error('[useTextOverlayCreation] Failed to create text overlay:', error);
      throw error;
    } finally {
      isCreating.value = false;
    }
  }

  /**
   * Add a default text overlay at the current time
   */
  async function addDefaultText(): Promise<string | null> {
    if (!editId.value) {
      console.warn('[useTextOverlayCreation] No edit ID provided');
      return null;
    }

    isCreating.value = true;

    try {
      const textData = createDefaultTextData(currentTime.value || 0);
      const newText = await createText(textData);

      console.log('[useTextOverlayCreation] Added text overlay:', newText.id);
      onTextCreated?.(newText.id, 'default');

      return newText.id;
    } catch (error) {
      console.error('[useTextOverlayCreation] Failed to add text:', error);
      onError?.(error, 'default');
      return null;
    } finally {
      isCreating.value = false;
    }
  }

  /**
   * Add text from a template at the current time
   */
  async function addTextFromTemplate(template: TextTemplate): Promise<string | null> {
    if (!editId.value) {
      console.warn('[useTextOverlayCreation] No edit ID provided');
      return null;
    }

    isCreating.value = true;

    try {
      const textData = createTextData(template, currentTime.value || 0);
      const newText = await createText(textData);

      console.log('[useTextOverlayCreation] Added text from template:', template.label);
      onTextCreated?.(newText.id, 'template');

      return newText.id;
    } catch (error) {
      console.error('[useTextOverlayCreation] Failed to add text from template:', error);
      onError?.(error, 'template');
      return null;
    } finally {
      isCreating.value = false;
    }
  }

  return {
    isCreating,
    addDefaultText,
    addTextFromTemplate,
    addTextWithData,
  };
}
