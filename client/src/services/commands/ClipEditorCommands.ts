/**
 * Specific Command Implementations for Clip Editor
 *
 * Each command handles both clip mode and editor mode operations.
 */

import { BaseCommand, type ICommand } from './Command';
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
  createVideoEditorAudioTrack,
  deleteVideoEditorAudioTrack,
  createVideoEditorSticker,
  deleteVideoEditorSticker,
  createVideoEditorTextOverlay,
  deleteVideoEditorTextOverlay,
  createVideoEditorWatermark,
  deleteVideoEditorWatermark,
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

/**
 * Extract Audio Command Data Interface
 */
export interface ExtractAudioCommandData {
  editId: string;
  sourceId: string;
  
  // Audio track data
  filePath: string;
  name: string;
  startTime: number;
  endTime: number;
  trackOrder: number;
  
  // State for undo
  createdAudioTrackId?: string;
  
  // Callback for reloading UI
  onReload?: () => Promise<void>;
}

/**
 * Extract Audio Command - Extracts audio from a video source and creates an audio track
 * Supports undo by deleting the created audio track and unmarking the source
 */
export class ExtractAudioCommand extends BaseCommand {
  private data: ExtractAudioCommandData;

  constructor(data: ExtractAudioCommandData) {
    super(true, `Extract audio from source`);
    this.data = data;
  }

  async execute(): Promise<void> {
    console.log('[ExtractAudioCommand] Creating audio track');
    
    // Create the audio track
    const newTrack = await createVideoEditorAudioTrack(this.data.editId, {
      file_path: this.data.filePath,
      name: this.data.name,
      start_time: this.data.startTime,
      end_time: this.data.endTime,
      volume: 1.0,
      fade_in: 0,
      fade_out: 0,
      track_order: this.data.trackOrder,
      is_muted: 0,
      is_solo: 0,
      source_id: this.data.sourceId,
    });
    
    this.data.createdAudioTrackId = newTrack.id;
    
    // Mark the source as having audio extracted
    await updateVideoEditorSource(this.data.sourceId, { audio_extracted: true });
    
    console.log('[ExtractAudioCommand] Audio track created:', newTrack.id);
    
    if (this.data.onReload) {
      await this.data.onReload();
    }
  }

  async undo(): Promise<void> {
    if (!this.data.createdAudioTrackId) {
      throw new Error('Cannot undo: no audio track ID');
    }
    
    console.log('[ExtractAudioCommand] Undoing - deleting audio track:', this.data.createdAudioTrackId);
    
    // Delete the audio track
    await deleteVideoEditorAudioTrack(this.data.createdAudioTrackId);
    
    // Unmark the source
    await updateVideoEditorSource(this.data.sourceId, { audio_extracted: false });
    
    console.log('[ExtractAudioCommand] Undo complete');
    
    if (this.data.onReload) {
      await this.data.onReload();
    }
  }
}

/**
 * Add Item Command Data Interface - for adding stickers, text, watermarks, etc.
 */
export interface AddItemCommandData {
  type: 'sticker' | 'text' | 'watermark';
  editId: string;
  itemData: Record<string, unknown>;
  
  // State for undo
  createdItemId?: string;
  
  // Callback for reloading UI
  onReload?: () => Promise<void>;
}

/**
 * Add Item Command - Adds a new item (sticker, text, watermark) to the timeline
 * Supports undo by deleting the created item
 */
export class AddItemCommand extends BaseCommand {
  private data: AddItemCommandData;

  constructor(data: AddItemCommandData) {
    super(true, `Add ${data.type}`);
    this.data = data;
  }

  async execute(): Promise<void> {
    console.log(`[AddItemCommand] Adding ${this.data.type}`);
    
    let createdItem: { id: string };
    
    switch (this.data.type) {
      case 'sticker':
        createdItem = await createVideoEditorSticker(this.data.editId, this.data.itemData);
        break;
      case 'text':
        createdItem = await createVideoEditorTextOverlay(this.data.editId, this.data.itemData);
        break;
      case 'watermark':
        createdItem = await createVideoEditorWatermark(this.data.editId, this.data.itemData);
        break;
      default:
        throw new Error(`Unknown item type: ${this.data.type}`);
    }
    
    this.data.createdItemId = createdItem.id;
    console.log(`[AddItemCommand] ${this.data.type} created:`, createdItem.id);
    
    if (this.data.onReload) {
      await this.data.onReload();
    }
  }

  async undo(): Promise<void> {
    if (!this.data.createdItemId) {
      throw new Error('Cannot undo: no item ID');
    }
    
    console.log(`[AddItemCommand] Undoing - deleting ${this.data.type}:`, this.data.createdItemId);
    
    switch (this.data.type) {
      case 'sticker':
        await deleteVideoEditorSticker(this.data.createdItemId);
        break;
      case 'text':
        await deleteVideoEditorTextOverlay(this.data.createdItemId);
        break;
      case 'watermark':
        await deleteVideoEditorWatermark(this.data.createdItemId);
        break;
    }
    
    console.log(`[AddItemCommand] Undo complete`);
    
    if (this.data.onReload) {
      await this.data.onReload();
    }
  }
}

/**
 * Resize Command Data Interface - for resize operations
 */
export interface ResizeCommandData {
  type: 'watermark' | 'text' | 'sticker' | 'effect' | 'audio' | 'filter' | 'source';
  itemId: string;
  editId: string;
  
  // Original position (for undo)
  originalStartTime: number;
  originalEndTime: number;
  originalTrimStart?: number;
  originalTrimEnd?: number;
  
  // New position (for execute/redo)
  newStartTime: number;
  newEndTime: number;
  newTrimStart?: number;
  newTrimEnd?: number;
  
  // Callback for reloading UI
  onReload?: () => Promise<void>;
}

/**
 * Resize Command - Resizes a track segment
 * Supports undo/redo for resize operations
 */
export class ResizeCommand extends BaseCommand {
  private data: ResizeCommandData;

  constructor(data: ResizeCommandData) {
    super(true, `Resize ${data.type}`);
    this.data = data;
  }

  async execute(): Promise<void> {
    await this.updateItemTimes(
      this.data.newStartTime,
      this.data.newEndTime,
      this.data.newTrimStart,
      this.data.newTrimEnd
    );
    
    if (this.data.onReload) {
      await this.data.onReload();
    }
  }

  async undo(): Promise<void> {
    await this.updateItemTimes(
      this.data.originalStartTime,
      this.data.originalEndTime,
      this.data.originalTrimStart,
      this.data.originalTrimEnd
    );
    
    if (this.data.onReload) {
      await this.data.onReload();
    }
  }

  private async updateItemTimes(
    startTime: number,
    endTime: number,
    trimStart?: number,
    trimEnd?: number
  ): Promise<void> {
    switch (this.data.type) {
      case 'source':
        const sourceUpdate: Record<string, unknown> = {
          start_time: startTime,
          end_time: endTime,
        };
        if (trimStart !== undefined) sourceUpdate.trim_start = trimStart;
        if (trimEnd !== undefined) sourceUpdate.trim_end = trimEnd;
        await updateVideoEditorSource(this.data.itemId, sourceUpdate);
        break;
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
      default:
        console.warn(`[ResizeCommand] Unknown type: ${this.data.type}`);
    }
  }
}

/**
 * Ripple Edit Command Data Interface
 */
export interface RippleEditCommandData {
  type: 'trim' | 'source' | 'audio' | 'text' | 'sticker' | 'watermark' | 'effect' | 'filter';
  itemId: string;
  editId?: string; // For editor mode items
  clipId?: string; // For clip mode items
  projectId?: string; // For searching other sources to shift

  // Resize details
  newStartTime: number;
  newEndTime: number;
  delta: number;

  // State for undo
  originalStartTime: number;
  originalEndTime: number;
  shiftedItems?: Array<{ id: string; type: string; oldStart: number; oldEnd: number }>;

  // Callback for reloading UI
  onReload?: () => Promise<void>;
}

/**
 * Ripple Edit Command - Resizes an item and shifts subsequent items
 */
export class RippleEditCommand extends BaseCommand {
  private data: RippleEditCommandData;

  constructor(editorMode: boolean, data: RippleEditCommandData) {
    super(editorMode, `Ripple Edit ${data.type}`);
    this.data = data;
  }

  async execute(): Promise<void> {
    console.log(`[RippleEditCommand] Executing ripple edit on ${this.data.itemId} with delta ${this.data.delta}`);

    // 1. Resize the target item
    if (this.editorMode) {
      if (this.data.type === 'source') {
        await updateVideoEditorSource(this.data.itemId, {
          start_time: this.data.newStartTime,
          end_time: this.data.newEndTime,
        });
      }
      // Add other types if needed (audio, overlay, etc. typically don't ripple in the same way or are separate tracks)
    } else {
      // Clip mode (trim segments) - Find segment index and update
      if (this.data.clipId && this.data.type === 'trim') {
        // We need the index for clip segments... tricky if we only have ID.
        // Assuming ID is format "segment-{index}" or we lookup.
        // But clip segments are defined by their sequence.
        // Actually, updateClipSegment takes index.
        // Let's assume we can parse index from ID or find it.
        const segmentIndex = parseInt(this.data.itemId.replace('segment-', ''));
        if (!isNaN(segmentIndex)) {
           // Clip mode ripple is implicit in the sequence structure usually,
           // but if we are storing start/end times explicitly in DB, we update them.
           // However, `updateClipSegment` updates a specific segment.
           // `getClipSegmentsByClipId` returns them in order.
           // We'll need to shift subsequent segments.
           await updateClipSegment(this.data.clipId, segmentIndex, this.data.newStartTime, this.data.newEndTime);
        }
      }
    }

    // 2. Shift subsequent items
    this.data.shiftedItems = [];

    if (this.editorMode && this.data.projectId && this.data.type === 'source') {
      // Find all sources that start after the *original* end of this item (or start, roughly)
      // Standard ripple: items starting >= original edge move by delta.
      // Simplification: Shift all sources with start_time > originalStartTime
      // (This covers resizing end, and resizing start if we consider how ripple works)
      // Actually, let's look at the edge:
      // If we adjusted right edge: originalEndTime. Shift things > originalEndTime.
      // If we adjusted left edge: originalStartTime. Shift things > originalStartTime.
      // But resizing left edge of *this* clip shifts *this* clip (handled by resize) and everything after.
      // So simply: find all items starting AFTER the item's original start (non-inclusive of self if self handled)
      // We need to fetch all sources.

      const allSources = await getVideoEditorSourcesByProjectId(this.data.projectId);
      // Filter out self
      const otherSources = allSources.filter(s => s.id !== this.data.itemId);

      // Determine the threshold time for shifting
      // Generally, anything that starts after the modified item should shift.
      // We can use the item's max original time as a safe bet, or just its original start if maintaining order.
      const threshold = Math.min(this.data.originalStartTime, this.data.originalEndTime);

      for (const source of otherSources) {
        if (source.start_time >= threshold) {
          // Store for undo
          this.data.shiftedItems.push({
            id: source.id,
            type: 'source',
            oldStart: source.start_time,
            oldEnd: source.end_time
          });

          // Update
          await updateVideoEditorSource(source.id, {
            start_time: source.start_time + this.data.delta,
            end_time: source.end_time + this.data.delta
          });
        }
      }
    } else if (!this.editorMode && this.data.clipId && this.data.type === 'trim') {
       // Clip mode ripple
       const segments = await getClipSegmentsByClipId(this.data.clipId);
       const segmentIndex = parseInt(this.data.itemId.replace('segment-', ''));

       for (let i = segmentIndex + 1; i < segments.length; i++) {
         const seg = segments[i];
         this.data.shiftedItems.push({
           id: `segment-${i}`,
           type: 'trim',
           oldStart: seg.start_time,
           oldEnd: seg.end_time
         });

         await updateClipSegment(this.data.clipId, i, seg.start_time + this.data.delta, seg.end_time + this.data.delta);
       }
    }

    if (this.data.onReload) {
      await this.data.onReload();
    }
  }

  async undo(): Promise<void> {
    console.log(`[RippleEditCommand] Undoing ripple edit`);

    // 1. Restore the target item
    if (this.editorMode) {
      if (this.data.type === 'source') {
        await updateVideoEditorSource(this.data.itemId, {
          start_time: this.data.originalStartTime,
          end_time: this.data.originalEndTime,
        });
      }
    } else {
      if (this.data.clipId && this.data.type === 'trim') {
        const segmentIndex = parseInt(this.data.itemId.replace('segment-', ''));
        if (!isNaN(segmentIndex)) {
           await updateClipSegment(this.data.clipId, segmentIndex, this.data.originalStartTime, this.data.originalEndTime);
        }
      }
    }

    // 2. Restore shifted items
    if (this.data.shiftedItems) {
      for (const item of this.data.shiftedItems) {
        if (item.type === 'source') {
          await updateVideoEditorSource(item.id, {
            start_time: item.oldStart,
            end_time: item.oldEnd
          });
        } else if (item.type === 'trim' && this.data.clipId) {
           const idx = parseInt(item.id.replace('segment-', ''));
           await updateClipSegment(this.data.clipId, idx, item.oldStart, item.oldEnd);
        }
      }
    }

    if (this.data.onReload) {
      await this.data.onReload();
    }
  }
}

export function createRippleEditCommand(editorMode: boolean, data: RippleEditCommandData): RippleEditCommand {
  return new RippleEditCommand(editorMode, data);
}

/**
 * Roll Edit Command Data Interface
 */
export interface RollEditCommandData {
  type: 'source' | 'trim';
  leftItemId: string;
  rightItemId: string;
  editId?: string;
  clipId?: string;
  projectId?: string;

  // The new time for the cut point
  newRollTime: number;

  // Undo state
  originalRollTime: number;
  
  // For restoring exact trims if needed (optional but good for robustness)
  leftSourceSnapshot?: { end: number; trimEnd: number | null };
  rightSourceSnapshot?: { start: number; trimStart: number };

  onReload?: () => Promise<void>;
}

/**
 * Roll Edit Command - Adjusts the cut point between two adjacent clips
 * Extends the first clip and shortens the second (or vice-versa) while maintaining overall duration
 */
export class RollEditCommand extends BaseCommand {
  private data: RollEditCommandData;

  constructor(editorMode: boolean, data: RollEditCommandData) {
    super(editorMode, `Roll Edit at ${data.newRollTime.toFixed(2)}s`);
    this.data = data;
  }

  async execute(): Promise<void> {
    const { leftItemId, rightItemId, newRollTime, originalRollTime } = this.data;
    const delta = newRollTime - originalRollTime;
    
    console.log(`[RollEditCommand] Rolling cut from ${originalRollTime.toFixed(2)}s to ${newRollTime.toFixed(2)}s (delta: ${delta.toFixed(2)}s)`);

    if (this.editorMode && this.data.type === 'source') {
      if (!this.data.projectId) throw new Error('Project ID required for editor roll edit');

      // 1. Update Left Source (End moves)
      // Need current state to calculate trims properly? 
      // Actually, we can fetch them or assume the caller passed snapshots.
      // But simple update logic:
      // Left Source: end_time = newRollTime. trim_end += delta.
      
      // We need to fetch to get current trim_end if not provided, but updateVideoEditorSource is a patch.
      // Ideally we read the source first to be safe, but let's assume we can calculate if we trust the inputs.
      // Better to fetch to ensure data integrity regarding trim limits?
      // For now, let's assume the UI logic validated the constraints and we just apply the delta.
      
      const sources = await getVideoEditorSourcesByProjectId(this.data.projectId);
      const leftSource = sources.find(s => s.id === leftItemId);
      const rightSource = sources.find(s => s.id === rightItemId);

      if (!leftSource || !rightSource) throw new Error('Sources not found for roll edit');

      // Capture snapshots for undo if not already present
      if (!this.data.leftSourceSnapshot) {
        this.data.leftSourceSnapshot = { end: leftSource.end_time, trimEnd: leftSource.trim_end };
      }
      if (!this.data.rightSourceSnapshot) {
        this.data.rightSourceSnapshot = { start: rightSource.start_time, trimStart: rightSource.trim_start };
      }

      // Update Left Source
      // end_time becomes newRollTime
      // trim_end increases by delta (delta is new - old)
      // Note: trim_end might be null (implicit end of file). If so, we must calculate it? 
      // Actually, if trim_end is null, it means "play until end". If we are rolling, we definitely define a specific end.
      // But typically clips adjacent on timeline have explicit trims if they are being rolled.
      // If left source trim_end is null, we assume it was playing full length. 
      // We need to know where it effectively ended to add delta.
      // effective trim_end = trim_start + (end_time - start_time).
      
      let leftTrimEnd = leftSource.trim_end;
      if (leftTrimEnd === null || leftTrimEnd === undefined) {
        leftTrimEnd = leftSource.trim_start + (leftSource.end_time - leftSource.start_time);
      }
      const newLeftTrimEnd = leftTrimEnd + delta;

      await updateVideoEditorSource(leftItemId, {
        end_time: newRollTime,
        trim_end: newLeftTrimEnd
      });

      // Update Right Source
      // start_time becomes newRollTime
      // trim_start increases by delta
      const newRightTrimStart = rightSource.trim_start + delta;
      
      await updateVideoEditorSource(rightItemId, {
        start_time: newRollTime,
        trim_start: newRightTrimStart
      });

    } else if (!this.editorMode && this.data.type === 'trim' && this.data.clipId) {
      // Clip Mode (Trim Segments)
      // Segments are typically just start/end relative to clip.
      // Left segment: endTime = newRollTime
      // Right segment: startTime = newRollTime
      
      // We need indices for clip segments usually.
      // Assuming IDs contain index or we can map them.
      // The updateClipSegment function takes index.
      const leftIndex = parseInt(leftItemId.replace('segment-', ''));
      const rightIndex = parseInt(rightItemId.replace('segment-', ''));
      
      if (!isNaN(leftIndex) && !isNaN(rightIndex)) {
        // Need to fetch to get current other bounds?
        // updateClipSegment requires both start and end.
        const segments = await getClipSegmentsByClipId(this.data.clipId);
        const leftSeg = segments[leftIndex];
        const rightSeg = segments[rightIndex];
        
        if (leftSeg && rightSeg) {
           await updateClipSegment(this.data.clipId, leftIndex, leftSeg.start_time, newRollTime);
           await updateClipSegment(this.data.clipId, rightIndex, newRollTime, rightSeg.end_time);
        }
      }
    }

    if (this.data.onReload) {
      await this.data.onReload();
    }
  }

  async undo(): Promise<void> {
    console.log(`[RollEditCommand] Undoing roll edit`);
    
    if (this.editorMode && this.data.type === 'source') {
      const { leftItemId, rightItemId, leftSourceSnapshot, rightSourceSnapshot, originalRollTime } = this.data;
      
      if (leftSourceSnapshot) {
        await updateVideoEditorSource(leftItemId, {
          end_time: originalRollTime,
          trim_end: leftSourceSnapshot.trimEnd
        });
      }
      
      if (rightSourceSnapshot) {
        await updateVideoEditorSource(rightItemId, {
          start_time: originalRollTime,
          trim_start: rightSourceSnapshot.trimStart
        });
      }
    } else if (!this.editorMode && this.data.type === 'trim' && this.data.clipId) {
      const { leftItemId, rightItemId, originalRollTime } = this.data;
      const leftIndex = parseInt(leftItemId.replace('segment-', ''));
      const rightIndex = parseInt(rightItemId.replace('segment-', ''));
      
      const segments = await getClipSegmentsByClipId(this.data.clipId);
      const leftSeg = segments[leftIndex];
      const rightSeg = segments[rightIndex];
      
      if (leftSeg && rightSeg) {
         await updateClipSegment(this.data.clipId, leftIndex, leftSeg.start_time, originalRollTime);
         await updateClipSegment(this.data.clipId, rightIndex, originalRollTime, rightSeg.end_time);
      }
    }

    if (this.data.onReload) {
      await this.data.onReload();
    }
  }
}

export function createRollEditCommand(editorMode: boolean, data: RollEditCommandData): RollEditCommand {
  return new RollEditCommand(editorMode, data);
}

/**
 * Slip Edit Command Data Interface
 */
export interface SlipEditCommandData {
  type: 'source' | 'trim';
  itemId: string;
  editId?: string;
  clipId?: string;
  
  // The slip amount (change in source content time)
  delta: number;
  
  // Undo state
  originalTrimStart: number;
  originalTrimEnd: number | null;
  
  onReload?: () => Promise<void>;
}

/**
 * Slip Edit Command - Changes the content of a clip without changing its position or duration
 */
export class SlipEditCommand extends BaseCommand {
  private data: SlipEditCommandData;

  constructor(editorMode: boolean, data: SlipEditCommandData) {
    super(editorMode, `Slip Edit (${data.delta.toFixed(2)}s)`);
    this.data = data;
  }

  async execute(): Promise<void> {
    console.log(`[SlipEditCommand] Slipping ${this.data.itemId} by ${this.data.delta}s`);
    
    const { originalTrimStart, originalTrimEnd, delta } = this.data;
    const newTrimStart = Math.max(0, originalTrimStart + delta);
    // If trimEnd is null (implicit), we must resolve it first in UI logic usually, but here we can keep it null if we want?
    // Slip usually implies we have specific in/out points. If end is implicit, we calculate it from duration.
    // Let's assume input data has handled resolution if needed, or we just shift defined values.
    // Actually, if trim_end is null, we can't really slip "later" easily without knowing max duration.
    // Assuming UI passed valid originalTrimEnd or we treat null as "end of file" which might effectively prevent slipping forward if maxed out.
    // For now, let's just update what we have.
    
    let newTrimEnd = originalTrimEnd;
    if (originalTrimEnd !== null && originalTrimEnd !== undefined) {
      newTrimEnd = originalTrimEnd + delta;
    }

    if (this.editorMode && this.data.type === 'source') {
      await updateVideoEditorSource(this.data.itemId, {
        trim_start: newTrimStart,
        trim_end: newTrimEnd
      });
    } else {
      // Clip mode slip not typically supported on simple trim segments unless they have "source" media handle logic
      // But we can implement if needed. Clip segments usually are just slices of ONE source video.
      // So slipping a segment means changing its start_time/end_time referring to the raw video.
      // But in clip mode, start_time/end_time ARE the "trim" points relative to source.
      // So updating them changes content AND position unless we also shift everything else?
      // Wait, in clip mode, segments are sequential. Changing start_time/end_time of a segment usually implies changing its duration or gaps.
      // If we want to SLIP, we change the *portion* of the raw video it plays, but keep its duration.
      // ClipSegment: start_time, end_time (absolute times in raw video).
      // So slipping means start_time += delta, end_time += delta.
      // BUT this does not change its position in the timeline sequence because that is implicit.
      // So yes, for Clip Mode, updateClipSegment with shifted times.
      
      if (this.data.clipId && this.data.type === 'trim') {
        const segmentIndex = parseInt(this.data.itemId.replace('segment-', ''));
        if (!isNaN(segmentIndex)) {
           // We need to pass the full new times.
           // originalTrimStart is actually start_time in clip mode
           // originalTrimEnd is end_time
           if (newTrimEnd !== null) {
             await updateClipSegment(this.data.clipId, segmentIndex, newTrimStart, newTrimEnd);
           }
        }
      }
    }

    if (this.data.onReload) {
      await this.data.onReload();
    }
  }

  async undo(): Promise<void> {
    console.log(`[SlipEditCommand] Undoing slip edit`);
    const { originalTrimStart, originalTrimEnd } = this.data;

    if (this.editorMode && this.data.type === 'source') {
      await updateVideoEditorSource(this.data.itemId, {
        trim_start: originalTrimStart,
        trim_end: originalTrimEnd
      });
    } else {
      if (this.data.clipId && this.data.type === 'trim') {
        const segmentIndex = parseInt(this.data.itemId.replace('segment-', ''));
        if (!isNaN(segmentIndex) && originalTrimEnd !== null) {
           await updateClipSegment(this.data.clipId, segmentIndex, originalTrimStart, originalTrimEnd);
        }
      }
    }

    if (this.data.onReload) {
      await this.data.onReload();
    }
  }
}

export function createSlipEditCommand(editorMode: boolean, data: SlipEditCommandData): SlipEditCommand {
  return new SlipEditCommand(editorMode, data);
}

/**
 * Slide Edit Command Data Interface
 */
export interface SlideEditCommandData {
  type: 'source' | 'trim';
  itemId: string;
  leftNeighborId: string;
  rightNeighborId: string;
  editId?: string;
  clipId?: string;
  projectId?: string;

  // Amount to slide (change in position)
  delta: number;

  // Undo state
  originalStartTime: number;
  originalEndTime: number;
  leftNeighborSnapshot?: { end: number; trimEnd: number | null };
  rightNeighborSnapshot?: { start: number; trimStart: number };

  onReload?: () => Promise<void>;
}

/**
 * Slide Edit Command - Moves a clip while adjusting adjacent clips to maintain total duration
 */
export class SlideEditCommand extends BaseCommand {
  private data: SlideEditCommandData;

  constructor(editorMode: boolean, data: SlideEditCommandData) {
    super(editorMode, `Slide Edit (${data.delta.toFixed(2)}s)`);
    this.data = data;
  }

  async execute(): Promise<void> {
    console.log(`[SlideEditCommand] Sliding ${this.data.itemId} by ${this.data.delta}s`);
    const { delta, itemId, leftNeighborId, rightNeighborId } = this.data;

    if (this.editorMode && this.data.type === 'source') {
      if (!this.data.projectId) throw new Error('Project ID required for editor slide edit');

      const sources = await getVideoEditorSourcesByProjectId(this.data.projectId);
      const targetSource = sources.find(s => s.id === itemId);
      const leftSource = sources.find(s => s.id === leftNeighborId);
      const rightSource = sources.find(s => s.id === rightNeighborId);

      if (!targetSource || !leftSource || !rightSource) throw new Error('Sources not found for slide edit');

      // Capture snapshots if missing
      if (!this.data.leftNeighborSnapshot) {
        this.data.leftNeighborSnapshot = { end: leftSource.end_time, trimEnd: leftSource.trim_end };
      }
      if (!this.data.rightNeighborSnapshot) {
        this.data.rightNeighborSnapshot = { start: rightSource.start_time, trimStart: rightSource.trim_start };
      }

      // 1. Move the Target Source
      await updateVideoEditorSource(itemId, {
        start_time: targetSource.start_time + delta,
        end_time: targetSource.end_time + delta
      });

      // 2. Adjust Left Neighbor (End changes)
      // end_time += delta
      // trim_end += delta
      let leftTrimEnd = leftSource.trim_end;
      if (leftTrimEnd === null || leftTrimEnd === undefined) {
        leftTrimEnd = leftSource.trim_start + (leftSource.end_time - leftSource.start_time);
      }
      await updateVideoEditorSource(leftNeighborId, {
        end_time: leftSource.end_time + delta,
        trim_end: leftTrimEnd + delta
      });

      // 3. Adjust Right Neighbor (Start changes)
      // start_time += delta
      // trim_start += delta
      await updateVideoEditorSource(rightNeighborId, {
        start_time: rightSource.start_time + delta,
        trim_start: rightSource.trim_start + delta
      });

    } else {
      // Clip mode slide
      // Not fully implemented for segments usually, but follows same logic if segment IDs are indices
      // Need getClipSegmentsByClipId logic similar to Roll
    }

    if (this.data.onReload) {
      await this.data.onReload();
    }
  }

  async undo(): Promise<void> {
    console.log(`[SlideEditCommand] Undoing slide edit`);
    
    if (this.editorMode && this.data.type === 'source') {
      const { itemId, leftNeighborId, rightNeighborId, originalStartTime, originalEndTime, leftNeighborSnapshot, rightNeighborSnapshot } = this.data;

      // Restore Target
      await updateVideoEditorSource(itemId, {
        start_time: originalStartTime,
        end_time: originalEndTime
      });

      // Restore Left
      if (leftNeighborSnapshot) {
        await updateVideoEditorSource(leftNeighborId, {
          end_time: originalStartTime, // Left ends where target started
          trim_end: leftNeighborSnapshot.trimEnd
        });
      }

      // Restore Right
      if (rightNeighborSnapshot) {
        await updateVideoEditorSource(rightNeighborId, {
          start_time: originalEndTime, // Right starts where target ended
          trim_start: rightNeighborSnapshot.trimStart
        });
      }
    }

    if (this.data.onReload) {
      await this.data.onReload();
    }
  }
}

export function createSlideEditCommand(editorMode: boolean, data: SlideEditCommandData): SlideEditCommand {
  return new SlideEditCommand(editorMode, data);
}

/**
 * Layer Change Command Data Interface - for moving items between layers
 */
export interface LayerChangeCommandData {
  type: 'sticker' | 'text' | 'watermark' | 'source';
  itemId: string;
  
  // Original layer (for undo)
  originalLayer: number;
  
  // New layer (for execute/redo)
  newLayer: number;
  
  // Callback for reloading UI
  onReload?: () => Promise<void>;
}

/**
 * Layer Change Command - Moves an item to a different layer
 * Supports undo/redo for layer changes
 */
export class LayerChangeCommand extends BaseCommand {
  private data: LayerChangeCommandData;

  constructor(data: LayerChangeCommandData) {
    super(true, `Move ${data.type} to layer ${data.newLayer}`);
    this.data = data;
  }

  async execute(): Promise<void> {
    await this.updateItemLayer(this.data.newLayer);
    
    if (this.data.onReload) {
      await this.data.onReload();
    }
  }

  async undo(): Promise<void> {
    await this.updateItemLayer(this.data.originalLayer);
    
    if (this.data.onReload) {
      await this.data.onReload();
    }
  }

  private async updateItemLayer(layer: number): Promise<void> {
    switch (this.data.type) {
      case 'sticker':
        await updateVideoEditorSticker(this.data.itemId, { layer });
        break;
      case 'text':
        await updateVideoEditorTextOverlay(this.data.itemId, { layer });
        break;
      case 'watermark':
        await updateVideoEditorWatermark(this.data.itemId, { layer });
        break;
      case 'source':
        // Sources use track_index instead of layer
        await updateVideoEditorSource(this.data.itemId, { track_index: layer });
        break;
      default:
        console.warn(`[LayerChangeCommand] Unknown type: ${this.data.type}`);
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

export function createExtractAudioCommand(data: ExtractAudioCommandData): ExtractAudioCommand {
  return new ExtractAudioCommand(data);
}

export function createAddItemCommand(data: AddItemCommandData): AddItemCommand {
  return new AddItemCommand(data);
}

export function createResizeCommand(data: ResizeCommandData): ResizeCommand {
  return new ResizeCommand(data);
}

export function createLayerChangeCommand(data: LayerChangeCommandData): LayerChangeCommand {
  return new LayerChangeCommand(data);
}

/**
 * Update Overlay Property Command Data Interface
 * For position, scale, rotation, width changes on overlays
 */
export interface UpdateOverlayPropertyCommandData {
  type: 'text' | 'sticker' | 'watermark' | 'subtitle';
  itemId?: string; // Not needed for subtitle (global settings)
  property: 'position' | 'scale' | 'rotation' | 'width' | 'maxWidth';
  aspectRatio: string; // e.g., '9:16', '16:9', '1:1'
  
  // Original value (for undo)
  originalValue: number | { x: number; y: number };
  
  // New value (for execute/redo)
  newValue: number | { x: number; y: number };
  
  // Callback for reloading UI
  onReload?: () => Promise<void>;
}

/**
 * Update Overlay Property Command
 * Handles position, scale, rotation, and width changes for overlays
 * Supports undo/redo with per-aspect-ratio configurations
 */
export class UpdateOverlayPropertyCommand extends BaseCommand {
  private data: UpdateOverlayPropertyCommandData;

  constructor(editorMode: boolean, data: UpdateOverlayPropertyCommandData) {
    const valueStr = typeof data.newValue === 'object' 
      ? `(${data.newValue.x.toFixed(1)}, ${data.newValue.y.toFixed(1)})`
      : data.newValue.toFixed(1);
    super(editorMode, `Update ${data.type} ${data.property} to ${valueStr}`);
    this.data = data;
  }

  async execute(): Promise<void> {
    await this.updateProperty(this.data.newValue);
    
    if (this.data.onReload) {
      await this.data.onReload();
    }
  }

  async undo(): Promise<void> {
    await this.updateProperty(this.data.originalValue);
    
    if (this.data.onReload) {
      await this.data.onReload();
    }
  }

  private async updateProperty(value: number | { x: number; y: number }): Promise<void> {
    // For clip mode, these updates are handled through the reactive state in ClipEditorDialog
    // For editor mode, we need to update the database records
    
    if (!this.editorMode) {
      // Clip mode: Updates are handled through reactive state, no database changes needed
      // The onReload callback will trigger the UI update
      return;
    }

    // Editor mode: Update database records
    if (this.data.type === 'subtitle') {
      // Subtitle settings are global, handled differently
      // Would need to update video_editor_subtitle_settings table
      console.warn('[UpdateOverlayPropertyCommand] Subtitle updates not yet implemented for editor mode');
      return;
    }

    if (!this.data.itemId) {
      throw new Error('Item ID required for non-subtitle updates');
    }

    // Build the update object based on property type
    const update: Record<string, unknown> = {};
    
    // Get the ratio config key for this aspect ratio
    const ratioKey = `ratio_configs.${this.data.aspectRatio}`;
    
    switch (this.data.property) {
      case 'position':
        if (typeof value === 'object') {
          update[`${ratioKey}.position`] = value;
        }
        break;
      case 'scale':
        if (typeof value === 'number') {
          update[`${ratioKey}.scale`] = value;
        }
        break;
      case 'rotation':
        if (typeof value === 'number') {
          update[`${ratioKey}.rotation`] = value;
        }
        break;
      case 'width':
      case 'maxWidth':
        if (typeof value === 'number') {
          update[`${ratioKey}.style.maxWidth`] = value;
        }
        break;
    }

    // Update the appropriate table based on type
    switch (this.data.type) {
      case 'text':
        await updateVideoEditorTextOverlay(this.data.itemId, update);
        break;
      case 'sticker':
        await updateVideoEditorSticker(this.data.itemId, update);
        break;
      case 'watermark':
        await updateVideoEditorWatermark(this.data.itemId, update);
        break;
    }
  }

  /**
   * Check if this command can be merged with another
   * Allow merging of sequential property updates on the same item
   */
  canMerge(other: ICommand): boolean {
    if (!(other instanceof UpdateOverlayPropertyCommand)) {
      return false;
    }
    
    // Can merge if same type, item, property, and aspect ratio
    return (
      this.data.type === other.data.type &&
      this.data.itemId === other.data.itemId &&
      this.data.property === other.data.property &&
      this.data.aspectRatio === other.data.aspectRatio
    );
  }

  /**
   * Merge with another command
   * Keep the original value from this command, update to the new value from other
   */
  merge(other: ICommand): void {
    if (!(other instanceof UpdateOverlayPropertyCommand)) {
      throw new Error('Cannot merge with non-UpdateOverlayPropertyCommand');
    }
    
    // Keep our original value, but update to the other command's new value
    this.data.newValue = other.data.newValue;
    
    // Note: description is readonly, so we can't update it after construction
    // The description will reflect the first value, but the actual command will use the merged value
  }
}

export function createUpdateOverlayPropertyCommand(
  editorMode: boolean,
  data: UpdateOverlayPropertyCommandData
): UpdateOverlayPropertyCommand {
  return new UpdateOverlayPropertyCommand(editorMode, data);
}
