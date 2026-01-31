import { ref, computed, type Ref } from 'vue';

/**
 * Composable for handling fade in/out drag interactions on timeline segments
 * Provides CapCut-style corner handles for audio and video tracks
 */

export interface FadeHandleOptions {
  pixelsPerSecond: Ref<number>;
  onFadeUpdate: (itemId: string, itemType: 'audio' | 'video', fadeIn: number, fadeOut: number) => void;
  onFadeDragUpdate?: (itemId: string, itemType: 'audio' | 'video', fadeIn: number, fadeOut: number) => void;
}

export interface FadeHandleReturn {
  isDraggingFade: Ref<boolean>;
  activeFadeHandle: Ref<{ itemId: string; type: 'fadeIn' | 'fadeOut' } | null>;
  tempFadeValues: Ref<Record<string, { fadeIn: number; fadeOut: number }>>;
  startFadeDrag: (event: MouseEvent, itemId: string, handleType: 'fadeIn' | 'fadeOut', itemType: 'audio' | 'video', currentFadeIn: number, currentFadeOut: number, segmentDuration: number) => void;
  getFadeHandleStyle: (fadeValue: number, handleType: 'fadeIn' | 'fadeOut') => { width: string };
  renderFadeOverlay: (fadeIn: number, fadeOut: number, segmentDuration: number) => { fadeInWidth: string; fadeOutWidth: string };
}

export function useTimelineFadeHandles(options: FadeHandleOptions): FadeHandleReturn {
  const { pixelsPerSecond, onFadeUpdate, onFadeDragUpdate } = options;

  const isDraggingFade = ref(false);
  const activeFadeHandle = ref<{ itemId: string; type: 'fadeIn' | 'fadeOut' } | null>(null);
  const tempFadeValues = ref<Record<string, { fadeIn: number; fadeOut: number }>>({});

  // Drag state
  let dragStartX = 0;
  let dragStartFadeValue = 0;
  let dragItemId = '';
  let dragItemType: 'audio' | 'video' = 'audio';
  let dragHandleType: 'fadeIn' | 'fadeOut' = 'fadeIn';
  let dragCurrentFadeIn = 0;
  let dragCurrentFadeOut = 0;
  let dragSegmentDuration = 0;
  let finalFadeIn = 0;
  let finalFadeOut = 0;

  function startFadeDrag(
    event: MouseEvent,
    itemId: string,
    handleType: 'fadeIn' | 'fadeOut',
    itemType: 'audio' | 'video',
    currentFadeIn: number,
    currentFadeOut: number,
    segmentDuration: number
  ) {
    console.log('[useTimelineFadeHandles] startFadeDrag called:', { itemId, handleType, itemType, currentFadeIn, currentFadeOut });
    event.preventDefault();
    event.stopPropagation();

    isDraggingFade.value = true;
    activeFadeHandle.value = { itemId, type: handleType };
    dragStartX = event.clientX;
    dragStartFadeValue = handleType === 'fadeIn' ? currentFadeIn : currentFadeOut;
    dragItemId = itemId;
    dragItemType = itemType;
    dragHandleType = handleType;
    dragCurrentFadeIn = currentFadeIn;
    dragCurrentFadeOut = currentFadeOut;
    dragSegmentDuration = segmentDuration;
    
    // Initialize final values with current values
    finalFadeIn = currentFadeIn;
    finalFadeOut = currentFadeOut;

    console.log('[useTimelineFadeHandles] Drag started, listeners attached');
    document.addEventListener('mousemove', handleFadeMouseMove);
    document.addEventListener('mouseup', handleFadeMouseUp);
  }

  function handleFadeMouseMove(event: MouseEvent) {
    if (!isDraggingFade.value) return;

    const deltaX = event.clientX - dragStartX;
    const deltaTime = deltaX / pixelsPerSecond.value;

    let newFadeValue: number;
    if (dragHandleType === 'fadeIn') {
      // Fade in: drag right to increase
      newFadeValue = Math.max(0, Math.min(dragSegmentDuration - dragCurrentFadeOut, dragStartFadeValue + deltaTime));
      finalFadeIn = newFadeValue;
      finalFadeOut = dragCurrentFadeOut;
      
      // Store temp values for reactive UI updates
      tempFadeValues.value = {
        ...tempFadeValues.value,
        [dragItemId]: { fadeIn: newFadeValue, fadeOut: dragCurrentFadeOut }
      };
      console.log('[useTimelineFadeHandles] Updated tempFadeValues:', tempFadeValues.value[dragItemId]);
    } else {
      // Fade out: drag left to increase
      newFadeValue = Math.max(0, Math.min(dragSegmentDuration - dragCurrentFadeIn, dragStartFadeValue - deltaTime));
      finalFadeIn = dragCurrentFadeIn;
      finalFadeOut = newFadeValue;
      
      // Store temp values for reactive UI updates
      tempFadeValues.value = {
        ...tempFadeValues.value,
        [dragItemId]: { fadeIn: dragCurrentFadeIn, fadeOut: newFadeValue }
      };
      console.log('[useTimelineFadeHandles] Updated tempFadeValues:', tempFadeValues.value[dragItemId]);
    }
  }

  function handleFadeMouseUp() {
    console.log('[useTimelineFadeHandles] Drag ended, saving to database:', { finalFadeIn, finalFadeOut });
    
    // Save final values to database
    onFadeUpdate(dragItemId, dragItemType, finalFadeIn, finalFadeOut);
    
    // Clear temp values
    delete tempFadeValues.value[dragItemId];
    
    isDraggingFade.value = false;
    activeFadeHandle.value = null;
    document.removeEventListener('mousemove', handleFadeMouseMove);
    document.removeEventListener('mouseup', handleFadeMouseUp);
  }

  /**
   * Get style for fade handle indicator (triangular overlay)
   */
  function getFadeHandleStyle(fadeValue: number, handleType: 'fadeIn' | 'fadeOut') {
    const widthPx = fadeValue * pixelsPerSecond.value;
    return {
      width: `${widthPx}px`,
    };
  }

  /**
   * Calculate fade overlay dimensions for rendering
   */
  function renderFadeOverlay(fadeIn: number, fadeOut: number, segmentDuration: number) {
    const fadeInPx = fadeIn * pixelsPerSecond.value;
    const fadeOutPx = fadeOut * pixelsPerSecond.value;
    
    return {
      fadeInWidth: `${fadeInPx}px`,
      fadeOutWidth: `${fadeOutPx}px`,
    };
  }

  return {
    isDraggingFade,
    activeFadeHandle,
    tempFadeValues,
    startFadeDrag,
    getFadeHandleStyle,
    renderFadeOverlay,
  };
}
