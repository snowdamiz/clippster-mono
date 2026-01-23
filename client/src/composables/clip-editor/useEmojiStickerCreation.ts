import type { Ref } from 'vue';
import type { VideoEditorStickerRecord } from '@/services/database/video-editor-edits';

/**
 * Options for useEmojiStickerCreation
 */
export interface EmojiStickerCreationOptions {
  /** Reference to the current edit ID */
  editId: Ref<string | null>;
  /** Current playhead time for sticker placement */
  currentTime: Ref<number>;
  /** Function to create a sticker (from useStickersCRUD) */
  createSticker: (data: Partial<VideoEditorStickerRecord>) => Promise<VideoEditorStickerRecord>;
  /** Optional callback when creation succeeds */
  onSuccess?: (sticker: VideoEditorStickerRecord) => void;
  /** Optional callback when creation fails */
  onError?: (error: Error) => void;
}

/**
 * Return type for useEmojiStickerCreation
 */
export interface EmojiStickerCreationReturn {
  /** Common emoji options for quick selection */
  commonEmojis: string[];
  /** Add an emoji as a sticker */
  addEmoji: (emoji: string) => Promise<VideoEditorStickerRecord | null>;
}

/**
 * Default sticker duration in seconds
 */
const DEFAULT_EMOJI_DURATION = 3;

/**
 * Common emojis for quick selection
 * Organized by category for easy reference
 */
export const COMMON_EMOJIS = [
  // Faces & Emotions
  '😀', '😂', '🤣', '😍', '😎', '🔥', '💯', '👍',
  // Celebration & Love
  '❤️', '✨', '🎉', '🎊', '🎈', '🏆', '⭐', '💪',
  // Actions & Objects
  '👏', '🙌', '🤝', '💰', '💎', '🚀', '⚡', '💥',
];

/**
 * useEmojiStickerCreation - Extract emoji sticker creation logic
 *
 * Extracted from StickersPanel.vue:
 * - commonEmojis array (lines 100-104)
 * - addEmoji() function (lines 139-160)
 *
 * This composable handles:
 * - Providing a curated list of common emojis
 * - Creating emoji stickers with default positioning and animation
 *
 * Usage:
 * ```ts
 * const { create: createSticker } = useStickersCRUD(editIdRef);
 *
 * const { commonEmojis, addEmoji } = useEmojiStickerCreation({
 *   editId: toRef(props, 'editId'),
 *   currentTime: computed(() => props.currentTime || 0),
 *   createSticker,
 *   onSuccess: (sticker) => emit('stickerAdded', sticker.id),
 * });
 *
 * // In template
 * <button v-for="emoji in commonEmojis" @click="addEmoji(emoji)">
 *   {{ emoji }}
 * </button>
 * ```
 */
export function useEmojiStickerCreation(
  options: EmojiStickerCreationOptions
): EmojiStickerCreationReturn {
  const { editId, currentTime, createSticker, onSuccess, onError } = options;

  /**
   * Add an emoji as a sticker
   * @param emoji - Emoji character to add
   * @returns Created sticker record or null if failed
   */
  async function addEmoji(emoji: string): Promise<VideoEditorStickerRecord | null> {
    if (!editId.value) {
      console.warn('[useEmojiStickerCreation] No edit ID available');
      return null;
    }

    try {
      const startTime = currentTime.value;

      const newSticker = await createSticker({
        sticker_path: emoji,
        sticker_type: 'emoji',
        start_time: startTime,
        end_time: startTime + DEFAULT_EMOJI_DURATION,
        position_x: 50,
        position_y: 50,
        scale: 1.0,
        rotation: 0,
        animation: 'bounce',
      });

      console.log('[useEmojiStickerCreation] Added emoji:', emoji);
      onSuccess?.(newSticker);
      return newSticker;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[useEmojiStickerCreation] Failed to add emoji:', err);
      onError?.(err);
      return null;
    }
  }

  return {
    commonEmojis: COMMON_EMOJIS,
    addEmoji,
  };
}
