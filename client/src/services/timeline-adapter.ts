import { TimelineModel, Track, TimelineItem, Keyframe } from '@/types/timeline-model';
import {
  VideoEditorSource,
  VideoEditorAudioTrackRecord,
  VideoEditorTextOverlayRecord,
  VideoEditorStickerRecord,
  VideoEditorWatermarkRecord,
  VideoEditorEffectRecord,
} from '@/services/database';
import { FilterSegment, VideoEditorTransition } from '@/types';

/**
 * Adapter to convert legacy/database types to the unified TimelineModel
 */
export class TimelineAdapter {
  /**
   * Converts disparate editor data into a unified TimelineModel
   */
  static toTimelineModel(data: {
    sources: VideoEditorSource[];
    audioTracks: VideoEditorAudioTrackRecord[];
    textOverlays: VideoEditorTextOverlayRecord[];
    stickers: VideoEditorStickerRecord[];
    watermarks: VideoEditorWatermarkRecord[];
    effects: VideoEditorEffectRecord[];
    filterSegments: FilterSegment[];
    transitions?: VideoEditorTransition[];
    duration: number;
  }): TimelineModel {
    const tracks: Track[] = [];

    // 1. Process Video Sources (Base Video Tracks)
    // Group sources by track_index
    const sourcesByTrack = new Map<number, VideoEditorSource[]>();

    data.sources.forEach((source) => {
      const trackIndex = source.track_index || 0;
      if (!sourcesByTrack.has(trackIndex)) {
        sourcesByTrack.set(trackIndex, []);
      }
      sourcesByTrack.get(trackIndex)?.push(source);
    });

    // Create tracks for video sources
    sourcesByTrack.forEach((trackSources, trackIndex) => {
      const items: TimelineItem[] = trackSources.map((source) => {
        const itemKeyframes: Keyframe[] = source.keyframes_data
          ? JSON.parse(source.keyframes_data)
          : [];

        // Process transitions for this source (crossfades)
        if (data.transitions) {
          // Check if this source is fading out (Source A in a transition)
          const outgoingTransitions = data.transitions.filter(
            (t) => t.sourceAId === source.id && t.type === 'crossfade'
          );
          outgoingTransitions.forEach((t) => {
            // Fade out: 1 -> 0
            // Start of fade
            itemKeyframes.push({
              id: `tf-out-start-${t.id}`,
              property: 'opacity',
              time: t.startTime - source.start_time,
              value: 1,
              easing: 'linear',
            });
            // End of fade
            itemKeyframes.push({
              id: `tf-out-end-${t.id}`,
              property: 'opacity',
              time: t.endTime - source.start_time,
              value: 0,
              easing: 'linear',
            });
          });

          // Check if this source is fading in (Source B in a transition)
          const incomingTransitions = data.transitions.filter(
            (t) => t.sourceBId === source.id && t.type === 'crossfade'
          );
          incomingTransitions.forEach((t) => {
            // Fade in: 0 -> 1
            // Start of fade
            itemKeyframes.push({
              id: `tf-in-start-${t.id}`,
              property: 'opacity',
              time: t.startTime - source.start_time,
              value: 0,
              easing: 'linear',
            });
            // End of fade
            itemKeyframes.push({
              id: `tf-in-end-${t.id}`,
              property: 'opacity',
              time: t.endTime - source.start_time,
              value: 1,
              easing: 'linear',
            });
          });
        }

        return {
          id: source.id,
          type: 'video',
          startTime: source.start_time,
          duration: source.end_time - source.start_time,
          sourceId: source.source_id || undefined,
          sourcePath: source.source_path,
          trimStart: source.trim_start,
          trimEnd: source.trim_end || undefined,
          name: source.source_name || 'Video Clip',
          isLocked: source.is_locked,
          isMuted: source.is_muted,
          originalData: source,
          keyframes: itemKeyframes.length > 0 ? itemKeyframes : undefined,
        };
      });

      tracks.push({
        id: `track-video-${trackIndex}`,
        type: 'video',
        name: trackIndex === 0 ? 'Main Track' : `Video Track ${trackIndex}`,
        orderIndex: trackIndex,
        isMuted: false,
        isLocked: false,
        isVisible: true,
        items,
      });
    });

    // 2. Process Overlays (Text, Sticker, Watermark)
    // These typically sit on top of video tracks.
    // We'll map 'layer' property to track indices starting after the highest video track.
    // If no layer is specified, we'll assign one.

    const maxVideoTrackIndex = Math.max(0, ...Array.from(sourcesByTrack.keys()));
    const overlayBaseIndex = maxVideoTrackIndex + 1;

    const overlaysByLayer = new Map<number, TimelineItem[]>();

    // Helper to get or create layer array
    const getLayer = (layer: number) => {
      if (!overlaysByLayer.has(layer)) {
        overlaysByLayer.set(layer, []);
      }
      return overlaysByLayer.get(layer)!;
    };

    // Process Text
    data.textOverlays.forEach((text) => {
      const layerIndex = text.layer || 0; // Relative layer index

      // Parse style_data and per_ratio_configs_data for TrackRenderer compatibility
      let parsedStyle: any = {};
      let parsedPerRatioConfigs: any = undefined;

      try {
        if (text.style_data) {
          parsedStyle =
            typeof text.style_data === 'string' ? JSON.parse(text.style_data) : text.style_data;
        }
      } catch (e) {
        console.warn('Failed to parse text style_data', e);
      }

      try {
        if (text.per_ratio_configs_data) {
          parsedPerRatioConfigs =
            typeof text.per_ratio_configs_data === 'string'
              ? JSON.parse(text.per_ratio_configs_data)
              : text.per_ratio_configs_data;
        }
      } catch (e) {
        console.warn('Failed to parse text per_ratio_configs_data', e);
      }

      // Get rotation from perRatioConfigs or default to 0
      // Note: The actual rotation used depends on the current aspect ratio,
      // but we store a default here for AnimationService compatibility
      const defaultRotation = parsedPerRatioConfigs?.['16:9']?.rotation ?? 0;

      const item: TimelineItem = {
        id: text.id,
        type: 'text',
        startTime: text.start_time,
        duration: text.end_time - text.start_time,
        name: text.text.substring(0, 20) || 'Text',
        positionX: text.position_x / 100, // Normalize to 0-1
        positionY: text.position_y / 100, // Normalize to 0-1
        rotation: defaultRotation,
        originalData: {
          ...text,
          style: parsedStyle, // Parsed style object for TrackRenderer
          perRatioConfigs: parsedPerRatioConfigs, // Parsed per-ratio configs
          rotation: defaultRotation, // Include rotation in originalData for TrackRenderer
        },
        keyframes: text.keyframes_data
          ? JSON.parse(text.keyframes_data)
          : text.keyframes
            ? JSON.parse(text.keyframes)
            : undefined,
      };
      getLayer(layerIndex).push(item);
    });

    // Process Stickers
    data.stickers.forEach((sticker) => {
      const layerIndex = sticker.layer || 0;
      const item: TimelineItem = {
        id: sticker.id,
        type: 'sticker',
        startTime: sticker.start_time,
        duration: sticker.end_time - sticker.start_time,
        name: 'Sticker',
        positionX: sticker.position_x / 100,
        positionY: sticker.position_y / 100,
        scale: sticker.scale,
        rotation: sticker.rotation,
        originalData: sticker,
        keyframes: sticker.keyframes_data ? JSON.parse(sticker.keyframes_data) : undefined,
      };
      getLayer(layerIndex).push(item);
    });

    // Process Watermarks - create a dedicated watermark track for preview rendering
    // This track is rendered by ClipEditorPreview but NOT shown in timeline layers (handled separately)
    if (data.watermarks.length > 0) {
      const watermarkItems: TimelineItem[] = data.watermarks.map((wm) => ({
        id: wm.id,
        type: 'watermark',
        startTime: wm.start_time,
        duration: wm.end_time - wm.start_time,
        name: 'Watermark',
        sourcePath: wm.preview_url || wm.watermark_path,
        positionX: wm.position_x / 100,
        positionY: wm.position_y / 100,
        // Scale is stored as percentage where 15 = 100% (1.0 CSS scale)
        // Divide by 15 to convert to CSS scale multiplier
        scale: wm.scale / 15,
        opacity: wm.opacity / 100,
        originalData: wm,
        keyframes: wm.keyframes_data ? JSON.parse(wm.keyframes_data) : undefined,
      }));

      // Add watermark track with orderIndex -1 (below main video, special handling)
      tracks.push({
        id: 'track-watermark',
        type: 'video',
        name: 'Watermark',
        orderIndex: -1, // Special index indicating watermark track (below main video)
        isMuted: false,
        isLocked: false, // Allow drag and resize in preview
        isVisible: true,
        items: watermarkItems,
      });
    }

    // Create tracks for overlays
    // We sort layers to ensure correct z-index
    const sortedLayers = Array.from(overlaysByLayer.keys()).sort((a, b) => a - b);

    sortedLayers.forEach((layerIndex) => {
      const globalTrackIndex = overlayBaseIndex + layerIndex;
      tracks.push({
        id: `track-overlay-${layerIndex}`,
        type: 'video', // Visual track
        name: `Overlay ${layerIndex + 1}`,
        orderIndex: globalTrackIndex,
        isMuted: false,
        isLocked: false,
        isVisible: true,
        items: overlaysByLayer.get(layerIndex)!,
      });
    });

    // 3. Process Audio Tracks
    // Group by trackOrder
    const audioByTrack = new Map<number, VideoEditorAudioTrackRecord[]>();

    data.audioTracks.forEach((audio) => {
      const order = audio.track_order || 0;
      if (!audioByTrack.has(order)) {
        audioByTrack.set(order, []);
      }
      audioByTrack.get(order)?.push(audio);
    });

    audioByTrack.forEach((trackAudioItems, order) => {
      const items: TimelineItem[] = trackAudioItems.map((audio) => ({
        id: audio.id,
        type: 'audio',
        startTime: audio.start_time,
        duration: audio.end_time - audio.start_time,
        name: audio.name,
        sourcePath: audio.file_path,
        volume: audio.volume,
        isMuted: !!audio.is_muted,
        originalData: audio,
        keyframes: audio.keyframes_data
          ? JSON.parse(`{"audio":${audio.keyframes_data}}`)
          : undefined,
      }));

      tracks.push({
        id: `track-audio-${order}`,
        type: 'audio',
        name: `Audio Track ${order + 1}`,
        orderIndex: order, // Audio track order is independent of video
        isMuted: false,
        isLocked: false, // Record doesn't have isLocked yet?
        isVisible: true,
        items,
      });
    });

    // 4. Process Effects and Filters
    // These are visual effects that apply to the timeline.
    // We'll place them on a dedicated effects track on top of everything.
    const effectItems: TimelineItem[] = [];

    // Process Effects
    data.effects.forEach((effect) => {
      let parsedSettings: any = {};
      try {
        parsedSettings =
          typeof effect.settings === 'string' ? JSON.parse(effect.settings) : effect.settings;
      } catch (e) {
        console.warn('Failed to parse effect settings', e);
      }

      // Determine the TimelineItem type based on effect_type
      const itemType = effect.effect_type === 'adjustment_layer' ? 'adjustment_layer' : 'effect';

      effectItems.push({
        id: effect.id,
        type: itemType,
        startTime: effect.start_time,
        duration: effect.end_time - effect.start_time,
        name: `Effect: ${effect.effect_type}`,
        originalData: {
          ...effect,
          settings: parsedSettings, // Ensure renderer gets parsed settings
        },
      });
    });

    // Process Filter Segments
    data.filterSegments.forEach((filter) => {
      effectItems.push({
        id: filter.id,
        type: 'effect', // Treat filters as effects
        startTime: filter.startTime,
        duration: filter.endTime - filter.startTime,
        name: 'Filter',
        originalData: {
          effect_type: 'filter',
          ...filter,
        },
      });
    });

    if (effectItems.length > 0) {
      // Place effects above all overlay layers
      const effectTrackIndex = overlayBaseIndex + sortedLayers.length;
      tracks.push({
        id: 'track-effects-global',
        type: 'video', // It renders visually
        name: 'Effects Track',
        orderIndex: effectTrackIndex,
        isMuted: false,
        isLocked: false,
        isVisible: true,
        items: effectItems,
      });
    }

    return {
      tracks,
      duration: data.duration,
    };
  }
}
