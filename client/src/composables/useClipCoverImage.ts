/**
 * Composable for managing clip cover images.
 * Allows setting a custom cover image from the image editor or gallery.
 */

import { invoke } from '@tauri-apps/api/core';
import { updateClip } from '@/services/database/clips';
import { createImageAsset } from '@/services/database/image-assets';
import type { Clip } from '@/services/database/types';

export interface SetCoverImageOptions {
  clipId: string;
  /** Path to the image file on disk */
  imagePath: string;
  /** Optional image asset ID if already saved */
  imageAssetId?: string;
  /** Image dimensions */
  width?: number;
  height?: number;
}

export function useClipCoverImage() {
  /**
   * Set a cover image for a clip from a file path.
   * Creates an image asset record and updates the clip.
   */
  async function setCoverImage(options: SetCoverImageOptions): Promise<void> {
    const { clipId, imagePath, imageAssetId, width, height } = options;

    let assetId = imageAssetId;

    // Create image asset if not provided
    if (!assetId) {
      const fileName = imagePath.split(/[\\/]/).pop() || 'cover_image';
      assetId = await createImageAsset({
        name: fileName,
        filePath: imagePath,
        width,
        height,
        imageType: 'cover',
        sourceType: 'editor',
        sourceClipId: clipId,
      });
    }

    // Update the clip with cover image info
    await updateClip(clipId, {
      cover_image_id: assetId,
      cover_image_path: imagePath,
    });
  }

  /**
   * Remove the cover image from a clip (revert to auto-generated thumbnail).
   */
  async function removeCoverImage(clipId: string): Promise<void> {
    await updateClip(clipId, {
      cover_image_id: null,
      cover_image_path: null,
    });
  }

  /**
   * Get the display thumbnail for a clip, preferring cover image over built thumbnail.
   */
  function getClipDisplayThumbnailPath(clip: Clip): string | null {
    return clip.cover_image_path || clip.built_thumbnail_path || null;
  }

  /**
   * Open the design studio to create a cover image for a specific clip.
   */
  function getDesignStudioUrlForClip(clipId: string): string {
    return `/design-studio/edit?coverForClip=${clipId}`;
  }

  return {
    setCoverImage,
    removeCoverImage,
    getClipDisplayThumbnailPath,
    getDesignStudioUrlForClip,
  };
}
