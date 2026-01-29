/**
 * Split Source Command
 * 
 * Splits a video source at the current playhead position.
 * This works for video editor mode only.
 */

import { BaseCommand } from './Command';
import {
  splitVideoEditorSource,
  getVideoEditorSourcesByProjectId,
  updateVideoEditorSource,
  deleteVideoEditorSource,
  type VideoEditorSource,
} from '../database/video-editor-projects';

export class SplitSourceCommand extends BaseCommand {
  private projectId: string;
  private sourceIndexToSplit: number;
  private cutTime: number;
  
  // For undo: store the original source and the created source ID
  private originalSource: VideoEditorSource | null = null;
  private createdSourceId: string | null = null;

  constructor(projectId: string, sourceIndexToSplit: number, cutTime: number) {
    super(true, `Split source at ${cutTime.toFixed(2)}s`);
    this.projectId = projectId;
    this.sourceIndexToSplit = sourceIndexToSplit;
    this.cutTime = cutTime;
  }

  async execute(): Promise<void> {
    // Get the source before splitting (for undo)
    const sources = await getVideoEditorSourcesByProjectId(this.projectId);
    if (this.sourceIndexToSplit < 0 || this.sourceIndexToSplit >= sources.length) {
      throw new Error(`Invalid source index: ${this.sourceIndexToSplit}`);
    }
    
    this.originalSource = { ...sources[this.sourceIndexToSplit] };

    // Perform the split
    await splitVideoEditorSource(this.projectId, this.sourceIndexToSplit, this.cutTime);

    // Find the newly created source (it will be at sourceIndexToSplit + 1)
    const sourcesAfter = await getVideoEditorSourcesByProjectId(this.projectId);
    this.createdSourceId = sourcesAfter[this.sourceIndexToSplit + 1]?.id || null;

    console.log('[SplitSourceCommand] Executed split:', {
      originalId: this.originalSource.id,
      createdId: this.createdSourceId,
      cutTime: this.cutTime,
    });
  }

  async undo(): Promise<void> {
    if (!this.originalSource || !this.createdSourceId) {
      throw new Error('Cannot undo: missing original source or created source ID');
    }

    // Restore the original source properties
    await updateVideoEditorSource(this.originalSource.id, {
      end_time: this.originalSource.end_time,
      trim_end: this.originalSource.trim_end,
    });

    // Delete the created source
    await deleteVideoEditorSource(this.createdSourceId);

    // Reorder remaining sources
    const sources = await getVideoEditorSourcesByProjectId(this.projectId);
    for (let i = this.sourceIndexToSplit + 1; i < sources.length; i++) {
      await updateVideoEditorSource(sources[i].id, {
        order_index: sources[i].order_index - 1,
      });
    }

    console.log('[SplitSourceCommand] Undone split');
  }
}

