import { ref, computed } from 'vue';
import { TimelineModel, Track, TimelineItem } from '@/types/timeline-model';
import { TimelineAdapter } from '@/services/timeline-adapter';
import { 
  getFullVideoEditorEdit, 
  getVideoEditorProject 
} from '@/services/database';

export function useTimelineTracks(projectId: string) {
  const tracks = ref<Track[]>([]);
  const duration = ref(0);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  /**
   * Load the timeline data from the database and adapt it to the unified model
   */
  async function loadTimeline() {
    isLoading.value = true;
    error.value = null;
    
    try {
      // 1. Get Project Info (for duration)
      const project = await getVideoEditorProject(projectId);
      if (!project) throw new Error('Project not found');
      
      // 2. Get Full Edit Data (Sources, Overlays, Audio)
      // Note: This function currently assumes we have an 'edit' record. 
      // If using direct 'video_editor_sources', we might need to fetch those separately 
      // if they aren't fully wrapped in getFullVideoEditorEdit yet for the new architecture.
      // Based on previous reads, getFullVideoEditorEdit aggregates everything.
      
      // However, VideoEditorSources are stored in a separate table linked to project_id, 
      // NOT linked to the 'edit' record (which holds overlays).
      // We need to fetch sources separately as they are the "main track".
      
      const { getVideoEditorSourcesByProjectId } = await import('@/services/database');
      const sources = await getVideoEditorSourcesByProjectId(projectId);
      
      const fullEdit = await getFullVideoEditorEdit(projectId);
      
      // Combine all data for the adapter
      const timelineModel = TimelineAdapter.toTimelineModel({
        sources: sources,
        audioTracks: fullEdit?.audioTracks || [],
        textOverlays: fullEdit?.textOverlays || [],
        stickers: fullEdit?.stickers || [],
        watermarks: fullEdit?.watermarks || [],
        effects: fullEdit?.effects || [],
        filterSegments: [], // TODO: parse from edit.edit_data if needed
        duration: project.total_duration || 0
      });
      
      tracks.value = timelineModel.tracks;
      duration.value = timelineModel.duration;
      
    } catch (err: any) {
      console.error('Failed to load timeline tracks:', err);
      error.value = err.message || 'Failed to load timeline';
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Get all items visible at a specific time across all tracks
   * Useful for the Compositor/Preview engine
   */
  function getItemsAtTime(time: number): TimelineItem[] {
    const visibleItems: TimelineItem[] = [];
    
    // Iterate tracks from bottom to top (by orderIndex)
    const sortedTracks = [...tracks.value].sort((a, b) => a.orderIndex - b.orderIndex);
    
    for (const track of sortedTracks) {
      if (!track.isVisible) continue;
      
      // Find item in this track that intersects the time
      const item = track.items.find(i => 
        time >= i.startTime && time < (i.startTime + i.duration)
      );
      
      if (item) {
        visibleItems.push(item);
      }
    }
    
    return visibleItems;
  }

  /**
   * Move an item to a new time and/or track
   */
  async function moveItem(
    itemId: string, 
    newStartTime: number, 
    newTrackId?: string
  ) {
    // 1. Find the item
    let sourceTrack: Track | undefined;
    let itemIndex = -1;
    
    for (const track of tracks.value) {
      const idx = track.items.findIndex(i => i.id === itemId);
      if (idx !== -1) {
        sourceTrack = track;
        itemIndex = idx;
        break;
      }
    }
    
    if (!sourceTrack || itemIndex === -1) return;
    
    const item = sourceTrack.items[itemIndex];
    
    // 2. Update Time
    item.startTime = Math.max(0, newStartTime);
    
    // 3. Handle Track Change
    if (newTrackId && newTrackId !== sourceTrack.id) {
      const targetTrack = tracks.value.find(t => t.id === newTrackId);
      if (targetTrack) {
        // Remove from source
        sourceTrack.items.splice(itemIndex, 1);
        // Add to target
        targetTrack.items.push(item);
      }
    }
    
    // TODO: Persist changes to DB via Command pattern
    // This will require mapping the generic move back to specific DB updates
  }

  return {
    tracks,
    duration,
    isLoading,
    error,
    loadTimeline,
    getItemsAtTime,
    moveItem
  };
}
