import type { Ref, ComputedRef } from 'vue';
import type {
  IntroOutro,
  VideoEditorSource,
  AudioTrack,
  TextOverlay,
  Sticker,
  ClipWatermark,
  FilterSegment,
} from '@/types';
import {
  createVideoEditorSource,
  updateVideoEditorSource,
  deleteVideoEditorSource,
  recalculateProjectDuration,
} from '@/services/database';
import { invoke } from '@tauri-apps/api/core';

// Applied intro/outro state - tracks currently applied intro and outro in the timeline
export interface AppliedIntroOutro {
  id: string;
  sourceId: string; // The video source ID in the timeline
  name: string;
  duration: number | null;
  filePath: string;
  thumbnailUrl?: string;
  // Org asset properties (for on-demand downloading during export)
  isOrgAsset?: boolean;
  serverId?: number;
  serverUrl?: string;
  organization_id?: string | null;
  organization_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

// Extended intro/outro type that may include org asset properties
export interface IntroOutroWithOrgProps extends IntroOutro {
  isOrgAsset?: boolean;
  serverId?: number;
  serverUrl?: string;
}

export interface UseIntroOutroOperationsOptions {
  editorMode: ComputedRef<boolean>;
  editorProjectId: ComputedRef<string | null>;
  videoEditorEditId: Ref<string | null>;
  clipEditId: Ref<string | null>;
  videoSources: Ref<VideoEditorSource[]>;
  audioTracks: Ref<AudioTrack[]>;
  textOverlays: Ref<TextOverlay[]>;
  stickers: Ref<Sticker[]>;
  watermarks: Ref<ClipWatermark[]>;
  filterSegments: Ref<FilterSegment[]>;
  currentIntro: Ref<AppliedIntroOutro | null>;
  currentOutro: Ref<AppliedIntroOutro | null>;
  triggerAutoSave: () => void;
  updateAudioTrackLocal: (id: string, updates: Partial<AudioTrack>) => Promise<void>;
  updateTextOverlayLocal: (id: string, updates: Partial<TextOverlay>) => Promise<void>;
  updateStickerLocal: (id: string, updates: Partial<Sticker>) => Promise<void>;
  updateWatermarkLocal: (id: string, updates: Partial<ClipWatermark>) => Promise<void>;
  repairSourceOrderIndex: () => Promise<void>;
}

export function useIntroOutroOperations(options: UseIntroOutroOperationsOptions) {
  const {
    editorMode,
    editorProjectId,
    videoEditorEditId,
    clipEditId,
    videoSources,
    audioTracks,
    textOverlays,
    stickers,
    watermarks,
    filterSegments,
    currentIntro,
    currentOutro,
    triggerAutoSave,
    updateAudioTrackLocal,
    updateTextOverlayLocal,
    updateStickerLocal,
    updateWatermarkLocal,
    repairSourceOrderIndex,
  } = options;

  // Helper to remove intro source from timeline
  async function removeIntroSource(sourceId: string) {
    await deleteVideoEditorSource(sourceId);
    videoSources.value = videoSources.value.filter((s) => s.id !== sourceId);
  }

  // Helper to remove outro source from timeline
  async function removeOutroSource(sourceId: string) {
    await deleteVideoEditorSource(sourceId);
    videoSources.value = videoSources.value.filter((s) => s.id !== sourceId);
  }

  // Helper to shift all tracks (audio, text, stickers, watermarks) by a time offset
  async function shiftAllTracksBy(offsetSeconds: number) {
    const editId = editorMode.value ? videoEditorEditId.value : clipEditId.value;
    if (!editId) return;

    // Shift audio tracks
    for (const track of audioTracks.value) {
      const newStartTime = Math.max(0, track.startTime + offsetSeconds);
      const newEndTime = track.endTime + offsetSeconds;
      await updateAudioTrackLocal(track.id, {
        startTime: newStartTime,
        endTime: newEndTime,
      });
    }

    // Shift text overlays
    for (const overlay of textOverlays.value) {
      const newStartTime = Math.max(0, overlay.startTime + offsetSeconds);
      const newEndTime = overlay.endTime + offsetSeconds;
      await updateTextOverlayLocal(overlay.id, {
        startTime: newStartTime,
        endTime: newEndTime,
      });
    }

    // Shift stickers
    for (const sticker of stickers.value) {
      const newStartTime = Math.max(0, sticker.startTime + offsetSeconds);
      const newEndTime = sticker.endTime + offsetSeconds;
      await updateStickerLocal(sticker.id, {
        startTime: newStartTime,
        endTime: newEndTime,
      });
    }

    // Shift watermarks
    for (const watermark of watermarks.value) {
      const newStartTime = Math.max(0, watermark.startTime + offsetSeconds);
      const newEndTime = watermark.endTime + offsetSeconds;
      await updateWatermarkLocal(watermark.id, {
        startTime: newStartTime,
        endTime: newEndTime,
      });
    }

    // Shift filter segments
    for (const segment of filterSegments.value) {
      segment.startTime = Math.max(0, segment.startTime + offsetSeconds);
      segment.endTime = segment.endTime + offsetSeconds;
    }
  }

  async function onAddIntro(intro: IntroOutroWithOrgProps) {
    const projectId = editorProjectId.value;
    if (!projectId) return;

    try {
      const introDuration = intro.duration || 5; // Default 5 seconds if duration unknown

      // Remove existing intro if there is one
      if (currentIntro.value) {
        await removeIntroSource(currentIntro.value.sourceId);
      }

      // Shift all existing sources forward by the intro duration
      for (const source of videoSources.value) {
        const newStartTime = source.start_time + introDuration;
        const newEndTime = source.end_time + introDuration;
        await updateVideoEditorSource(source.id, {
          start_time: newStartTime,
          end_time: newEndTime,
        });
        source.start_time = newStartTime;
        source.end_time = newEndTime;
      }

      // Also shift all audio tracks, text overlays, stickers, and watermarks
      await shiftAllTracksBy(introDuration);

      // Create the intro source at position 0
      const newSource = await createVideoEditorSource(projectId, {
        sourceType: 'imported',
        sourceId: intro.id, // Reference to intro_outro table
        sourcePath: intro.file_path,
        sourceName: `[Intro] ${intro.name}`,
        sourceThumbnail: intro.thumbnail_path,
        sourceDuration: introDuration,
        startTime: 0,
        endTime: introDuration,
        trimStart: 0,
        trimEnd: null,
        orderIndex: 0,
      });

      // Add the new source to the beginning of the array
      videoSources.value.unshift(newSource);

      // Repair order_index to ensure correct playback order
      await repairSourceOrderIndex();

      // Load thumbnail for the intro
      let thumbnailUrl: string | undefined;
      if (intro.thumbnail_path) {
        try {
          // For org assets, thumbnail_path is a URL, so use it directly
          if (intro.isOrgAsset) {
            thumbnailUrl = intro.thumbnail_path;
          } else {
            const exists = await invoke<boolean>('check_file_exists', {
              path: intro.thumbnail_path,
            });
            if (exists) {
              thumbnailUrl = await invoke<string>('read_file_as_data_url', {
                filePath: intro.thumbnail_path,
              });
            }
          }
        } catch (err) {
          console.warn('[useIntroOutroOperations] Failed to load intro thumbnail:', err);
        }
      }

      // Track the current intro (including org asset properties for export)
      currentIntro.value = {
        id: intro.id,
        sourceId: newSource.id,
        name: intro.name,
        duration: intro.duration,
        filePath: intro.file_path,
        thumbnailUrl,
        // Include org asset properties for on-demand downloading during export
        isOrgAsset: intro.isOrgAsset,
        serverId: intro.serverId,
        serverUrl: intro.serverUrl,
        organization_id: intro.organization_id,
        organization_name: intro.organization_name,
        created_at: String(intro.created_at),
        updated_at: String(intro.updated_at),
      };

      await recalculateProjectDuration(projectId);
      triggerAutoSave();

      console.log(
        '[useIntroOutroOperations] Added intro:',
        intro.name,
        intro.isOrgAsset ? '(org asset)' : ''
      );
    } catch (error) {
      console.error('[useIntroOutroOperations] Failed to add intro:', error);
    }
  }

  async function onAddOutro(outro: IntroOutroWithOrgProps) {
    const projectId = editorProjectId.value;
    if (!projectId) return;

    try {
      const outroDuration = outro.duration || 5; // Default 5 seconds if duration unknown

      // Remove existing outro if there is one
      if (currentOutro.value) {
        await removeOutroSource(currentOutro.value.sourceId);
      }

      // Find the end of the timeline (max end_time of all sources, excluding the old outro)
      const maxEndTime = videoSources.value.reduce((max, source) => {
        return Math.max(max, source.end_time);
      }, 0);

      // Create the outro source at the end
      const newSource = await createVideoEditorSource(projectId, {
        sourceType: 'imported',
        sourceId: outro.id, // Reference to intro_outro table
        sourcePath: outro.file_path,
        sourceName: `[Outro] ${outro.name}`,
        sourceThumbnail: outro.thumbnail_path,
        sourceDuration: outroDuration,
        startTime: maxEndTime,
        endTime: maxEndTime + outroDuration,
        trimStart: 0,
        trimEnd: null,
        orderIndex: videoSources.value.length,
      });

      videoSources.value.push(newSource);

      // Repair order_index to ensure correct playback order
      await repairSourceOrderIndex();

      // Load thumbnail for the outro
      let thumbnailUrl: string | undefined;
      if (outro.thumbnail_path) {
        try {
          // For org assets, thumbnail_path is a URL, so use it directly
          if (outro.isOrgAsset) {
            thumbnailUrl = outro.thumbnail_path;
          } else {
            const exists = await invoke<boolean>('check_file_exists', {
              path: outro.thumbnail_path,
            });
            if (exists) {
              thumbnailUrl = await invoke<string>('read_file_as_data_url', {
                filePath: outro.thumbnail_path,
              });
            }
          }
        } catch (err) {
          console.warn('[useIntroOutroOperations] Failed to load outro thumbnail:', err);
        }
      }

      // Track the current outro (including org asset properties for export)
      currentOutro.value = {
        id: outro.id,
        sourceId: newSource.id,
        name: outro.name,
        duration: outro.duration,
        filePath: outro.file_path,
        thumbnailUrl,
        // Include org asset properties for on-demand downloading during export
        isOrgAsset: outro.isOrgAsset,
        serverId: outro.serverId,
        serverUrl: outro.serverUrl,
        organization_id: outro.organization_id,
        organization_name: outro.organization_name,
        created_at: String(outro.created_at),
        updated_at: String(outro.updated_at),
      };

      await recalculateProjectDuration(projectId);
      triggerAutoSave();

      console.log(
        '[useIntroOutroOperations] Added outro:',
        outro.name,
        outro.isOrgAsset ? '(org asset)' : ''
      );
    } catch (error) {
      console.error('[useIntroOutroOperations] Failed to add outro:', error);
    }
  }

  async function onRemoveIntro() {
    if (!currentIntro.value) return;

    try {
      const introDuration = currentIntro.value.duration || 0;

      // Remove the intro source
      await removeIntroSource(currentIntro.value.sourceId);

      // Shift all remaining sources back by the intro duration
      for (const source of videoSources.value) {
        const newStartTime = Math.max(0, source.start_time - introDuration);
        const newEndTime = source.end_time - introDuration;
        await updateVideoEditorSource(source.id, {
          start_time: newStartTime,
          end_time: newEndTime,
        });
        source.start_time = newStartTime;
        source.end_time = newEndTime;
      }

      // Also shift all audio tracks, text overlays, stickers, and watermarks back
      await shiftAllTracksBy(-introDuration);

      // Repair order_index to ensure correct playback order
      await repairSourceOrderIndex();

      currentIntro.value = null;

      if (editorProjectId.value) {
        await recalculateProjectDuration(editorProjectId.value);
      }
      triggerAutoSave();

      console.log('[useIntroOutroOperations] Removed intro');
    } catch (error) {
      console.error('[useIntroOutroOperations] Failed to remove intro:', error);
    }
  }

  async function onRemoveOutro() {
    if (!currentOutro.value) return;

    try {
      // Remove the outro source
      await removeOutroSource(currentOutro.value.sourceId);

      // Repair order_index to ensure correct playback order
      await repairSourceOrderIndex();

      currentOutro.value = null;

      if (editorProjectId.value) {
        await recalculateProjectDuration(editorProjectId.value);
      }
      triggerAutoSave();

      console.log('[useIntroOutroOperations] Removed outro');
    } catch (error) {
      console.error('[useIntroOutroOperations] Failed to remove outro:', error);
    }
  }

  return {
    onAddIntro,
    onAddOutro,
    onRemoveIntro,
    onRemoveOutro,
  };
}
