import { ref, type Ref } from 'vue';
import type { VideoEditorSource } from '@/services/database/video-editor-projects';
import { updateVideoEditorSource } from '@/services/database/video-editor-projects';

const TRACK_HEIGHT = 48;

export interface VideoSourceDragOptions {
  videoSources: Ref<VideoEditorSource[]>;
  pixelsPerSecond: Ref<number>;
  onDragComplete?: () => void;
}

export interface VideoSourceDragReturn {
  isDragging: Ref<boolean>;
  dragOffset: Ref<number>;
  dragOffsetY: Ref<number>;
  targetTrackIndex: Ref<number>;
  draggingSource: Ref<VideoEditorSource | null>;
  startDragging: (event: MouseEvent, source: VideoEditorSource) => void;
  getSourceVisualPosition: (source: VideoEditorSource) => { left: number; top: number };
}

/**
 * useVideoSourceDrag - Handle dragging video sources on the timeline
 * 
 * Allows moving video sources horizontally (time) and vertically (track layers)
 * to create overlay tracks above the main video track.
 */
export function useVideoSourceDrag(options: VideoSourceDragOptions): VideoSourceDragReturn {
  const { videoSources, pixelsPerSecond, onDragComplete } = options;

  const isDragging = ref(false);
  const dragOffset = ref(0);
  const dragOffsetY = ref(0);
  const targetTrackIndex = ref(0);
  const draggingSource = ref<VideoEditorSource | null>(null);
  const startX = ref(0);
  const startY = ref(0);
  const startTime = ref(0);
  const startTrackIndex = ref(0);

  /**
   * Calculate which track index the source should be on based on Y offset
   * Negative offset (dragging up) = HIGHER order_index (overlay tracks above)
   * Positive offset (dragging down) = LOWER order_index (back to base track)
   * This matches CapCut's behavior where upper tracks are overlays
   */
  function calculateTargetTrack(yOffset: number, currentTrackIndex: number): number {
    // Invert the delta: negative Y (up) = positive track delta (higher index)
    const tracksDelta = Math.round(-yOffset / TRACK_HEIGHT);
    const newTrackIndex = Math.max(0, currentTrackIndex + tracksDelta);
    return newTrackIndex;
  }

  /**
   * Get the visual position of a source accounting for drag offset
   * Higher order_index = visually ABOVE (smaller top value)
   * This creates overlay tracks above the base track (order_index 0)
   */
  function getSourceVisualPosition(source: VideoEditorSource): { left: number; top: number } {
    const isBeingDragged = draggingSource.value?.id === source.id;
    
    const left = isBeingDragged
      ? source.start_time * pixelsPerSecond.value + dragOffset.value
      : source.start_time * pixelsPerSecond.value;

    // Find the maximum order_index to calculate inverted positioning
    const maxOrderIndex = Math.max(...videoSources.value.map(s => s.order_index || 0), 0);
    
    // Invert: higher order_index = smaller top value (visually above)
    const invertedIndex = maxOrderIndex - (source.order_index || 0);
    
    const top = isBeingDragged
      ? (maxOrderIndex - startTrackIndex.value) * TRACK_HEIGHT + dragOffsetY.value
      : invertedIndex * TRACK_HEIGHT;

    return { left, top };
  }

  /**
   * Start dragging a video source
   */
  function startDragging(event: MouseEvent, source: VideoEditorSource): void {
    event.preventDefault();
    event.stopPropagation();

    isDragging.value = true;
    draggingSource.value = source;
    startX.value = event.clientX;
    startY.value = event.clientY;
    startTime.value = source.start_time;
    startTrackIndex.value = source.order_index || 0;
    dragOffset.value = 0;
    dragOffsetY.value = 0;
    targetTrackIndex.value = startTrackIndex.value;

    console.log('[useVideoSourceDrag] Started dragging source:', {
      id: source.id,
      startTime: source.start_time,
      trackIndex: startTrackIndex.value,
    });

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  /**
   * Check if a source would collide with other sources at a given position
   */
  function checkCollision(
    sourceId: string,
    newStartTime: number,
    newEndTime: number,
    trackIndex: number
  ): boolean {
    const otherSources = videoSources.value.filter(
      (s) => s.id !== sourceId && s.order_index === trackIndex
    );

    for (const other of otherSources) {
      if (newStartTime < other.end_time && newEndTime > other.start_time) {
        return true;
      }
    }

    return false;
  }

  /**
   * Clamp position to prevent collisions and gaps on SOURCE track
   */
  function clampToAvoidCollisions(
    sourceId: string,
    desiredStartTime: number,
    duration: number,
    trackIndex: number
  ): number {
    const desiredEndTime = desiredStartTime + duration;
    
    // Get all other sources on the same track, sorted by start time
    const otherSources = videoSources.value
      .filter((s) => s.id !== sourceId && s.order_index === trackIndex)
      .sort((a, b) => a.start_time - b.start_time);

    // For SOURCE track (order_index 0), prevent gaps
    if (trackIndex === 0) {
      // Find the source that should be immediately before this one
      const sourcesBefore = otherSources.filter(s => s.end_time <= desiredStartTime);
      const sourcesAfter = otherSources.filter(s => s.start_time >= desiredEndTime);
      
      // If there are sources before, must start at the end of the last one
      if (sourcesBefore.length > 0) {
        const lastBefore = sourcesBefore[sourcesBefore.length - 1];
        return lastBefore.end_time;
      }
      
      // If there are sources after but none before, must start at 0
      if (sourcesAfter.length > 0 && sourcesBefore.length === 0) {
        return 0;
      }
      
      // If no sources before or after, can start at 0 or desired position
      return Math.max(0, desiredStartTime);
    }

    // For overlay tracks, use standard collision avoidance
    let minStart = 0;
    let maxStart = Infinity;

    for (const other of otherSources) {
      if (other.end_time <= desiredStartTime) {
        minStart = Math.max(minStart, other.end_time);
      } else if (other.start_time >= desiredEndTime) {
        maxStart = Math.min(maxStart, other.start_time - duration);
      } else {
        const leftSnap = other.start_time - duration;
        const rightSnap = other.end_time;
        
        if (Math.abs(leftSnap - desiredStartTime) < Math.abs(rightSnap - desiredStartTime)) {
          maxStart = Math.min(maxStart, leftSnap);
        } else {
          minStart = Math.max(minStart, rightSnap);
        }
      }
    }

    return Math.max(minStart, Math.min(desiredStartTime, maxStart));
  }

  /**
   * Handle mouse move during drag
   */
  function handleMouseMove(event: MouseEvent): void {
    if (!isDragging.value || !draggingSource.value) return;

    const deltaX = event.clientX - startX.value;
    const deltaY = event.clientY - startY.value;

    // Calculate desired time position
    const timeDelta = deltaX / pixelsPerSecond.value;
    const desiredStartTime = startTime.value + timeDelta;
    const duration = draggingSource.value.end_time - draggingSource.value.start_time;

    // Calculate target track (discrete snapping)
    targetTrackIndex.value = calculateTargetTrack(deltaY, startTrackIndex.value);

    // Clamp to avoid collisions and gaps
    const clampedStartTime = clampToAvoidCollisions(
      draggingSource.value.id,
      desiredStartTime,
      duration,
      targetTrackIndex.value
    );

    // Update drag offset based on clamped position
    const clampedTimeDelta = clampedStartTime - startTime.value;
    dragOffset.value = clampedTimeDelta * pixelsPerSecond.value;

    // Snap vertical offset to discrete track positions (no smooth dragging)
    // Calculate the exact pixel offset to the target track
    const maxOrderIndex = Math.max(...videoSources.value.map(s => s.order_index || 0), 0);
    const currentVisualTrack = maxOrderIndex - startTrackIndex.value;
    const targetVisualTrack = maxOrderIndex - targetTrackIndex.value;
    dragOffsetY.value = (targetVisualTrack - currentVisualTrack) * TRACK_HEIGHT;
  }

  /**
   * Handle mouse up - complete the drag operation
   */
  async function handleMouseUp(): Promise<void> {
    if (!isDragging.value || !draggingSource.value) return;

    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);

    const source = draggingSource.value;
    const timeDelta = dragOffset.value / pixelsPerSecond.value;
    const newStartTime = Math.max(0, startTime.value + timeDelta);
    const duration = source.end_time - source.start_time;
    const newEndTime = newStartTime + duration;
    const newTrackIndex = targetTrackIndex.value;

    console.log('[useVideoSourceDrag] Drag complete:', {
      id: source.id,
      oldStartTime: source.start_time,
      newStartTime,
      oldTrackIndex: startTrackIndex.value,
      newTrackIndex,
    });

    // Update the database with new position and track
    try {
      await updateVideoEditorSource(source.id, {
        start_time: newStartTime,
        end_time: newEndTime,
        order_index: newTrackIndex,
      });

      console.log('[useVideoSourceDrag] Updated video source position in database');
    } catch (error) {
      console.error('[useVideoSourceDrag] Failed to update video source:', error);
    }

    // Reset drag state
    isDragging.value = false;
    draggingSource.value = null;
    dragOffset.value = 0;
    dragOffsetY.value = 0;
    targetTrackIndex.value = 0;

    // Notify parent to reload timeline
    if (onDragComplete) {
      onDragComplete();
    }
  }

  return {
    isDragging,
    dragOffset,
    dragOffsetY,
    targetTrackIndex,
    draggingSource,
    startDragging,
    getSourceVisualPosition,
  };
}
