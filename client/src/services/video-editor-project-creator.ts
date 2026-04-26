/**
 * Service for creating video editor projects from clips.
 * This is used when opening a clip for editing - it automatically creates
 * a video editor project with the clip as the first source.
 */

import { invoke } from '@tauri-apps/api/core';
import {
  createVideoEditorProject,
  createVideoEditorSource,
  getOrCreateVideoEditorEdit,
  recalculateProjectDuration,
  getClip,
  getFullClipEdit,
  // Migration helpers for clip edits
  createVideoEditorAudioTrack,
  createVideoEditorTextOverlay,
  createVideoEditorSticker,
  createVideoEditorWatermark,
  type VideoEditorSource,
} from '@/services/database';
import { extractUnbuiltClipSegmentToPath } from '@/services/clip-vod-extract';

export interface ClipSegmentInput {
  start_time: number;
  end_time: number;
}

export interface CreateProjectFromClipOptions {
  clipId: string;
  clipTitle: string;
  videoSrc?: string | null;
  clipStartTime: number;
  clipEndTime: number;
  clipSegments?: ClipSegmentInput[];
  /** When clips live on a segment/child project, raw VODs are often on the parent — pass `parent_id`. */
  rawVideoParentProjectId?: string | null;
}

export interface CreateProjectFromClipResult {
  projectId: string;
  projectName: string;
  videoServerPort: number;
  sources: VideoEditorSource[];
  videoEditorEditId: string;
}

/**
 * Creates a video editor project from an existing clip.
 * This handles:
 * 1. Creating the video_editor_projects record
 * 2. Creating the first video source from the clip
 * 3. Creating the video_editor_edits record
 * 4. Migrating any existing clip edits (overlays, audio, etc.)
 */
export async function createVideoEditorProjectFromClip(
  options: CreateProjectFromClipOptions
): Promise<CreateProjectFromClipResult> {
  const { clipId, clipTitle, videoSrc, clipStartTime, clipEndTime, rawVideoParentProjectId } = options;

  // Create a new video editor project with the clip's name
  const projectName = `${clipTitle || 'Untitled'} - Video Project`;
  const newProjectId = await createVideoEditorProject(projectName);

  // Get video server port for constructing video URLs
  const videoServerPort = await invoke<number>('get_video_server_port');

  // Resolve the clip's extracted video file path.
  // We ALWAYS extract the clip segment from the VOD so the editor
  // only ever works with the short clip file — never the full VOD.
  const clipDuration = clipEndTime - clipStartTime;
  let clipVideoPath = '';
  let clipThumbnailPath: string | null = null;

  if (clipId) {
    try {
      const clip = await getClip(clipId);

      // Capture thumbnail path from the clip if available
      if (clip?.built_thumbnail_path) {
        clipThumbnailPath = clip.built_thumbnail_path;
      }

      // If the clip was already built, use the built file directly
      if (clip?.built_file_path) {
        clipVideoPath = clip.built_file_path;
        console.log('[video-editor-project-creator] Using existing built clip file:', clipVideoPath);
      } else {
        // No built file — extract the clip segment from the VOD (same pipeline as editor media panel)
        const outputPath = await invoke<string>('get_editor_clip_extract_path', {
          projectId: newProjectId,
          clipId,
        });

        await extractUnbuiltClipSegmentToPath({
          clipId,
          clipStartTime,
          clipEndTime,
          outputPath,
          videoSrc,
          rawVideoParentProjectId: rawVideoParentProjectId ?? null,
        });

        clipVideoPath = outputPath;
        console.log('[video-editor-project-creator] Clip segment extracted successfully:', outputPath);
      }
    } catch (error) {
      console.error('[video-editor-project-creator] Failed to resolve clip video:', error);
      throw error;
    }
  }

  if (!clipVideoPath) {
    throw new Error('No clip video path resolved — cannot create editor project');
  }

  console.log('[video-editor-project-creator] Creating source from extracted clip:', {
    clipDuration,
    clipVideoPath: clipVideoPath.split(/[\\/]/).pop(),
  });

  // Create the first source from the extracted clip file.
  // trimStart/trimEnd are 0 because the extracted file IS the clip — no offsets needed.
  const sources: VideoEditorSource[] = [];
  const firstSource = await createVideoEditorSource(newProjectId, {
    sourceType: 'clip',
    sourceId: clipId || null,
    sourcePath: clipVideoPath,
    sourceName: clipTitle || 'Clip',
    sourceThumbnail: clipThumbnailPath,
    sourceDuration: clipDuration,
    startTime: 0,
    endTime: clipDuration,
    trimStart: 0,
    trimEnd: 0,
    orderIndex: 0,
  });
  sources.push(firstSource);

  // Create/get an edit record for the video editor project
  const editRecord = await getOrCreateVideoEditorEdit(newProjectId);
  const videoEditorEditId = editRecord.id;

  // Migrate existing clip edits to the video editor project
  if (clipId) {
    await migrateClipEditsToVideoProject(clipId, videoEditorEditId);
  }

  // Recalculate project duration
  await recalculateProjectDuration(newProjectId);

  console.log(
    `[video-editor-project-creator] Created video project: ${newProjectId} from clip: ${clipId}`
  );

  return {
    projectId: newProjectId,
    projectName,
    videoServerPort,
    sources,
    videoEditorEditId,
  };
}

/**
 * Migrates existing clip edits (text overlays, audio tracks, stickers, watermarks)
 * from clip_edits tables to video_editor_* tables.
 */
async function migrateClipEditsToVideoProject(
  clipId: string,
  newVideoEditorEditId: string
): Promise<void> {
  try {
    const fullEdit = await getFullClipEdit(clipId);
    if (!fullEdit) {
      console.log('[video-editor-project-creator] No existing clip edits to migrate');
      return;
    }

    let migratedTextOverlays = 0;
    let migratedAudioTracks = 0;
    let migratedStickers = 0;
    let migratedWatermarks = 0;

    // Migrate text overlays
    for (const overlay of fullEdit.textOverlays) {
      await createVideoEditorTextOverlay(newVideoEditorEditId, {
        text: overlay.text,
        start_time: overlay.start_time,
        end_time: overlay.end_time,
        style_data: overlay.style_data,
        position_x: overlay.position_x,
        position_y: overlay.position_y,
        per_ratio_configs_data: overlay.per_ratio_configs_data,
      });
      migratedTextOverlays++;
    }

    // Migrate audio tracks
    for (const track of fullEdit.audioTracks) {
      await createVideoEditorAudioTrack(newVideoEditorEditId, {
        file_path: track.file_path,
        name: track.name,
        start_time: track.start_time,
        end_time: track.end_time,
        volume: track.volume,
        fade_in: track.fade_in,
        fade_out: track.fade_out,
        track_order: track.track_order,
        is_muted: track.is_muted ? 1 : 0,
        is_solo: track.is_solo ? 1 : 0,
      });
      migratedAudioTracks++;
    }

    // Migrate stickers
    for (const sticker of fullEdit.stickers) {
      await createVideoEditorSticker(newVideoEditorEditId, {
        sticker_path: sticker.sticker_path,
        sticker_type: sticker.sticker_type,
        start_time: sticker.start_time,
        end_time: sticker.end_time,
        position_x: sticker.position_x,
        position_y: sticker.position_y,
        scale: sticker.scale,
        rotation: sticker.rotation,
        per_ratio_configs_data: sticker.per_ratio_configs_data,
      });
      migratedStickers++;
    }

    // Migrate watermarks
    for (const watermark of fullEdit.watermarks) {
      await createVideoEditorWatermark(newVideoEditorEditId, {
        watermark_id: watermark.watermark_id,
        watermark_path: watermark.watermark_path,
        preview_url: watermark.preview_url,
        start_time: watermark.start_time,
        end_time: watermark.end_time,
        position_x: watermark.position_x,
        position_y: watermark.position_y,
        scale: watermark.scale,
        opacity: watermark.opacity,
        per_ratio_configs_data: watermark.per_ratio_configs_data,
      });
      migratedWatermarks++;
    }

    console.log(
      `[video-editor-project-creator] Migrated ${migratedTextOverlays} text overlays, ` +
        `${migratedAudioTracks} audio tracks, ${migratedStickers} stickers, ` +
        `${migratedWatermarks} watermarks to video project`
    );
  } catch (error) {
    console.error('[video-editor-project-creator] Failed to migrate clip edits:', error);
  }
}
