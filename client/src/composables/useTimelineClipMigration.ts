import { ref, computed, watch, readonly } from 'vue';
import type { VideoSource } from './clip-editor/useVideoSourceTime';
import { useClipExtraction } from './useClipExtraction';

/**
 * Composable to migrate from trim-based timeline to clip-based timeline
 * This handles the transition phase where we convert existing timeline sources
 * to use extracted clips instead of trim parameters
 */
export function useTimelineClipMigration() {
  const { extractClip, convertSourceToClip, needsConversion, getEffectivePath } = useClipExtraction();
  
  const isMigrating = ref(false);
  const migrationProgress = ref(0);
  const migrationQueue = ref<Array<{
    sourceId: string;
    sourcePath: string;
    startTime: number;
    endTime: number;
  }>>([]);
  const error = ref<string | null>(null);

  /**
   * Check if a timeline source needs migration to clip-based system
   * 
   * @param source The video source to check
   * @returns boolean True if migration is needed
   */
  function sourceNeedsMigration(source: VideoSource): boolean {
    // If no trim parameters, no migration needed
    if (source.trim_start === undefined && source.trim_end === undefined) {
      return false;
    }
    
    // If trim_start is 0 and trim_end is null, no migration needed
    if (source.trim_start === 0 && source.trim_end === null) {
      return false;
    }
    
    // Check if we already have an extracted clip
    return needsConversion(source.file_path, source.trim_start || 0, source.trim_end || 0);
  }

  /**
   * Add a source to the migration queue
   * 
   * @param sourceId Source ID
   * @param sourcePath Original file path
   * @param startTime Trim start time
   * @param endTime Trim end time
   */
  function queueForMigration(
    sourceId: string,
    sourcePath: string,
    startTime: number,
    endTime: number
  ): void {
    migrationQueue.value.push({
      sourceId,
      sourcePath,
      startTime,
      endTime,
    });
  }

  /**
   * Process the migration queue
   * Converts all queued sources to extracted clips
   */
  async function processMigrationQueue(): Promise<void> {
    if (migrationQueue.value.length === 0) {
      return;
    }

    isMigrating.value = true;
    error.value = null;
    migrationProgress.value = 0;

    try {
      console.log(`[useTimelineClipMigration] Starting migration of ${migrationQueue.value.length} sources`);

      for (let i = 0; i < migrationQueue.value.length; i++) {
        const item = migrationQueue.value[i];
        
        try {
          console.log(`[useTimelineClipMigration] Migrating source ${item.sourceId} (${i + 1}/${migrationQueue.value.length})`);
          
          await convertSourceToClip(
            item.sourceId,
            item.sourcePath,
            item.startTime,
            item.endTime
          );
          
          migrationProgress.value = ((i + 1) / migrationQueue.value.length) * 100;
          
        } catch (err) {
          console.error(`[useTimelineClipMigration] Failed to migrate source ${item.sourceId}:`, err);
          throw err;
        }
      }

      // Clear queue after successful migration
      migrationQueue.value = [];
      console.log(`[useTimelineClipMigration] ✓ Migration complete`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      error.value = errorMessage;
      console.error(`[useTimelineClipMigration] Migration failed:`, err);
      throw err;

    } finally {
      isMigrating.value = false;
      migrationProgress.value = 0;
    }
  }

  /**
   * Convert a timeline to use clip-based sources
   * 
   * @param sources The current timeline sources
   * @returns Promise<VideoSource[]> The converted sources
   */
  async function convertTimelineToClips(sources: VideoSource[]): Promise<VideoSource[]> {
    console.log(`[useTimelineClipMigration] Converting timeline with ${sources.length} sources`);

    const convertedSources: VideoSource[] = [];
    
    for (const source of sources) {
      if (sourceNeedsMigration(source)) {
        // Convert to clip
        const clipPath = await convertSourceToClip(
          source.id,
          source.file_path,
          source.trim_start || 0,
          source.trim_end || 0
        );
        
        // Create new source with clip path and no trim parameters
        const convertedSource: VideoSource = {
          ...source,
          file_path: clipPath,
          trim_start: 0,
          trim_end: null,
        };
        
        convertedSources.push(convertedSource);
        console.log(`[useTimelineClipMigration] ✓ Converted source ${source.id} to clip: ${clipPath}`);
        
      } else {
        // No conversion needed
        convertedSources.push(source);
      }
    }

    return convertedSources;
  }

  /**
   * Get the effective file path for a timeline source
   * This handles both clip-based and trim-based sources
   * 
   * @param source The video source
   * @returns string The effective file path to use
   */
  function getSourcePath(source: VideoSource): string {
    // If source has trim parameters, try to get effective path
    if (source.trim_start !== undefined || source.trim_end !== undefined) {
      const effectivePath = getEffectivePath(
        source.id,
        source.file_path,
        source.trim_start || 0,
        source.trim_end || 0
      );
      
      if (effectivePath !== source.file_path) {
        return effectivePath;
      }
    }
    
    // Fall back to original file path
    return source.file_path;
  }

  /**
   * Check if a timeline needs migration
   * 
   * @param sources The timeline sources
   * @returns boolean True if any source needs migration
   */
  function timelineNeedsMigration(sources: VideoSource[]): boolean {
    return sources.some(source => sourceNeedsMigration(source));
  }

  // Computed properties
  const hasQueuedMigrations = computed(() => migrationQueue.value.length > 0);
  const migrationCount = computed(() => migrationQueue.value.length);

  return {
    // State
    isMigrating: readonly(isMigrating),
    migrationProgress: readonly(migrationProgress),
    migrationQueue: readonly(migrationQueue),
    error: readonly(error),
    
    // Computed
    hasQueuedMigrations,
    migrationCount,
    
    // Methods
    sourceNeedsMigration,
    queueForMigration,
    processMigrationQueue,
    convertTimelineToClips,
    getSourcePath,
    timelineNeedsMigration,
  };
}
