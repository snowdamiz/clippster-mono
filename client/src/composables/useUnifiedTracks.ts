import { computed, Ref } from 'vue';
import type { 
  Track, 
  TimelineItem, 
  TimelineItemType, 
  Keyframe 
} from '@/types/timeline-model';
import type {
  AudioTrack,
  TextOverlay,
  Sticker,
  ClipWatermark,
  Effect,
  FilterSegment,
  VideoEditorSource,
  TrimSegment,
  VideoEditorTransition, // Import type
} from '@/types';
import { detectSourceTransitions } from '@/types'; // Import helper
import type {
  VideoEditorAudioTrackRecord,
  VideoEditorTextOverlayRecord,
  VideoEditorStickerRecord,
  VideoEditorWatermarkRecord,
  VideoEditorEffectRecord
} from '@/services/database';
import { TimelineAdapter } from '@/services/timeline-adapter';

interface UseUnifiedTracksOptions {
  editorMode: Ref<boolean>;
  videoEditorEditId: Ref<string | null>;
  audioTracks: Ref<AudioTrack[]>;
  textOverlays: Ref<TextOverlay[]>;
  stickers: Ref<Sticker[]>;
  watermarks: Ref<ClipWatermark[]>;
  effects: Ref<Effect[]>;
  filterSegments: Ref<FilterSegment[]>;
  videoSources: Ref<VideoEditorSource[]>;
  duration: Ref<number>;
  trimSegments?: Ref<TrimSegment[]>; // Optional for clip mode
}

export function useUnifiedTracks(options: UseUnifiedTracksOptions) {
  const {
    editorMode,
    videoEditorEditId,
    audioTracks,
    textOverlays,
    stickers,
    watermarks,
    effects,
    filterSegments,
    videoSources,
    duration,
    trimSegments
  } = options;

  const unifiedTracks = computed<Track[]>(() => {
    // Current implementation relies on the TimelineAdapter which is designed for Editor Mode
    // For Clip Mode, we might need a different strategy or adapt the adapter
    
    if (editorMode.value) {
      // Map frontend types to database record types for the adapter
      // This logic is extracted from ClipEditorDialog.vue to be reusable

      const audioRecords: VideoEditorAudioTrackRecord[] = audioTracks.value.map((t) => ({
        id: t.id,
        edit_id: videoEditorEditId.value || '',
        file_path: t.filePath,
        name: t.name,
        start_time: t.startTime,
        end_time: t.endTime,
        volume: t.volume,
        pan: t.pan ?? 0,
        fade_in: t.fadeIn,
        fade_out: t.fadeOut,
        track_order: t.trackOrder,
        is_muted: t.isMuted ? 1 : 0,
        is_solo: t.isSolo ? 1 : 0,
        created_at: 0,
      }));

      const textRecords: VideoEditorTextOverlayRecord[] = textOverlays.value.map((t) => ({
        id: t.id,
        edit_id: videoEditorEditId.value || '',
        text: t.text,
        start_time: t.startTime,
        end_time: t.endTime,
        position_x: t.position.x,
        position_y: t.position.y,
        style_data: JSON.stringify(t.style),
        animation: t.animation,
        per_ratio_configs_data: t.perRatioConfigs ? JSON.stringify(t.perRatioConfigs) : undefined,
        preview_height: t.previewHeight,
        layer: t.layer,
        created_at: 0,
        keyframes: t.keyframes ? JSON.stringify(t.keyframes) : undefined // Ensure keyframes are passed
      }));

      const stickerRecords: VideoEditorStickerRecord[] = stickers.value.map((s) => ({
        id: s.id,
        edit_id: videoEditorEditId.value || '',
        sticker_path: s.stickerPath,
        sticker_type: s.stickerType,
        start_time: s.startTime,
        end_time: s.endTime,
        position_x: s.position.x,
        position_y: s.position.y,
        scale: s.scale,
        rotation: s.rotation,
        animation: s.animation,
        per_ratio_configs_data: s.perRatioConfigs ? JSON.stringify(s.perRatioConfigs) : undefined,
        layer: s.layer,
        created_at: 0,
        keyframes: s.keyframes ? JSON.stringify(s.keyframes) : undefined
      }));

      const watermarkRecords: VideoEditorWatermarkRecord[] = watermarks.value.map((w) => ({
        id: w.id,
        edit_id: videoEditorEditId.value || '',
        watermark_id: w.watermarkId,
        watermark_path: w.filePath,
        preview_url: w.previewUrl,
        start_time: w.startTime,
        end_time: w.endTime,
        position_x: w.position.x,
        position_y: w.position.y,
        scale: w.scale,
        opacity: w.opacity,
        per_ratio_configs_data: w.perRatioConfigs ? JSON.stringify(w.perRatioConfigs) : undefined,
        layer: w.layer,
        created_at: 0,
        keyframes: w.keyframes ? JSON.stringify(w.keyframes) : undefined
      }));

      const effectRecords: VideoEditorEffectRecord[] = effects.value.map((e) => ({
        id: e.id,
        edit_id: videoEditorEditId.value || '',
        effect_type: e.type,
        start_time: e.startTime,
        end_time: e.endTime,
        settings: JSON.stringify(e.settings),
        created_at: 0,
      }));

      // Use the TimelineAdapter to convert these records into the unified Track model
      return TimelineAdapter.toTimelineModel({
        sources: videoSources.value,
        audioTracks: audioRecords,
        textOverlays: textRecords,
        stickers: stickerRecords,
        watermarks: watermarkRecords,
        effects: effectRecords,
        filterSegments: filterSegments.value,
        duration: duration.value,
      }).tracks;
    } else {
      // Clip Mode Implementation (Future Phase: Adapt Clip Mode to Unified Model)
      // For now, return empty or implement basic mapping if needed by the renderer
      // Currently ClipEditorTimeline handles its own rendering for clip mode
      return []; 
    }
  });

  return {
    unifiedTracks
  };
}
