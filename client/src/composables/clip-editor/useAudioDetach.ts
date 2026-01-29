import { ref, type Ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';

/**
 * Result from audio extraction Tauri command
 */
export interface AudioExtractResult {
  file_path: string;
  filename: string;
  duration: number;
}

/**
 * Video source data for audio extraction
 */
export interface VideoSourceForExtract {
  id: string;
  source_path: string;
  trim_start: number;
  trim_end?: number | null;
  source_duration?: number | null;
  start_time: number;
  end_time: number;
}

/**
 * Options for useAudioDetach
 */
export interface AudioDetachOptions {
  /** Reference to the current project ID */
  projectId: Ref<string | null>;
  /** Reference to the current edit ID */
  editId: Ref<string | null>;
  /** Callback after successful audio detachment */
  onComplete?: () => Promise<void>;
}

/**
 * Return type for useAudioDetach
 */
export interface AudioDetachReturn {
  /** Detach audio from video sources */
  detachAudio: () => Promise<void>;
  /** Whether audio extraction is in progress */
  isExtracting: Ref<boolean>;
}

/**
 * useAudioDetach - Extract audio detachment logic from ClipEditorDialog
 *
 * This composable handles:
 * - Getting project video sources
 * - Invoking Tauri command to extract audio from video
 * - Creating audio track record in database
 * - Triggering data reload
 *
 * Extracted from ClipEditorDialog.vue handleDetachAudio():
 * - Tauri `extract_audio_to_file` invocation
 * - Audio file path handling
 * - DB record creation for extracted audio track
 *
 * Usage:
 * ```ts
 * const projectId = ref<string | null>('project-123');
 * const editId = ref<string | null>('edit-456');
 *
 * const { detachAudio, isExtracting } = useAudioDetach({
 *   projectId,
 *   editId,
 *   onComplete: async () => {
 *     await loadEditorData();
 *   },
 * });
 *
 * // In template or handler
 * <button @click="detachAudio" :disabled="isExtracting">
 *   Detach Audio
 * </button>
 * ```
 */
export function useAudioDetach(options: AudioDetachOptions): AudioDetachReturn {
  const { projectId, editId, onComplete } = options;

  const isExtracting = ref(false);

  /**
   * Detach audio from video sources
   * Extracts audio from the first video source and creates an audio track
   */
  async function detachAudio(): Promise<void> {
    if (!projectId.value || !editId.value) {
      console.warn('[useAudioDetach] No project ID or edit ID available');
      return;
    }

    if (isExtracting.value) {
      console.warn('[useAudioDetach] Audio extraction already in progress');
      return;
    }

    console.log('[useAudioDetach] Detaching audio from video sources');
    isExtracting.value = true;

    try {
      // Get project sources to find the video to extract from
      const { getVideoEditorProjectWithSources } = await import(
        '@/services/database/video-editor-projects'
      );
      const projectData = await getVideoEditorProjectWithSources(projectId.value);

      if (!projectData || projectData.sources.length === 0) {
        console.warn('[useAudioDetach] No video sources found');
        return;
      }

      // Extract audio from first source
      const firstSource = projectData.sources[0] as VideoSourceForExtract;
      const trimDuration = firstSource.trim_end
        ? firstSource.trim_end - firstSource.trim_start
        : firstSource.source_duration || (firstSource.end_time - firstSource.start_time);

      const result = await invoke<AudioExtractResult>('extract_audio_to_file', {
        videoPath: firstSource.source_path,
        sourceId: firstSource.id,
        trimStart: firstSource.trim_start,
        trimDuration,
      });

      console.log('[useAudioDetach] Audio extracted:', result);

      // Create audio track in database
      const { createVideoEditorAudioTrack } = await import(
        '@/services/database/video-editor-edits'
      );

      await createVideoEditorAudioTrack(editId.value, {
        file_path: result.file_path,
        name: 'Extracted Audio',
        start_time: 0,
        end_time: result.duration,
        volume: 1.0,
        pan: 0,
        fade_in: 0,
        fade_out: 0,
        track_order: 0,
        is_muted: 0,
        is_solo: 0,
        source_id: firstSource.id,
      });

      console.log('[useAudioDetach] Audio detached successfully');

      // Trigger completion callback
      await onComplete?.();
    } catch (error) {
      console.error('[useAudioDetach] Failed to detach audio:', error);
      throw error;
    } finally {
      isExtracting.value = false;
    }
  }

  return {
    detachAudio,
    isExtracting,
  };
}
