import type { Ref, ComputedRef } from 'vue';
import type { VideoEditorSource, SourceItem } from '@/types';
import {
  getVideoEditorSourcesByProjectId,
  createVideoEditorSource,
  updateVideoEditorSource,
  deleteVideoEditorSource,
  getNextSourceStartTime,
  recalculateProjectDuration,
} from '@/services/database';
import { CommandHistory, SplitCommand, ResizeCommand } from '@/services/commands';

export interface UseVideoSourceOperationsOptions {
  editorProjectId: ComputedRef<string | null>;
  videoEditorEditId: Ref<string | null>;
  videoSources: Ref<VideoEditorSource[]>;
  commandHistory: CommandHistory;
  undoRedoTrigger: Ref<number>;
  triggerAutoSave: () => void;
  loadEditorProject: () => Promise<void>;
}

export function useVideoSourceOperations(options: UseVideoSourceOperationsOptions) {
  const {
    editorProjectId,
    videoEditorEditId,
    videoSources,
    commandHistory,
    undoRedoTrigger,
    triggerAutoSave,
    loadEditorProject,
  } = options;

  /**
   * Add a video source to the current video project.
   * Handles detected clips (with trim points) and raw videos.
   */
  async function addSourceToProject(source: SourceItem) {
    const projectId = editorProjectId.value;
    if (!projectId) return;

    try {
      const startTime = await getNextSourceStartTime(projectId);

      // For detected clips: use clip segment timing (trim from source video)
      // For raw videos/built clips: use full duration
      const isDetectedClip =
        source.type === 'clip' &&
        source.clipStartTime !== undefined &&
        source.clipStartTime !== null &&
        source.clipEndTime !== undefined &&
        source.clipEndTime !== null;

      // Calculate durations
      const clipDuration = isDetectedClip
        ? source.clipEndTime! - source.clipStartTime!
        : source.duration || 30;

      // Source duration is the full video length (for detected clips use sourceDuration)
      const fullSourceDuration = isDetectedClip
        ? source.sourceDuration || clipDuration
        : source.duration || 30;

      // Trim points in the source video
      const trimStart = isDetectedClip ? source.clipStartTime! : 0;
      const trimEnd = isDetectedClip ? source.clipEndTime! : null;

      // Store the actual file path (not the HTTP URL) for the source
      const newSource = await createVideoEditorSource(projectId, {
        sourceType: source.type,
        sourceId: source.id,
        sourcePath: source.path, // Store actual file path (raw video path for detected clips)
        sourceName: source.name,
        sourceThumbnail: source.thumbnailPath,
        sourceDuration: fullSourceDuration,
        startTime: startTime,
        endTime: startTime + clipDuration, // Timeline duration is the clip segment duration
        trimStart: trimStart,
        trimEnd: trimEnd,
        orderIndex: videoSources.value.length,
      });

      videoSources.value.push(newSource);
      await recalculateProjectDuration(projectId);
      triggerAutoSave();
    } catch (error) {
      console.error('[useVideoSourceOperations] Failed to add source:', error);
    }
  }

  /**
   * Import an external file as a video source to the current project.
   */
  async function importFileToProject(
    filePath: string,
    name: string,
    duration: number,
    thumbnailPath?: string
  ) {
    const projectId = editorProjectId.value;
    if (!projectId) return;

    try {
      const startTime = await getNextSourceStartTime(projectId);
      const sourceDuration = duration || 30;

      // Store the actual file path (not the HTTP URL)
      const newSource = await createVideoEditorSource(projectId, {
        sourceType: 'imported',
        sourceId: null,
        sourcePath: filePath, // Store actual file path
        sourceName: name,
        sourceThumbnail: thumbnailPath || null,
        sourceDuration: sourceDuration,
        startTime: startTime,
        endTime: startTime + sourceDuration,
        trimStart: 0,
        trimEnd: null,
        orderIndex: videoSources.value.length,
      });

      videoSources.value.push(newSource);
      await recalculateProjectDuration(projectId);
      triggerAutoSave();
    } catch (error) {
      console.error('[useVideoSourceOperations] Failed to import file:', error);
    }
  }

  /**
   * Handle drag-drop of a source onto the timeline at a specific position.
   */
  async function onDropSource(data: { source: SourceItem; position: number }) {
    const projectId = editorProjectId.value;
    if (!projectId) return;

    const duration = data.source.duration || 30;

    try {
      // Store the actual file path (not the HTTP URL)
      const newSource = await createVideoEditorSource(projectId, {
        sourceType: data.source.type,
        sourceId: data.source.id,
        sourcePath: data.source.path, // Store actual file path
        sourceName: data.source.name,
        sourceThumbnail: data.source.thumbnailPath,
        sourceDuration: duration,
        startTime: data.position,
        endTime: data.position + duration,
        trimStart: 0,
        trimEnd: null,
        orderIndex: videoSources.value.length,
      });

      videoSources.value.push(newSource);
      await recalculateProjectDuration(projectId);
      triggerAutoSave();
    } catch (error) {
      console.error('[useVideoSourceOperations] Failed to drop source:', error);
    }
  }

  /**
   * Update a video source's properties (with undo/redo support for time changes).
   */
  async function updateVideoSource(sourceId: string, updates: Partial<VideoEditorSource>) {
    const source = videoSources.value.find((s) => s.id === sourceId);
    if (!source) return;

    try {
      // Check if this is a position/time change that should be tracked for undo
      const isTimeChange = updates.start_time !== undefined || updates.end_time !== undefined;
      const isTrimChange = updates.trim_start !== undefined || updates.trim_end !== undefined;

      if ((isTimeChange || isTrimChange) && videoEditorEditId.value) {
        // Use ResizeCommand for undo/redo support
        const reloadCallback = async () => {
          if (editorProjectId.value) {
            const sources = await getVideoEditorSourcesByProjectId(editorProjectId.value);
            videoSources.value = sources;
            await recalculateProjectDuration(editorProjectId.value);
          }
        };

        const resizeCommand = new ResizeCommand({
          type: 'source',
          itemId: sourceId,
          editId: videoEditorEditId.value || '',
          originalStartTime: source.start_time,
          originalEndTime: source.end_time,
          originalTrimStart: source.trim_start ?? undefined,
          originalTrimEnd: source.trim_end ?? undefined,
          newStartTime: updates.start_time ?? source.start_time,
          newEndTime: updates.end_time ?? source.end_time,
          newTrimStart: updates.trim_start ?? source.trim_start ?? undefined,
          newTrimEnd: updates.trim_end ?? source.trim_end ?? undefined,
          onReload: reloadCallback,
        });

        await commandHistory.executeCommand(resizeCommand);
        undoRedoTrigger.value++;

        // Update local state
        Object.assign(source, updates);

        if (editorProjectId.value) {
          await recalculateProjectDuration(editorProjectId.value);
        }
      } else {
        // For non-time changes (like order_index, track_index), update directly
        await updateVideoEditorSource(sourceId, {
          start_time: updates.start_time,
          end_time: updates.end_time,
          trim_start: updates.trim_start,
          trim_end: updates.trim_end,
          order_index: updates.order_index,
          track_index: updates.track_index,
        });

        Object.assign(source, updates);

        if (editorProjectId.value) {
          await recalculateProjectDuration(editorProjectId.value);
        }
      }

      triggerAutoSave();
    } catch (error) {
      console.error('[useVideoSourceOperations] Failed to update source:', error);
    }
  }

  /**
   * Delete a video source from the project.
   */
  async function deleteVideoSource(sourceId: string) {
    try {
      await deleteVideoEditorSource(sourceId);
      videoSources.value = videoSources.value.filter((s) => s.id !== sourceId);

      // Repair order_index after deletion
      await repairSourceOrderIndex();

      if (editorProjectId.value) {
        await recalculateProjectDuration(editorProjectId.value);
      }
      triggerAutoSave();
    } catch (error) {
      console.error('[useVideoSourceOperations] Failed to delete source:', error);
    }
  }

  /**
   * Repair order_index values based on start_time.
   * This ensures sources are always in the correct order for playback.
   */
  async function repairSourceOrderIndex() {
    if (videoSources.value.length === 0) return;

    // Sort by start_time to get the correct playback order
    const sortedSources = [...videoSources.value].sort((a, b) => a.start_time - b.start_time);

    for (let i = 0; i < sortedSources.length; i++) {
      if (sortedSources[i].order_index !== i) {
        await updateVideoEditorSource(sortedSources[i].id, { order_index: i });
        sortedSources[i].order_index = i;
      }
    }

    // Always update the reactive array with the correctly ordered sources
    videoSources.value = sortedSources;
  }

  /**
   * Split a video source at the specified position (with undo/redo support).
   */
  async function splitVideoSource(
    sourceId: string,
    cutTimelinePosition: number,
    _cutSourceTime: number
  ) {
    const source = videoSources.value.find((s) => s.id === sourceId);
    if (!source || !editorProjectId.value) return;

    // Validate cut is within source bounds
    if (cutTimelinePosition <= source.start_time || cutTimelinePosition >= source.end_time) {
      console.warn('[useVideoSourceOperations] Cut position is outside source bounds');
      return;
    }

    // Find the source index
    const sourceIndex = videoSources.value.findIndex((s) => s.id === sourceId);
    if (sourceIndex === -1) {
      console.error('[useVideoSourceOperations] Source not found in videoSources array');
      return;
    }

    try {
      // Create reload callback
      const reloadCallback = async () => {
        await loadEditorProject();
      };

      // Create and execute split command
      const splitCommand = new SplitCommand(true, {
        editorProjectId: editorProjectId.value,
        segmentIndex: sourceIndex,
        cutTime: cutTimelinePosition,
        onReload: reloadCallback,
      });

      await commandHistory.executeCommand(splitCommand);
      undoRedoTrigger.value++; // Trigger reactivity update
    } catch (error) {
      console.error('[useVideoSourceOperations] Failed to split source:', error);
      alert(`Failed to split source: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return {
    addSourceToProject,
    importFileToProject,
    onDropSource,
    updateVideoSource,
    deleteVideoSource,
    repairSourceOrderIndex,
    splitVideoSource,
  };
}
