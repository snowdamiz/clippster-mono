import type { VideoEditorStickerRecord } from '@/services/database/video-editor-edits';
import { extractFileName, truncateText } from './useEditorFormatters';

/**
 * Return type for useStickerFormatting
 */
export interface StickerFormattingReturn {
  /** Get sticker preview (emoji or image icon) */
  getStickerPreview: (sticker: VideoEditorStickerRecord) => string;
  /** Get sticker display name */
  getStickerName: (sticker: VideoEditorStickerRecord, maxLength?: number) => string;
}

/**
 * Get sticker preview string
 * Returns the emoji itself for emoji stickers, or a generic image icon for file stickers
 * @param sticker - Sticker record
 * @returns Preview string (emoji character or icon)
 */
export function getStickerPreview(sticker: VideoEditorStickerRecord): string {
  return sticker.sticker_type === 'emoji' ? sticker.sticker_path : '🖼️';
}

/**
 * Get sticker display name
 * Returns "Emoji" for emoji stickers, or the truncated filename for file stickers
 * @param sticker - Sticker record
 * @param maxLength - Maximum length before truncation (default: 20)
 * @returns Display name string
 */
export function getStickerName(sticker: VideoEditorStickerRecord, maxLength: number = 20): string {
  if (sticker.sticker_type === 'emoji') return 'Emoji';
  return truncateText(extractFileName(sticker.sticker_path), maxLength);
}

/**
 * useStickerFormatting - Extract sticker formatting logic
 *
 * Extracted from:
 * - StickersPanel.vue: getStickerPreview() line 169-171, getStickerName() line 174-177
 * - StickerInspector.vue: getStickerPreview() line 137-142
 *
 * This composable consolidates duplicated sticker formatting logic
 * that was present in both the panel and inspector components.
 *
 * Usage:
 * ```ts
 * const { getStickerPreview, getStickerName } = useStickerFormatting();
 *
 * // In template
 * <span>{{ getStickerPreview(sticker) }}</span>
 * <span>{{ getStickerName(sticker) }}</span>
 * ```
 */
export function useStickerFormatting(): StickerFormattingReturn {
  return {
    getStickerPreview,
    getStickerName,
  };
}
