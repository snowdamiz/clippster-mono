import { ref, computed, type Ref, type ComputedRef } from 'vue';

/**
 * Options for usePlayheadDrag
 */
export interface PlayheadDragOptions {
  /** Container element ref */
  containerRef: Ref<HTMLElement | null>;
  /** Current scroll position (for timeline) */
  scrollLeft?: Ref<number>;
  /** Pixels per second (for timeline) */
  pixelsPerSecond?: ComputedRef<number>;
  /** Total duration */
  duration: ComputedRef<number>;
  /** Callback when seeking */
  onSeek: (time: number) => void;
}

/**
 * Return type for usePlayheadDrag
 */
export interface PlayheadDragReturn {
  /** Whether currently dragging */
  isDragging: Ref<boolean>;
  /** Hover time (for tooltip) */
  hoverTime: Ref<number | null>;
  /** Hover position percentage */
  hoverPosition: Ref<number>;
  /** Start dragging from progress bar click */
  startDragging: (event: MouseEvent) => void;
  /** Start dragging from playhead element */
  startDraggingPlayhead: (event: MouseEvent) => void;
  /** Handle mouse hover for preview */
  handleHover: (event: MouseEvent) => void;
  /** Clear hover state */
  clearHover: () => void;
  /** Calculate time from position (for timeline click-to-seek) */
  getTimeFromPosition: (event: MouseEvent) => number;
}

/**
 * usePlayheadDrag - Shared dragging logic for playhead/progress bar
 *
 * Extracts the duplicated drag handling from:
 * - ClipEditorTimeline (playhead dragging)
 * - ClipEditorPreview (progress bar dragging)
 *
 * Usage:
 * ```ts
 * // In Timeline component
 * const {
 *   isDragging,
 *   startDraggingPlayhead,
 *   getTimeFromPosition,
 * } = usePlayheadDrag({
 *   containerRef: tracksContainer,
 *   scrollLeft,
 *   pixelsPerSecond,
 *   duration: computed(() => props.duration),
 *   onSeek: (time) => emit('seek', time),
 * });
 *
 * // In Preview component
 * const {
 *   isDragging,
 *   hoverTime,
 *   hoverPosition,
 *   startDragging,
 *   startDraggingPlayhead,
 *   handleHover,
 *   clearHover,
 * } = usePlayheadDrag({
 *   containerRef: progressBarRef,
 *   duration: timelineDuration,
 *   onSeek: (time) => emit('seek', time),
 * });
 * ```
 */
export function usePlayheadDrag(options: PlayheadDragOptions): PlayheadDragReturn {
  const { containerRef, scrollLeft, pixelsPerSecond, duration, onSeek } = options;

  const isDragging = ref(false);
  const hoverTime = ref<number | null>(null);
  const hoverPosition = ref(0);

  /**
   * Calculate time from mouse event position
   * Works for both timeline (with scroll/pixels) and progress bar (percentage-based)
   */
  function getTimeFromPosition(event: MouseEvent): number {
    if (!containerRef.value) return 0;

    const rect = containerRef.value.getBoundingClientRect();
    const clickX = event.clientX - rect.left;

    // Timeline mode: use pixels per second and scroll offset
    if (pixelsPerSecond?.value && scrollLeft) {
      const timelineX = clickX + scrollLeft.value;
      const time = timelineX / pixelsPerSecond.value;
      return Math.max(0, Math.min(time, duration.value));
    }

    // Progress bar mode: use percentage
    const percent = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    return (percent / 100) * duration.value;
  }

  /**
   * Seek to position from mouse event
   */
  function seekToPosition(event: MouseEvent): void {
    const time = getTimeFromPosition(event);
    onSeek(time);
  }

  /**
   * Start dragging from clicking on the progress bar (not playhead)
   */
  function startDragging(event: MouseEvent): void {
    // Skip if clicking directly on playhead element
    const target = event.target as HTMLElement;
    if (target.classList.contains('editor-preview__playhead')) {
      return;
    }

    isDragging.value = true;
    seekToPosition(event);

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.value) {
        seekToPosition(e);
      }
    };

    const handleMouseUp = () => {
      isDragging.value = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  /**
   * Start dragging from the playhead element itself
   */
  function startDraggingPlayhead(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    isDragging.value = true;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.value) {
        seekToPosition(e);
      }
    };

    const handleMouseUp = () => {
      isDragging.value = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  /**
   * Handle mouse hover on progress bar (for time preview tooltip)
   */
  function handleHover(event: MouseEvent): void {
    if (!containerRef.value) return;

    const rect = containerRef.value.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    hoverPosition.value = percent;
    hoverTime.value = (percent / 100) * duration.value;
  }

  /**
   * Clear hover state (on mouse leave)
   */
  function clearHover(): void {
    hoverTime.value = null;
  }

  return {
    isDragging,
    hoverTime,
    hoverPosition,
    startDragging,
    startDraggingPlayhead,
    handleHover,
    clearHover,
    getTimeFromPosition,
  };
}
