import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { updateVideoEditorAudioTrack, type VideoEditorAudioTrackRecord } from '@/services/database/video-editor-edits';
import { TRACK_LABEL_WIDTH } from './useTimelineZoom';

/**
 * Options for useAudioSegmentDrag
 */
export interface AudioSegmentDragOptions {
  /** Container element ref */
  containerRef: Ref<HTMLElement | null>;
  /** Current scroll position */
  scrollLeft: Ref<number>;
  /** Pixels per second */
  pixelsPerSecond: ComputedRef<number>;
  /** All audio tracks for collision detection */
  audioTracks: Ref<VideoEditorAudioTrackRecord[]>;
  /** Callback after drag completes */
  onDragComplete?: () => Promise<void>;
}

/**
 * Return type for useAudioSegmentDrag
 */
export interface AudioSegmentDragReturn {
  /** Whether currently dragging */
  isDragging: Ref<boolean>;
  /** ID of the segment being dragged */
  draggingSegmentId: Ref<string | null>;
  /** Temporary drag offset in pixels for visual feedback */
  dragOffset: Ref<number>;
  /** Start dragging an audio segment */
  startDragging: (event: MouseEvent, segment: VideoEditorAudioTrackRecord) => void;
  /** Get the visual position for a segment (accounts for drag offset) */
  getSegmentVisualPosition: (segmentId: string, actualStartTime: number) => number;
}

/**
 * useAudioSegmentDrag - Handle dragging audio segments on the timeline
 *
 * Allows repositioning audio segments by dragging them left/right on the timeline.
 * Updates the segment's start_time and end_time while preserving duration.
 *
 * Usage:
 * ```ts
 * const { isDragging, draggingSegmentId, startDragging } = useAudioSegmentDrag({
 *   containerRef: tracksContainer,
 *   scrollLeft,
 *   pixelsPerSecond,
 *   onDragComplete: async () => {
 *     await loadEditorData();
 *     await reloadTimeline();
 *   }
 * });
 *
 * // In template
 * <div @mousedown="(e) => startDragging(e, audioTrack)">
 * ```
 */
export function useAudioSegmentDrag(options: AudioSegmentDragOptions): AudioSegmentDragReturn {
  const { containerRef, scrollLeft, pixelsPerSecond, audioTracks, onDragComplete } = options;

  const isDragging = ref(false);
  const draggingSegmentId = ref<string | null>(null);
  const dragOffset = ref(0);
  
  let dragStartX = 0;
  let dragStartTime = 0;
  let segmentDuration = 0;
  let currentSegment: VideoEditorAudioTrackRecord | null = null;

  /**
   * Calculate time from mouse X position
   */
  function getTimeFromPosition(clientX: number): number {
    if (!containerRef.value) return 0;

    const rect = containerRef.value.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const timelineX = clickX - TRACK_LABEL_WIDTH + scrollLeft.value;
    const time = timelineX / pixelsPerSecond.value;
    
    return Math.max(0, time);
  }

  /**
   * Check if a segment would collide with other segments at a given position
   */
  function checkCollision(
    segmentId: string,
    newStartTime: number,
    newEndTime: number,
    trackOrder: number
  ): boolean {
    // Check against all other segments on the same track
    const otherSegments = audioTracks.value.filter(
      (track) => track.id !== segmentId && track.track_order === trackOrder
    );

    for (const other of otherSegments) {
      // Check if segments overlap
      if (newStartTime < other.end_time && newEndTime > other.start_time) {
        return true; // Collision detected
      }
    }

    return false; // No collision
  }

  /**
   * Clamp position to prevent collisions
   */
  function clampToAvoidCollisions(
    segmentId: string,
    desiredStartTime: number,
    duration: number,
    trackOrder: number
  ): number {
    const desiredEndTime = desiredStartTime + duration;
    
    // Get all other segments on the same track, sorted by start time
    const otherSegments = audioTracks.value
      .filter((track) => track.id !== segmentId && track.track_order === trackOrder)
      .sort((a, b) => a.start_time - b.start_time);

    // Find the valid range for this segment
    let minStart = 0;
    let maxStart = Infinity;

    for (const other of otherSegments) {
      // If other segment is before desired position
      if (other.end_time <= desiredStartTime) {
        minStart = Math.max(minStart, other.end_time);
      }
      // If other segment is after desired position
      else if (other.start_time >= desiredEndTime) {
        maxStart = Math.min(maxStart, other.start_time - duration);
      }
      // If there's overlap, snap to nearest valid position
      else {
        // Snap to left of this segment
        const leftSnap = other.start_time - duration;
        // Snap to right of this segment
        const rightSnap = other.end_time;
        
        // Choose the snap position closest to desired position
        if (Math.abs(leftSnap - desiredStartTime) < Math.abs(rightSnap - desiredStartTime)) {
          maxStart = Math.min(maxStart, leftSnap);
        } else {
          minStart = Math.max(minStart, rightSnap);
        }
      }
    }

    // Clamp the desired position to the valid range
    return Math.max(minStart, Math.min(desiredStartTime, maxStart));
  }

  /**
   * Get the visual position for a segment (accounts for drag offset)
   */
  function getSegmentVisualPosition(segmentId: string, actualStartTime: number): number {
    if (isDragging.value && draggingSegmentId.value === segmentId) {
      return actualStartTime + (dragOffset.value / pixelsPerSecond.value);
    }
    return actualStartTime;
  }

  /**
   * Start dragging an audio segment
   */
  function startDragging(event: MouseEvent, segment: VideoEditorAudioTrackRecord): void {
    // Don't start drag if clicking on fade handles
    const target = event.target as HTMLElement;
    if (target.classList.contains('cursor-ew-resize')) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    isDragging.value = true;
    draggingSegmentId.value = segment.id;
    currentSegment = segment;
    
    dragStartX = event.clientX;
    dragStartTime = segment.start_time;
    segmentDuration = segment.end_time - segment.start_time;

    let lastNewStartTime = dragStartTime;
    let lastNewEndTime = segment.end_time;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.value || !currentSegment) return;

      const currentTime = getTimeFromPosition(e.clientX);
      const startTime = getTimeFromPosition(dragStartX);
      const deltaTime = currentTime - startTime;
      
      // Calculate desired new start time
      const desiredStartTime = Math.max(0, dragStartTime + deltaTime);
      
      // Apply collision detection to prevent overlapping
      const clampedStartTime = clampToAvoidCollisions(
        currentSegment.id,
        desiredStartTime,
        segmentDuration,
        currentSegment.track_order
      );
      
      lastNewStartTime = clampedStartTime;
      lastNewEndTime = clampedStartTime + segmentDuration;
      
      // Update drag offset for real-time visual feedback
      dragOffset.value = (clampedStartTime - dragStartTime) * pixelsPerSecond.value;
    };

    const handleMouseUp = async () => {
      isDragging.value = false;
      draggingSegmentId.value = null;
      dragOffset.value = 0; // Reset drag offset

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      // Only update database once when drag completes
      if (currentSegment && (lastNewStartTime !== dragStartTime)) {
        await updateVideoEditorAudioTrack(currentSegment.id, {
          start_time: lastNewStartTime,
          end_time: lastNewEndTime,
        });

        // Trigger reload after drag completes
        if (onDragComplete) {
          await onDragComplete();
        }
      }

      currentSegment = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  return {
    isDragging,
    draggingSegmentId,
    dragOffset,
    startDragging,
    getSegmentVisualPosition,
  };
}
