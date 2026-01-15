import type { Ref, ComputedRef } from 'vue';
import type { TextOverlay, Sticker, ClipWatermark } from '@/types';
import {
  createTextOverlay,
  updateTextOverlay,
  deleteTextOverlay,
  createSticker,
  updateSticker,
  deleteSticker,
  createWatermark,
  updateWatermarkRecord,
  deleteWatermarkRecord,
} from '@/services/database';
import {
  createVideoEditorTextOverlay,
  updateVideoEditorTextOverlay,
  deleteVideoEditorTextOverlay,
  createVideoEditorSticker,
  updateVideoEditorSticker,
  deleteVideoEditorSticker,
  createVideoEditorWatermark,
  updateVideoEditorWatermark,
  deleteVideoEditorWatermark,
} from '@/services/database/video-editor-edits';

export interface UseOverlayOperationsOptions {
  editorMode: ComputedRef<boolean>;
  clipEditId: Ref<string | null>;
  videoEditorEditId: Ref<string | null>;
  textOverlays: Ref<TextOverlay[]>;
  stickers: Ref<Sticker[]>;
  watermarks: Ref<ClipWatermark[]>;
  effectivePreviewTime: ComputedRef<number>;
  totalSegmentDuration: ComputedRef<number>;
  getOverlayContainerHeight: () => number | undefined;
}

export function useOverlayOperations(options: UseOverlayOperationsOptions) {
  const {
    editorMode,
    clipEditId,
    videoEditorEditId,
    textOverlays,
    stickers,
    watermarks,
    effectivePreviewTime,
    totalSegmentDuration,
    getOverlayContainerHeight,
  } = options;

  // ============================================
  // Text Overlay Operations
  // ============================================

  async function addTextOverlay(text: string, style: any) {
    const editId = editorMode.value ? videoEditorEditId.value : clipEditId.value;
    if (!editId) return;

    // Use effective time (accounting for segment cuts) for the overlay timing
    const effectiveStartTime = effectivePreviewTime.value;
    const effectiveEndTime = Math.min(effectiveStartTime + 3, totalSegmentDuration.value);

    // Get the current preview container height for proper font scaling on export
    const currentPreviewHeight = getOverlayContainerHeight() ?? 400;

    const overlayData = {
      text,
      start_time: effectiveStartTime,
      end_time: effectiveEndTime,
      position_x: 50,
      position_y: 50, // Default to center
      style_data: JSON.stringify(style),
      animation: 'fade',
      preview_height: currentPreviewHeight,
    };

    // Use appropriate database function based on mode
    const overlay = editorMode.value
      ? await createVideoEditorTextOverlay(editId, overlayData)
      : await createTextOverlay(editId, overlayData);

    textOverlays.value.push({
      id: overlay.id,
      text: overlay.text,
      startTime: overlay.start_time,
      endTime: overlay.end_time,
      position: { x: overlay.position_x, y: overlay.position_y },
      style,
      animation: overlay.animation as any,
      previewHeight: currentPreviewHeight,
    });
  }

  async function updateTextOverlayLocal(overlayId: string, updates: Partial<TextOverlay>) {
    // If style is being updated (font size, etc.), capture current preview height
    let currentPreviewHeight: number | undefined;
    if (updates.style || updates.perRatioConfigs) {
      currentPreviewHeight = getOverlayContainerHeight() ?? undefined;
    }

    const updateData: Record<string, any> = {
      text: updates.text,
      start_time: updates.startTime,
      end_time: updates.endTime,
      position_x: updates.position?.x,
      position_y: updates.position?.y,
      style_data: updates.style ? JSON.stringify(updates.style) : undefined,
      per_ratio_configs_data: updates.perRatioConfigs
        ? JSON.stringify(updates.perRatioConfigs)
        : undefined,
      preview_height: currentPreviewHeight,
      animation: updates.animation,
      keyframes_data: updates.keyframes ? JSON.stringify(updates.keyframes) : undefined,
    };

    // Handle layer property for multi-track support
    if (updates.layer !== undefined) {
      updateData.layer = updates.layer;
    }

    // Use appropriate database function based on mode
    if (editorMode.value) {
      await updateVideoEditorTextOverlay(overlayId, updateData);
    } else {
      await updateTextOverlay(overlayId, updateData);
    }

    const overlay = textOverlays.value.find((o) => o.id === overlayId);
    if (overlay) {
      Object.assign(overlay, updates);
      if (currentPreviewHeight !== undefined) {
        overlay.previewHeight = currentPreviewHeight;
      }
    }
  }

  async function deleteTextOverlayLocal(overlayId: string) {
    // Use appropriate database function based on mode
    if (editorMode.value) {
      await deleteVideoEditorTextOverlay(overlayId);
    } else {
      await deleteTextOverlay(overlayId);
    }
    textOverlays.value = textOverlays.value.filter((o) => o.id !== overlayId);
  }

  async function splitTextOverlayLocal(overlayId: string, cutTime: number) {
    if (!videoEditorEditId.value) return;

    const { splitVideoEditorTextOverlay } = await import('@/services/database/video-editor-edits');
    const { left, right } = await splitVideoEditorTextOverlay(
      videoEditorEditId.value,
      overlayId,
      cutTime
    );

    const index = textOverlays.value.findIndex((t) => t.id === overlayId);
    if (index !== -1) {
      textOverlays.value[index] = {
        id: left.id,
        text: left.text,
        startTime: left.start_time,
        endTime: left.end_time,
        position: { x: left.position_x, y: left.position_y },
        style: JSON.parse(left.style_data || '{}'),
        animation: left.animation as any,
      };
      textOverlays.value.push({
        id: right.id,
        text: right.text,
        startTime: right.start_time,
        endTime: right.end_time,
        position: { x: right.position_x, y: right.position_y },
        style: JSON.parse(right.style_data || '{}'),
        animation: right.animation as any,
      });
    }
  }

  // ============================================
  // Sticker Operations
  // ============================================

  async function addStickerLocal(
    stickerPath: string,
    type: 'emoji' | 'image' | 'gif',
    stickerOptions?: { scale?: number; position?: { x: number; y: number } }
  ) {
    const editId = editorMode.value ? videoEditorEditId.value : clipEditId.value;
    if (!editId) return;

    // Use effective time (accounting for segment cuts) for sticker timing
    const effectiveStartTime = effectivePreviewTime.value;
    const effectiveEndTime = Math.min(effectiveStartTime + 3, totalSegmentDuration.value);

    const stickerData = {
      sticker_path: stickerPath,
      sticker_type: type,
      start_time: effectiveStartTime,
      end_time: effectiveEndTime,
      position_x: stickerOptions?.position?.x ?? 50,
      position_y: stickerOptions?.position?.y ?? 50,
      scale: stickerOptions?.scale ?? 1,
      rotation: 0,
      animation: 'none',
    };

    // Use appropriate database function based on mode
    const sticker = editorMode.value
      ? await createVideoEditorSticker(editId, stickerData)
      : await createSticker(editId, stickerData);

    stickers.value.push({
      id: sticker.id,
      stickerPath: sticker.sticker_path,
      stickerType: sticker.sticker_type as any,
      startTime: sticker.start_time,
      endTime: sticker.end_time,
      position: { x: sticker.position_x, y: sticker.position_y },
      scale: sticker.scale,
      rotation: sticker.rotation,
      animation: sticker.animation as any,
    });
  }

  async function updateStickerLocal(stickerId: string, updates: Partial<Sticker>) {
    const updateData: Record<string, any> = {
      sticker_path: updates.stickerPath,
      sticker_type: updates.stickerType,
      start_time: updates.startTime,
      end_time: updates.endTime,
      position_x: updates.position?.x,
      position_y: updates.position?.y,
      scale: updates.scale,
      rotation: updates.rotation,
      animation: updates.animation,
      per_ratio_configs_data: updates.perRatioConfigs
        ? JSON.stringify(updates.perRatioConfigs)
        : undefined,
      keyframes_data: updates.keyframes ? JSON.stringify(updates.keyframes) : undefined,
    };

    // Handle layer property for multi-track support
    if (updates.layer !== undefined) {
      updateData.layer = updates.layer;
    }

    // Use appropriate database function based on mode
    if (editorMode.value) {
      await updateVideoEditorSticker(stickerId, updateData);
    } else {
      await updateSticker(stickerId, updateData);
    }

    const sticker = stickers.value.find((s) => s.id === stickerId);
    if (sticker) {
      Object.assign(sticker, updates);
    }
  }

  async function deleteStickerLocal(stickerId: string) {
    // Use appropriate database function based on mode
    if (editorMode.value) {
      await deleteVideoEditorSticker(stickerId);
    } else {
      await deleteSticker(stickerId);
    }
    stickers.value = stickers.value.filter((s) => s.id !== stickerId);
  }

  async function splitStickerLocal(stickerId: string, cutTime: number) {
    if (!videoEditorEditId.value) return;

    const { splitVideoEditorSticker } = await import('@/services/database/video-editor-edits');
    const { left, right } = await splitVideoEditorSticker(
      videoEditorEditId.value,
      stickerId,
      cutTime
    );

    const index = stickers.value.findIndex((s) => s.id === stickerId);
    if (index !== -1) {
      stickers.value[index] = {
        id: left.id,
        stickerPath: left.sticker_path,
        stickerType: left.sticker_type as any,
        startTime: left.start_time,
        endTime: left.end_time,
        position: { x: left.position_x, y: left.position_y },
        scale: left.scale,
        rotation: left.rotation,
        animation: left.animation as any,
      };
      stickers.value.push({
        id: right.id,
        stickerPath: right.sticker_path,
        stickerType: right.sticker_type as any,
        startTime: right.start_time,
        endTime: right.end_time,
        position: { x: right.position_x, y: right.position_y },
        scale: right.scale,
        rotation: right.rotation,
        animation: right.animation as any,
      });
    }
  }

  // ============================================
  // Watermark Operations
  // ============================================

  async function addWatermarkLocal(watermarkId: string, filePath: string, previewUrl: string) {
    const editId = editorMode.value ? videoEditorEditId.value : clipEditId.value;
    if (!editId) return;

    // By default, watermark spans the entire clip duration (100% of clip)
    const startTime = 0;
    const endTime = totalSegmentDuration.value;

    console.log('[useOverlayOperations] Adding watermark with duration:', {
      startTime,
      endTime,
      totalSegmentDuration: totalSegmentDuration.value,
      editorMode: editorMode.value,
    });

    const watermarkData = {
      watermark_id: watermarkId,
      watermark_path: filePath, // File path for FFmpeg export
      preview_url: previewUrl, // Data URL for preview display
      start_time: startTime,
      end_time: endTime,
      position_x: 85, // Bottom right area
      position_y: 85,
      scale: 25, // ~167% CSS scale (25/15) - good visible default
      opacity: 80,
    };

    // Use appropriate database function based on mode
    const watermark = editorMode.value
      ? await createVideoEditorWatermark(editId, watermarkData)
      : await createWatermark(editId, watermarkData);

    watermarks.value.push({
      id: watermark.id,
      watermarkId: watermark.watermark_id,
      filePath: filePath, // Actual file path for export
      previewUrl: previewUrl, // Data URL for preview display
      startTime: watermark.start_time,
      endTime: watermark.end_time,
      position: { x: watermark.position_x, y: watermark.position_y },
      scale: watermark.scale,
      opacity: watermark.opacity,
    });
  }

  async function updateWatermarkLocal(watermarkId: string, updates: Partial<ClipWatermark>) {
    const updateData: Record<string, any> = {
      watermark_id: updates.watermarkId,
      watermark_path: updates.filePath,
      start_time: updates.startTime,
      end_time: updates.endTime,
      position_x: updates.position?.x,
      position_y: updates.position?.y,
      scale: updates.scale,
      opacity: updates.opacity,
      per_ratio_configs_data: updates.perRatioConfigs
        ? JSON.stringify(updates.perRatioConfigs)
        : undefined,
      keyframes_data: updates.keyframes ? JSON.stringify(updates.keyframes) : undefined,
    };

    // Handle layer property for multi-track support
    if (updates.layer !== undefined) {
      updateData.layer = updates.layer;
    }

    // Use appropriate database function based on mode
    if (editorMode.value) {
      await updateVideoEditorWatermark(watermarkId, updateData);
    } else {
      await updateWatermarkRecord(watermarkId, updateData);
    }

    const watermark = watermarks.value.find((w) => w.id === watermarkId);
    if (watermark) {
      Object.assign(watermark, updates);
    }
  }

  async function deleteWatermarkLocal(watermarkId: string) {
    // Use appropriate database function based on mode
    if (editorMode.value) {
      await deleteVideoEditorWatermark(watermarkId);
    } else {
      await deleteWatermarkRecord(watermarkId);
    }
    watermarks.value = watermarks.value.filter((w) => w.id !== watermarkId);
  }

  async function splitWatermarkLocal(watermarkId: string, cutTime: number) {
    if (!videoEditorEditId.value) return;

    const { splitVideoEditorWatermark } = await import('@/services/database/video-editor-edits');
    const { left, right } = await splitVideoEditorWatermark(
      videoEditorEditId.value,
      watermarkId,
      cutTime
    );

    // Update local state
    const index = watermarks.value.findIndex((w) => w.id === watermarkId);
    if (index !== -1) {
      watermarks.value[index] = {
        id: left.id,
        watermarkId: left.watermark_id,
        filePath: left.watermark_path,
        previewUrl: left.preview_url || '',
        startTime: left.start_time,
        endTime: left.end_time,
        position: { x: left.position_x, y: left.position_y },
        scale: left.scale,
        opacity: left.opacity,
      };
      watermarks.value.push({
        id: right.id,
        watermarkId: right.watermark_id,
        filePath: right.watermark_path,
        previewUrl: right.preview_url || '',
        startTime: right.start_time,
        endTime: right.end_time,
        position: { x: right.position_x, y: right.position_y },
        scale: right.scale,
        opacity: right.opacity,
      });
    }
  }

  return {
    // Text overlay operations
    addTextOverlay,
    updateTextOverlayLocal,
    deleteTextOverlayLocal,
    splitTextOverlayLocal,
    // Sticker operations
    addStickerLocal,
    updateStickerLocal,
    deleteStickerLocal,
    splitStickerLocal,
    // Watermark operations
    addWatermarkLocal,
    updateWatermarkLocal,
    deleteWatermarkLocal,
    splitWatermarkLocal,
  };
}
