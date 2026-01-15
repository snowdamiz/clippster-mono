import { ref, type Ref } from 'vue';
import type { TextOverlay, Sticker, ClipWatermark, AudioTrack, ClipEditorTab } from '@/types';
import type { Keyframe, ItemType, AnimationProperty } from '@/types/timeline-model';

/**
 * Type for the selected keyframe state
 */
export interface SelectedKeyframe {
  id: string;
  itemId: string;
  type: 'source' | 'audio' | 'text' | 'sticker' | 'watermark' | 'effect' | 'filter';
  keyframe: Keyframe;
}

/**
 * Type for keyframe select event data
 */
export interface KeyframeSelectData {
  itemId: string;
  keyframeId: string;
  type: ItemType;
}

/**
 * Type for add keyframe data
 */
export interface AddKeyframeData {
  itemId: string;
  type: 'text' | 'sticker' | 'watermark' | 'audio' | 'source';
  property: AnimationProperty;
  time: number;
  value: number;
}

/**
 * Type for update keyframe time data
 */
export interface UpdateKeyframeTimeData {
  itemId: string;
  keyframeId: string;
  time: number;
  type: 'source' | 'audio' | 'text' | 'sticker' | 'watermark' | 'effect' | 'filter';
}

/**
 * Options for the useKeyframeOperations composable
 */
export interface UseKeyframeOperationsOptions {
  textOverlays: Ref<TextOverlay[]>;
  stickers: Ref<Sticker[]>;
  watermarks: Ref<ClipWatermark[]>;
  audioTracks: Ref<AudioTrack[]>;
  updateTextOverlayLocal: (id: string, updates: Partial<TextOverlay>) => Promise<void>;
  updateStickerLocal: (id: string, updates: Partial<Sticker>) => Promise<void>;
  updateWatermarkLocal: (id: string, updates: Partial<ClipWatermark>) => Promise<void>;
  updateAudioTrackLocal: (id: string, updates: Partial<AudioTrack>) => Promise<void>;
  setActiveTab: (tab: ClipEditorTab) => void;
  triggerAutoSave: () => void;
}

/**
 * Composable for managing keyframe operations on timeline items.
 * Handles selection, update, delete, and add operations for keyframes
 * on text overlays, stickers, watermarks, and audio tracks.
 */
export function useKeyframeOperations(options: UseKeyframeOperationsOptions) {
  const {
    textOverlays,
    stickers,
    watermarks,
    audioTracks,
    updateTextOverlayLocal,
    updateStickerLocal,
    updateWatermarkLocal,
    updateAudioTrackLocal,
    setActiveTab,
    triggerAutoSave,
  } = options;

  // Selected keyframe state
  const selectedKeyframe = ref<SelectedKeyframe | null>(null);

  /**
   * Handle keyframe selection from the timeline.
   * Finds the item and keyframe, sets the selected state, and switches to the appropriate tab.
   */
  function handleKeyframeSelect(data: KeyframeSelectData) {
    // Find the item and keyframe
    let item: any;
    if (data.type === 'text') item = textOverlays.value.find((i) => i.id === data.itemId);
    else if (data.type === 'sticker') item = stickers.value.find((i) => i.id === data.itemId);
    else if (data.type === 'watermark') item = watermarks.value.find((i) => i.id === data.itemId);
    else if (data.type === 'audio') item = audioTracks.value.find((i) => i.id === data.itemId);

    if (item && item.keyframes) {
      const keyframe = item.keyframes.find((k: Keyframe) => k.id === data.keyframeId);
      if (keyframe) {
        selectedKeyframe.value = {
          id: data.keyframeId,
          itemId: data.itemId,
          type: data.type as SelectedKeyframe['type'],
          keyframe: { ...keyframe }, // Copy to avoid direct mutation
        };
        // Switch to the appropriate tab so the inspector makes sense in context
        if (data.type === 'text') setActiveTab('overlays');
        else if (data.type === 'sticker') setActiveTab('overlays');
        else if (data.type === 'watermark') setActiveTab('watermark');
        else if (data.type === 'audio') setActiveTab('audio');
      }
    }
  }

  /**
   * Update the currently selected keyframe with new values.
   */
  async function updateKeyframe(updates: Partial<Keyframe>) {
    if (!selectedKeyframe.value) return;

    const { itemId, type, id } = selectedKeyframe.value;

    // Update local state first
    selectedKeyframe.value.keyframe = { ...selectedKeyframe.value.keyframe, ...updates };

    // Update the item's keyframes
    if (type === 'text') {
      const item = textOverlays.value.find((i) => i.id === itemId);
      if (item && item.keyframes) {
        const index = item.keyframes.findIndex((k) => k.id === id);
        if (index !== -1) {
          const newKeyframes = [...item.keyframes];
          newKeyframes[index] = { ...newKeyframes[index], ...updates } as Keyframe;
          await updateTextOverlayLocal(itemId, { keyframes: newKeyframes });
        }
      }
    } else if (type === 'sticker') {
      const item = stickers.value.find((i) => i.id === itemId);
      if (item && item.keyframes) {
        const index = item.keyframes.findIndex((k) => k.id === id);
        if (index !== -1) {
          const newKeyframes = [...item.keyframes];
          newKeyframes[index] = { ...newKeyframes[index], ...updates } as Keyframe;
          await updateStickerLocal(itemId, { keyframes: newKeyframes });
        }
      }
    } else if (type === 'watermark') {
      const item = watermarks.value.find((i) => i.id === itemId);
      if (item && item.keyframes) {
        const index = item.keyframes.findIndex((k) => k.id === id);
        if (index !== -1) {
          const newKeyframes = [...item.keyframes];
          newKeyframes[index] = { ...newKeyframes[index], ...updates } as Keyframe;
          await updateWatermarkLocal(itemId, { keyframes: newKeyframes });
        }
      }
    } else if (type === 'audio') {
      const item = audioTracks.value.find((i) => i.id === itemId);
      if (item && item.keyframes) {
        const index = item.keyframes.findIndex((k) => k.id === id);
        if (index !== -1) {
          const newKeyframes = [...item.keyframes];
          newKeyframes[index] = { ...newKeyframes[index], ...updates } as Keyframe;
          await updateAudioTrackLocal(itemId, { keyframes: newKeyframes });
        }
      }
    }
  }

  /**
   * Delete the currently selected keyframe.
   */
  async function deleteKeyframe() {
    if (!selectedKeyframe.value) return;

    const { itemId, type, id } = selectedKeyframe.value;

    if (type === 'text') {
      const item = textOverlays.value.find((i) => i.id === itemId);
      if (item && item.keyframes) {
        const newKeyframes = item.keyframes.filter((k) => k.id !== id);
        await updateTextOverlayLocal(itemId, { keyframes: newKeyframes });
      }
    } else if (type === 'sticker') {
      const item = stickers.value.find((i) => i.id === itemId);
      if (item && item.keyframes) {
        const newKeyframes = item.keyframes.filter((k) => k.id !== id);
        await updateStickerLocal(itemId, { keyframes: newKeyframes });
      }
    } else if (type === 'watermark') {
      const item = watermarks.value.find((i) => i.id === itemId);
      if (item && item.keyframes) {
        const newKeyframes = item.keyframes.filter((k) => k.id !== id);
        await updateWatermarkLocal(itemId, { keyframes: newKeyframes });
      }
    } else if (type === 'audio') {
      const item = audioTracks.value.find((i) => i.id === itemId);
      if (item && item.keyframes) {
        const newKeyframes = item.keyframes.filter((k) => k.id !== id);
        await updateAudioTrackLocal(itemId, { keyframes: newKeyframes });
      }
    }

    selectedKeyframe.value = null;
  }

  /**
   * Add a new keyframe to an item.
   */
  async function addKeyframe(data: AddKeyframeData) {
    const newKeyframe: Keyframe = {
      id: `kf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      property: data.property,
      time: data.time,
      value: data.value,
      easing: 'linear',
    };

    if (data.type === 'text') {
      const item = textOverlays.value.find((i) => i.id === data.itemId);
      if (item) {
        const newKeyframes = [...(item.keyframes || []), newKeyframe];
        await updateTextOverlayLocal(data.itemId, { keyframes: newKeyframes });
      }
    } else if (data.type === 'sticker') {
      const item = stickers.value.find((i) => i.id === data.itemId);
      if (item) {
        const newKeyframes = [...(item.keyframes || []), newKeyframe];
        await updateStickerLocal(data.itemId, { keyframes: newKeyframes });
      }
    } else if (data.type === 'watermark') {
      const item = watermarks.value.find((i) => i.id === data.itemId);
      if (item) {
        const newKeyframes = [...(item.keyframes || []), newKeyframe];
        await updateWatermarkLocal(data.itemId, { keyframes: newKeyframes });
      }
    } else if (data.type === 'audio') {
      const item = audioTracks.value.find((i) => i.id === data.itemId);
      if (item) {
        const newKeyframes = [...(item.keyframes || []), newKeyframe];
        await updateAudioTrackLocal(data.itemId, { keyframes: newKeyframes });
      }
    }

    triggerAutoSave();
  }

  /**
   * Update the time of a specific keyframe on an item.
   */
  async function updateKeyframeTime(data: UpdateKeyframeTimeData) {
    const { itemId, keyframeId, time, type } = data;

    if (type === 'text') {
      const item = textOverlays.value.find((i) => i.id === itemId);
      if (item && item.keyframes) {
        const keyframeIndex = item.keyframes.findIndex((k) => k.id === keyframeId);
        if (keyframeIndex !== -1) {
          const updatedKeyframes = [...item.keyframes];
          updatedKeyframes[keyframeIndex] = { ...updatedKeyframes[keyframeIndex], time };
          await updateTextOverlayLocal(itemId, { keyframes: updatedKeyframes });
        }
      }
    } else if (type === 'sticker') {
      const item = stickers.value.find((i) => i.id === itemId);
      if (item && item.keyframes) {
        const keyframeIndex = item.keyframes.findIndex((k) => k.id === keyframeId);
        if (keyframeIndex !== -1) {
          const updatedKeyframes = [...item.keyframes];
          updatedKeyframes[keyframeIndex] = { ...updatedKeyframes[keyframeIndex], time };
          await updateStickerLocal(itemId, { keyframes: updatedKeyframes });
        }
      }
    } else if (type === 'watermark') {
      const item = watermarks.value.find((i) => i.id === itemId);
      if (item && item.keyframes) {
        const keyframeIndex = item.keyframes.findIndex((k) => k.id === keyframeId);
        if (keyframeIndex !== -1) {
          const updatedKeyframes = [...item.keyframes];
          updatedKeyframes[keyframeIndex] = { ...updatedKeyframes[keyframeIndex], time };
          await updateWatermarkLocal(itemId, { keyframes: updatedKeyframes });
        }
      }
    }
  }

  return {
    selectedKeyframe,
    handleKeyframeSelect,
    updateKeyframe,
    deleteKeyframe,
    addKeyframe,
    updateKeyframeTime,
  };
}
