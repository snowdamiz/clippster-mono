/**
 * Composable for exporting image editor designs as watermark images
 * that can be used in creator profiles and video builds.
 */

import { createWatermarkImage } from '@/services/database/watermarks';
import { createImageAsset } from '@/services/database/image-assets';

export interface SaveAsWatermarkOptions {
  /** The image blob to save */
  blob: Blob;
  /** Name for the watermark */
  name: string;
  /** Image dimensions */
  width?: number;
  height?: number;
}

export function useWatermarkExport() {
  /**
   * Save a blob as a watermark image in the local database.
   * Creates both a watermark_images record and an image_assets record.
   * Returns the watermark ID.
   */
  async function saveAsWatermark(options: SaveAsWatermarkOptions): Promise<string | null> {
    const { blob, name, width, height } = options;

    try {
      const { appDataDir } = await import('@tauri-apps/api/path');
      const { writeFile, mkdir, exists } = await import('@tauri-apps/plugin-fs');

      const appData = await appDataDir();
      const watermarkDir = `${appData}/watermarks`;
      if (!(await exists(watermarkDir))) {
        await mkdir(watermarkDir, { recursive: true });
      }

      const filePath = `${watermarkDir}/${name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.png`;

      const arrayBuffer = await blob.arrayBuffer();
      await writeFile(filePath, new Uint8Array(arrayBuffer));

      // Create watermark record
      const watermarkId = await createWatermarkImage(
        name,
        filePath,
        width,
        height,
        blob.size,
      );

      // Also create image asset record for gallery
      await createImageAsset({
        name,
        filePath,
        width,
        height,
        fileSize: blob.size,
        mimeType: 'image/png',
        imageType: 'watermark',
        sourceType: 'editor',
      });

      return watermarkId;
    } catch (error) {
      console.error('[useWatermarkExport] Failed to save watermark:', error);
      return null;
    }
  }

  return {
    saveAsWatermark,
  };
}
