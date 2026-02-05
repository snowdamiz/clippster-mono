import { ref, computed, watch, readonly } from 'vue';
import { useEditorDataLoader, type EditorDataLoaderOptions, type EditorDataLoaderReturn } from './clip-editor/useEditorDataLoader';
import { useTimelineClipMigration } from './useTimelineClipMigration';
import type { FullVideoEditorEdit } from '@/services/database/video-editor-edits';
import type { TimelineData } from './clip-editor/useVideoUrlBuilder';

/**
 * Enhanced editor data loader that integrates clip extraction workflow
 * 
 * This extends the base editor data loader to:
 * 1. Detect when timeline sources need clip extraction
 * 2. Automatically migrate trim-based sources to clip-based sources
 * 3. Update the timeline with extracted clip paths
 */
export function useEditorDataLoaderWithClipExtraction(
  options: EditorDataLoaderOptions = {},
  playbackEngine?: { getTimeline: () => TimelineData | null; setTimeline: (data: any) => void }
) {
  // Base data loader
  const baseLoader = useEditorDataLoader(options);
  
  // Clip migration system
  const { 
    timelineNeedsMigration, 
    convertTimelineToClips, 
    processMigrationQueue,
    isMigrating,
    migrationProgress 
  } = useTimelineClipMigration();
  
  // State for migration tracking
  const migrationStatus = ref<'idle' | 'checking' | 'migrating' | 'completed' | 'error'>('idle');
  const migrationError = ref<string | null>(null);
  const needsMigration = ref(false);

  /**
   * Enhanced loadEditorData that includes clip extraction migration
   */
  async function loadEditorDataWithClipExtraction(
    editorProjectId: string | null | undefined
  ): Promise<void> {
    // Load base editor data first
    await baseLoader.loadEditorData(editorProjectId);
    
    // Check if timeline needs migration after data is loaded
    if (baseLoader.editorEdit.value) {
      await checkAndMigrateTimeline(baseLoader.editorEdit.value);
    }
  }

  /**
   * Check if timeline needs migration and perform it if needed
   */
  async function checkAndMigrateTimeline(editorEdit: FullVideoEditorEdit): Promise<void> {
    migrationStatus.value = 'checking';
    migrationError.value = null;
    
    try {
      console.log(`[EditorDataLoaderWithClipExtraction] Checking timeline for migration needs`);
      
      // Get timeline from playback engine
      if (!playbackEngine) {
        console.log(`[EditorDataLoaderWithClipExtraction] No playback engine provided, skipping migration`);
        migrationStatus.value = 'idle';
        return;
      }
      
      const timeline = playbackEngine.getTimeline();
      if (!timeline) {
        console.log(`[EditorDataLoaderWithClipExtraction] No timeline data, skipping migration`);
        migrationStatus.value = 'idle';
        return;
      }
      
      // Check if any video sources need migration
      const timelineSources = timeline.videoSources || [];
      const hasSourcesNeedingMigration = timelineNeedsMigration(timelineSources);
      
      needsMigration.value = hasSourcesNeedingMigration;
      
      if (hasSourcesNeedingMigration) {
        console.log(`[EditorDataLoaderWithClipExtraction] Timeline needs migration, starting process`);
        migrationStatus.value = 'migrating';
        
        // Convert timeline to use clips
        const convertedSources = await convertTimelineToClips(timelineSources);
        
        // Update the timeline with converted sources
        const updatedTimeline: any = {
          ...timeline,
          videoSources: convertedSources,
        };
        
        // Update playback engine timeline
        playbackEngine.setTimeline(updatedTimeline);
        
        // Timeline is already updated via playbackEngine.setTimeline()
        
        console.log(`[EditorDataLoaderWithClipExtraction] ✓ Timeline migration complete`);
        migrationStatus.value = 'completed';
      } else {
        console.log(`[EditorDataLoaderWithClipExtraction] No migration needed`);
        migrationStatus.value = 'idle';
      }
      
    } catch (error) {
      console.error(`[EditorDataLoaderWithClipExtraction] Migration failed:`, error);
      migrationError.value = error instanceof Error ? error.message : 'Unknown error';
      migrationStatus.value = 'error';
      throw error;
    }
  }

  /**
   * Force migration of timeline sources
   * This can be called manually if needed
   */
  async function forceMigration(): Promise<void> {
    if (!baseLoader.editorEdit.value) {
      throw new Error('No editor data loaded');
    }
    
    await checkAndMigrateTimeline(baseLoader.editorEdit.value);
  }

  /**
   * Reset migration state
   */
  function resetMigration(): void {
    migrationStatus.value = 'idle';
    migrationError.value = null;
    needsMigration.value = false;
  }

  // Watch for editor data changes to recheck migration
  watch(
    () => baseLoader.editorEdit.value,
    async (newEdit) => {
      if (newEdit && migrationStatus.value === 'idle') {
        // Recheck migration when editor data changes
        await checkAndMigrateTimeline(newEdit);
      }
    },
    { deep: true }
  );

  // Computed properties
  const isLoading = computed(() => 
    baseLoader.isLoading.value || 
    migrationStatus.value === 'checking' || 
    migrationStatus.value === 'migrating'
  );

  const hasError = computed(() => 
    baseLoader.isLoading.value === false && 
    baseLoader.editorEdit.value === null
  );

  const isMigratingOrLoading = computed(() => 
    isMigrating.value || 
    migrationStatus.value === 'migrating' || 
    baseLoader.isLoading.value
  );

  return {
    // Base loader properties
    ...baseLoader,
    
    // Enhanced loading method
    loadEditorData: loadEditorDataWithClipExtraction,
    
    // Migration properties
    migrationStatus: readonly(migrationStatus),
    migrationError: readonly(migrationError),
    needsMigration: readonly(needsMigration),
    isMigrating: readonly(isMigrating),
    migrationProgress: readonly(migrationProgress),
    
    // Computed properties
    isLoading,
    hasError,
    isMigratingOrLoading,
    
    // Migration methods
    forceMigration,
    resetMigration,
  };
}
