/**
 * Specific Command Implementations for Clip Editor
 *
 * Each command handles both clip mode and editor mode operations.
 */

import { BaseCommand } from './Command';
import {
  splitClipSegment,
  deleteClipSegment,
  insertClipSegment,
  updateClipSegment,
  getClipSegmentsByClipId,
  type ClipSegment,
} from '@/services/database';
import {
  getVideoEditorSourcesByProjectId,
  updateVideoEditorSource,
  deleteVideoEditorSource,
  createVideoEditorSource,
  type VideoEditorSource,
} from '@/services/database';
import { splitVideoEditorSource } from '@/services/database/video-editor-projects';
import {
  updateVideoEditorWatermark,
  updateVideoEditorTextOverlay,
  updateVideoEditorSticker,
  updateVideoEditorEffect,
  updateVideoEditorAudioTrack,
} from '@/services/database/video-editor-edits';

/**
 * Split Command Data Interface
 */
export interface SplitCommandData {
  // Clip mode data
  clipId?: string;
  segmentIndex?: number;
  clipStartTime?: number; // For converting between relative and absolute times

  // Editor mode data
  sourceId?: string;
  cutTimelinePosition?: number;
  cutSourceTime?: number;
  editorProjectId?: string;

  // Common data
  cutTime: number; // The cut time (relative for clip mode, absolute for editor mode)

  // State for undo (stored after execute)
  beforeSegments?: ClipSegment[];
  afterSegmentCount?: number;
  beforeSources?: VideoEditorSource[];
  afterSourceCount?: number;

  // Callback for reloading UI (passed from dialog)
  onReload?: () => Promise<void>;
}

/**
 * Split Command - Splits a segment or source at a specific time
 *
 * Clip Mode: Splits a clip_segment in the database
 * Editor Mode: Splits a video_editor_source in the database
 *
 * Both modes support undo by tracking the before state and restoring it.
 */
export class SplitCommand extends BaseCommand {
  private data: SplitCommandData;

  constructor(editorMode: boolean, data: SplitCommandData) {
    super(editorMode, `Split at ${data.cutTime.toFixed(2)}s`);
    this.data = data;
  }

  async execute(): Promise<void> {
    if (this.editorMode) {
      // Editor mode: Split video_editor_source
      if (!this.data.editorProjectId || this.data.segmentIndex === undefined) {
        throw new Error('Editor mode split requires editorProjectId and segmentIndex');
      }

      // Store state before split for undo
      this.data.beforeSources = await getVideoEditorSourcesByProjectId(this.data.editorProjectId);

      console.log(
        `[SplitCommand] Splitting video source ${this.data.segmentIndex} at time ${this.data.cutTime.toFixed(2)}s`
      );

      // Perform the split in database
      try {
        await splitVideoEditorSource(this.data.editorProjectId, this.data.segmentIndex, this.data.cutTime);
      } catch (splitError) {
        console.error('[SplitCommand] Editor mode split failed:', splitError);
        throw splitError;
      }

      // Store count after split for verification
      const afterSources = await getVideoEditorSourcesByProjectId(this.data.editorProjectId);
      this.data.afterSourceCount = afterSources.length;

      // Call reload callback if provided
      if (this.data.onReload) {
        await this.data.onReload();
      }

      console.log(
        `[SplitCommand] Editor mode split complete, sources: ${this.data.beforeSources.length} → ${this.data.afterSourceCount}`
      );
    } else {
      // Clip mode: Split clip_segment
      if (!this.data.clipId || this.data.segmentIndex === undefined || !this.data.clipStartTime) {
        throw new Error('Clip mode split requires clipId, segmentIndex, and clipStartTime');
      }

      // Store state before split for undo
      this.data.beforeSegments = await getClipSegmentsByClipId(this.data.clipId);

      // Convert relative cut time to absolute source video time
      const absoluteCutTime = this.data.clipStartTime + this.data.cutTime;

      console.log(
        `[SplitCommand] Splitting segment ${this.data.segmentIndex} at absolute time ${absoluteCutTime.toFixed(2)}s`
      );
      console.log('[SplitCommand] Segment data:', {
        clipId: this.data.clipId,
        segmentIndex: this.data.segmentIndex,
        relativeCutTime: this.data.cutTime,
        absoluteCutTime,
        clipStartTime: this.data.clipStartTime,
      });

      // Perform the split in database
      try {
        await splitClipSegment(this.data.clipId, this.data.segmentIndex, absoluteCutTime);
      } catch (splitError) {
        console.error('[SplitCommand] Split failed with error:', splitError);
        console.error('[SplitCommand] Error details:', {
          message: splitError instanceof Error ? splitError.message : String(splitError),
          stack: splitError instanceof Error ? splitError.stack : 'No stack trace',
        });
        throw splitError;
      }

      // Store count after split for verification
      const afterSegments = await getClipSegmentsByClipId(this.data.clipId);
      this.data.afterSegmentCount = afterSegments.length;

      // Call reload callback if provided
      if (this.data.onReload) {
        await this.data.onReload();
      }

      console.log(
        `[SplitCommand] Split complete, segments: ${this.data.beforeSegments.length} → ${this.data.afterSegmentCount}`
      );
    }
  }

  async undo(): Promise<void> {
    if (this.editorMode) {
      // Editor mode: Restore to before state
      if (!this.data.editorProjectId || !this.data.beforeSources || this.data.segmentIndex === undefined) {
        throw new Error('Cannot undo: missing editor data');
      }

      console.log(
        '[SplitCommand] Undoing editor mode split - restoring',
        this.data.beforeSources.length,
        'sources'
      );

      // Get the original source data before the split
      const originalSource = this.data.beforeSources[this.data.segmentIndex];

      console.log('[SplitCommand] Original source before split:', {
        start_time: originalSource.start_time,
        end_time: originalSource.end_time,
        trim_start: originalSource.trim_start,
        trim_end: originalSource.trim_end,
      });

      // Get current sources
      const currentSources = await getVideoEditorSourcesByProjectId(this.data.editorProjectId);

      // Delete ONLY the one source that was created by the split
      // The split created exactly one new source at index segmentIndex + 1
      const newSourceIndex = this.data.segmentIndex + 1;
      if (newSourceIndex < currentSources.length) {
        console.log('[SplitCommand] Deleting the split-created source at index', newSourceIndex);
        await deleteVideoEditorSource(currentSources[newSourceIndex].id);
      } else {
        console.error('[SplitCommand] Cannot find split-created source to delete');
      }

      // Now restore the original source's times
      console.log(
        '[SplitCommand] Restoring original source times at index',
        this.data.segmentIndex
      );
      console.log('[SplitCommand] Restoring to:', {
        end_time: originalSource.end_time,
        trim_end: originalSource.trim_end,
      });

      await updateVideoEditorSource(currentSources[this.data.segmentIndex].id, {
        end_time: originalSource.end_time,
        trim_end: originalSource.trim_end,
      });

      // Update order_index for remaining sources
      const remainingSources = await getVideoEditorSourcesByProjectId(this.data.editorProjectId);
      for (let i = 0; i < remainingSources.length; i++) {
        if (remainingSources[i].order_index !== i) {
          await updateVideoEditorSource(remainingSources[i].id, {
            order_index: i,
          });
        }
      }

      console.log('[SplitCommand] Editor mode undo complete - source restored to original state');

      // Call reload callback if provided
      if (this.data.onReload) {
        await this.data.onReload();
      }
    } else {
      // Clip mode: Restore to before state
      if (!this.data.clipId || !this.data.beforeSegments || this.data.segmentIndex === undefined) {
        throw new Error('Cannot undo: missing clip data');
      }

      console.log(
        '[SplitCommand] Undoing split - restoring',
        this.data.beforeSegments.length,
        'segments'
      );

      // Get the original segment data before the split
      const originalSegment = this.data.beforeSegments[this.data.segmentIndex];

      console.log('[SplitCommand] Original segment before split:', {
        start_time: originalSegment.start_time,
        end_time: originalSegment.end_time,
        duration: originalSegment.duration,
      });

      // Get current segments
      const currentSegments = await getClipSegmentsByClipId(this.data.clipId);

      // Delete all segments after the original segment
      // The split created one extra segment, so we delete from the split point onward
      const deleteFrom = this.data.segmentIndex + 1;
      for (let i = currentSegments.length - 1; i >= deleteFrom; i--) {
        console.log('[SplitCommand] Deleting extra segment at index', i);
        await deleteClipSegment(this.data.clipId, i);
      }

      // Now restore the original segment's times
      // The left segment (at segmentIndex) currently has the shortened end time
      // We need to restore it to the original end time
      console.log(
        '[SplitCommand] Restoring original segment times at index',
        this.data.segmentIndex
      );
      console.log('[SplitCommand] Restoring to:', {
        start_time: originalSegment.start_time,
        end_time: originalSegment.end_time,
        duration: originalSegment.duration,
      });

      await updateClipSegment(
        this.data.clipId,
        this.data.segmentIndex,
        originalSegment.start_time,
        originalSegment.end_time
      );

      console.log('[SplitCommand] Undo complete - segment restored to original state');

      // Call reload callback if provided
      if (this.data.onReload) {
        await this.data.onReload();
      }
    }
  }
}

/**
 * Delete Command Data Interface
 */
export interface DeleteCommandData {
  // Clip mode data
  clipId?: string;
  segmentId: string;
  clipStartTime?: number;

  // Editor mode data
  editorProjectId?: string;

  // State for undo (stored after execute)
  deletedSegment?: ClipSegment;
  segmentIndex?: number;
  shiftedSegments?: Array<{ index: number; oldStart: number; oldEnd: number }>; // For ripple undo

  // Callback for reloading UI
  onReload?: () => Promise<void>;
}

/**
 * Delete Command - Deletes a segment or source
 *
 * Clip Mode: Deletes a clip_segment from the database
 * Editor Mode: Deletes a video_editor_source from the database
 *
 * Both modes support undo by storing the deleted item and restoring it.
 */
export class DeleteCommand extends BaseCommand {
  private data: DeleteCommandData;

  constructor(editorMode: boolean, data: DeleteCommandData) {
    super(editorMode, `Delete segment ${data.segmentId}`);
    this.data = data;
  }

  async execute(): Promise<void> {
    if (this.editorMode) {
      // Editor mode: Delete video_editor_source
      console.log(
        '[DeleteCommand] Editor mode delete - will be implemented with video editor integration'
      );
      throw new Error('Editor mode delete not yet integrated');
    } else {
      // Clip mode: Delete clip_segment
      if (!this.data.clipId || !this.data.segmentId) {
        throw new Error('Clip mode delete requires clipId and segmentId');
      }

      // Parse segment index from ID (e.g., "segment-0" → 0)
      const segmentIndex = parseInt(this.data.segmentId.replace('segment-', ''));

      if (isNaN(segmentIndex)) {
        throw new Error(`Invalid segment ID format: ${this.data.segmentId}`);
      }

      this.data.segmentIndex = segmentIndex;

      // Store segment data before deleting for undo
      const segments = await getClipSegmentsByClipId(this.data.clipId);
      if (segmentIndex >= 0 && segmentIndex < segments.length) {
        this.data.deletedSegment = segments[segmentIndex];
      }

      console.log(
        `[DeleteCommand] Deleting segment ${segmentIndex} (${this.data.segmentId}) with ripple`
      );

      // Calculate the gap size (duration of deleted segment)
      const deletedDuration = this.data.deletedSegment
        ? this.data.deletedSegment.end_time - this.data.deletedSegment.start_time
        : 0;

      console.log(`[DeleteCommand] Deleted segment duration: ${deletedDuration}s`);

      // Store info about segments that will be shifted (for undo)
      this.data.shiftedSegments = [];

      // Find all segments AFTER the deleted one
      for (let i = segmentIndex + 1; i < segments.length; i++) {
        this.data.shiftedSegments.push({
          index: i,
          oldStart: segments[i].start_time,
          oldEnd: segments[i].end_time,
        });
      }

      console.log(
        `[DeleteCommand] Will shift ${this.data.shiftedSegments.length} segments left by ${deletedDuration}s`
      );

      // Perform the delete in database
      await deleteClipSegment(this.data.clipId, segmentIndex);

      // RIPPLE: Shift all subsequent segments left to close the gap
      // After deletion, all indices shift down by 1
      for (let i = 0; i < this.data.shiftedSegments.length; i++) {
        const newIndex = segmentIndex + i; // New index after deletion
        const oldStart = this.data.shiftedSegments[i].oldStart;
        const oldEnd = this.data.shiftedSegments[i].oldEnd;

        // Shift left by the deleted duration
        const newStart = oldStart - deletedDuration;
        const newEnd = oldEnd - deletedDuration;

        console.log(
          `[DeleteCommand] Shifting segment ${newIndex}: ${oldStart}-${oldEnd} → ${newStart}-${newEnd}`
        );

        await updateClipSegment(this.data.clipId, newIndex, newStart, newEnd);
      }

      // Call reload callback if provided
      if (this.data.onReload) {
        await this.data.onReload();
      }

      console.log(`[DeleteCommand] Delete with ripple complete`);
    }
  }

  async undo(): Promise<void> {
    if (this.editorMode) {
      // Editor mode undo
      console.log(
        '[DeleteCommand] Editor mode undo - will be implemented with video editor integration'
      );
      throw new Error('Editor mode undo not yet integrated');
    } else {
      // Clip mode: Restore deleted segment
      if (!this.data.clipId || !this.data.deletedSegment || this.data.segmentIndex === undefined) {
        throw new Error('Cannot undo: missing delete data');
      }

      console.log(
        '[DeleteCommand] Undoing delete with ripple - restoring segment at index',
        this.data.segmentIndex
      );
      console.log('[DeleteCommand] Restoring segment data:', {
        start_time: this.data.deletedSegment.start_time,
        end_time: this.data.deletedSegment.end_time,
        duration: this.data.deletedSegment.duration,
      });

      const deletedDuration =
        this.data.deletedSegment.end_time - this.data.deletedSegment.start_time;

      // REVERSE RIPPLE: First, shift all subsequent segments RIGHT to make room
      if (this.data.shiftedSegments && this.data.shiftedSegments.length > 0) {
        console.log(
          `[DeleteCommand] Reverse ripple: shifting ${this.data.shiftedSegments.length} segments right by ${deletedDuration}s`
        );

        // Restore segments to their original positions
        for (let i = 0; i < this.data.shiftedSegments.length; i++) {
          const segmentInfo = this.data.shiftedSegments[i];
          const currentIndex = this.data.segmentIndex + i; // Current index (before re-insertion)

          console.log(
            `[DeleteCommand] Restoring segment ${currentIndex} to original position: ${segmentInfo.oldStart}-${segmentInfo.oldEnd}`
          );

          await updateClipSegment(
            this.data.clipId,
            currentIndex,
            segmentInfo.oldStart,
            segmentInfo.oldEnd
          );
        }
      }

      // Re-insert the deleted segment at its original index
      await insertClipSegment(
        this.data.clipId,
        this.data.segmentIndex,
        this.data.deletedSegment.start_time,
        this.data.deletedSegment.end_time,
        this.data.deletedSegment.transcript
      );

      console.log('[DeleteCommand] Segment restored successfully with reverse ripple');

      // Call reload callback to update UI
      if (this.data.onReload) {
        await this.data.onReload();
      }
    }
  }
}

/**
 * Paste Command Data Interface
 */
export interface PasteCommandData {
  // Clip mode data
  clipId?: string;
  clipStartTime?: number;

  // Editor mode data
  editorProjectId?: string;

  // Common data
  pasteAtTime: number; // Timeline position to paste at
  copiedSegment: ClipSegment; // The segment data being pasted

  // State for undo
  pastedSegmentId?: string;
  pastedSegmentIndex?: number;

  // Callback for reloading UI
  onReload?: () => Promise<void>;
}

/**
 * Paste Command - Pastes a copied segment at the playhead position
 *
 * Clip Mode: Inserts a new clip_segment
 * Editor Mode: Inserts a new video_editor_source
 *
 * Supports undo by deleting the pasted segment.
 */
export class PasteCommand extends BaseCommand {
  private data: PasteCommandData;

  constructor(editorMode: boolean, data: PasteCommandData) {
    super(editorMode, `Paste segment at ${data.pasteAtTime.toFixed(2)}s`);
    this.data = data;
  }

  async execute(): Promise<void> {
    if (this.editorMode) {
      // Editor mode: Paste video_editor_source
      console.log('[PasteCommand] Editor mode paste - will be implemented');
      throw new Error('Editor mode paste not yet integrated');
    } else {
      // Clip mode: Paste clip_segment
      if (!this.data.clipId || !this.data.clipStartTime) {
        throw new Error('Clip mode paste requires clipId and clipStartTime');
      }

      console.log('[PasteCommand] Pasting segment at timeline position', this.data.pasteAtTime);
      console.log('[PasteCommand] Copied segment data:', {
        start_time: this.data.copiedSegment.start_time,
        end_time: this.data.copiedSegment.end_time,
        duration: this.data.copiedSegment.duration,
      });

      // Calculate absolute time for paste position
      const absolutePasteTime = this.data.clipStartTime + this.data.pasteAtTime;

      // Get all current segments to determine where to insert
      // Recalculate on each execute (important for redo to work correctly)
      const segments = await getClipSegmentsByClipId(this.data.clipId);

      // Find the index where this segment should be inserted
      // It should be inserted at the position where pasteAtTime falls
      let insertIndex = 0;
      for (let i = 0; i < segments.length; i++) {
        if (absolutePasteTime >= segments[i].start_time) {
          insertIndex = i + 1;
        }
      }

      // Update the index (important for undo to know which segment to delete)
      this.data.pastedSegmentIndex = insertIndex;

      console.log('[PasteCommand] Inserting at index', insertIndex, '(recalculated for redo)');

      // Insert the new segment
      // The segment will be inserted with the copied segment's duration
      const duration = this.data.copiedSegment.duration;
      const newSegment = await insertClipSegment(
        this.data.clipId,
        insertIndex,
        absolutePasteTime,
        absolutePasteTime + duration,
        this.data.copiedSegment.transcript
      );

      this.data.pastedSegmentId = newSegment.id;

      console.log('[PasteCommand] Paste complete, segment ID:', newSegment.id);

      // Call reload callback if provided
      if (this.data.onReload) {
        await this.data.onReload();
      }
    }
  }

  async undo(): Promise<void> {
    if (this.editorMode) {
      console.log('[PasteCommand] Editor mode undo - will be implemented');
      throw new Error('Editor mode undo not yet integrated');
    } else {
      // Clip mode: Delete the pasted segment
      if (!this.data.clipId || this.data.pastedSegmentIndex === undefined) {
        throw new Error('Cannot undo: missing paste data');
      }

      console.log(
        '[PasteCommand] Undoing paste - deleting segment at index',
        this.data.pastedSegmentIndex
      );

      // Delete the pasted segment
      await deleteClipSegment(this.data.clipId, this.data.pastedSegmentIndex);

      console.log('[PasteCommand] Undo complete');

      // Call reload callback if provided
      if (this.data.onReload) {
        await this.data.onReload();
      }
    }
  }
}

/**
 * Move Command Data Interface - for drag operations
 */
export interface MoveCommandData {
  type: 'watermark' | 'text' | 'sticker' | 'effect' | 'audio' | 'filter';
  itemId: string;
  editId: string;
  
  // Original position (for undo)
  originalStartTime: number;
  originalEndTime: number;
  
  // New position (for execute/redo)
  newStartTime: number;
  newEndTime: number;
  
  // Callback for reloading UI
  onReload?: () => Promise<void>;
}

/**
 * Move Command - Moves a track segment to a new position
 * Supports undo/redo for drag operations
 */
export class MoveCommand extends BaseCommand {
  private data: MoveCommandData;

  constructor(data: MoveCommandData) {
    super(true, `Move ${data.type} to ${data.newStartTime.toFixed(2)}s`);
    this.data = data;
  }

  async execute(): Promise<void> {
    // Update the item to the new position
    await this.updateItemPosition(this.data.newStartTime, this.data.newEndTime);
    
    if (this.data.onReload) {
      await this.data.onReload();
    }
  }

  async undo(): Promise<void> {
    // Restore the item to the original position
    await this.updateItemPosition(this.data.originalStartTime, this.data.originalEndTime);
    
    if (this.data.onReload) {
      await this.data.onReload();
    }
  }

  private async updateItemPosition(startTime: number, endTime: number): Promise<void> {
    switch (this.data.type) {
      case 'watermark':
        await updateVideoEditorWatermark(this.data.itemId, { start_time: startTime, end_time: endTime });
        break;
      case 'text':
        await updateVideoEditorTextOverlay(this.data.itemId, { start_time: startTime, end_time: endTime });
        break;
      case 'sticker':
        await updateVideoEditorSticker(this.data.itemId, { start_time: startTime, end_time: endTime });
        break;
      case 'effect':
        await updateVideoEditorEffect(this.data.itemId, { start_time: startTime, end_time: endTime });
        break;
      case 'audio':
        await updateVideoEditorAudioTrack(this.data.itemId, { start_time: startTime, end_time: endTime });
        break;
      case 'filter':
        // Filters are stored differently - would need special handling
        console.warn('[MoveCommand] Filter move not yet implemented');
        break;
    }
  }
}

// Export factory functions for creating commands
export function createSplitCommand(editorMode: boolean, data: SplitCommandData): SplitCommand {
  return new SplitCommand(editorMode, data);
}

export function createDeleteCommand(editorMode: boolean, data: DeleteCommandData): DeleteCommand {
  return new DeleteCommand(editorMode, data);
}

export function createPasteCommand(editorMode: boolean, data: PasteCommandData): PasteCommand {
  return new PasteCommand(editorMode, data);
}

export function createMoveCommand(data: MoveCommandData): MoveCommand {
  return new MoveCommand(data);
}
