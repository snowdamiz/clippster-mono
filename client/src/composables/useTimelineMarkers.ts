import { ref, type Ref } from 'vue';

export interface TimelineRegion {
  id: string;
  startTime: number;
  endTime: number;
  label?: string;
  color?: string;
}

export interface UseTimelineMarkersOptions {
  seekTo: (time: number) => void;
}

export interface UseTimelineMarkersReturn {
  // State
  inPoint: Ref<number | null>;
  outPoint: Ref<number | null>;
  regions: Ref<TimelineRegion[]>;

  // In/Out Point handlers
  handleSetInPoint: (time: number) => void;
  handleSetOutPoint: (time: number) => void;
  handleClearInOutPoints: () => void;
  handleGoToInPoint: () => void;
  handleGoToOutPoint: () => void;

  // Region handlers
  handleAddRegion: (startTime: number, endTime: number, label?: string, color?: string) => void;
  handleUpdateRegion: (regionId: string, updates: Partial<TimelineRegion>) => void;
  handleDeleteRegion: (regionId: string) => void;
}

/**
 * Composable for managing timeline in/out points and regions.
 *
 * In/out points allow marking a range on the timeline for operations like export or preview.
 * Regions are named sections that can be used for organization or batch operations.
 */
export function useTimelineMarkers(options: UseTimelineMarkersOptions): UseTimelineMarkersReturn {
  const { seekTo } = options;

  // In/Out Points
  const inPoint = ref<number | null>(null);
  const outPoint = ref<number | null>(null);

  function handleSetInPoint(time: number) {
    inPoint.value = time;
    console.log('[useTimelineMarkers] Set In Point:', time);
    // If out point exists and is before in point, clear it
    if (outPoint.value !== null && outPoint.value <= time) {
      outPoint.value = null;
    }
  }

  function handleSetOutPoint(time: number) {
    if (inPoint.value !== null && time <= inPoint.value) {
      console.warn('[useTimelineMarkers] Out point must be after In point');
      return;
    }
    outPoint.value = time;
    console.log('[useTimelineMarkers] Set Out Point:', time);
  }

  function handleClearInOutPoints() {
    inPoint.value = null;
    outPoint.value = null;
    console.log('[useTimelineMarkers] Cleared In/Out Points');
  }

  function handleGoToInPoint() {
    if (inPoint.value !== null) {
      seekTo(inPoint.value);
    }
  }

  function handleGoToOutPoint() {
    if (outPoint.value !== null) {
      seekTo(outPoint.value);
    }
  }

  // Regions
  const regions = ref<TimelineRegion[]>([]);

  function handleAddRegion(startTime: number, endTime: number, label?: string, color?: string) {
    const newRegion: TimelineRegion = {
      id: `region-${Date.now()}`,
      startTime,
      endTime,
      label: label || 'Region',
      color: color || '#4F9DFF', // Default blue
    };
    regions.value.push(newRegion);
    console.log('[useTimelineMarkers] Added region:', newRegion);
  }

  function handleUpdateRegion(regionId: string, updates: Partial<TimelineRegion>) {
    const index = regions.value.findIndex((r) => r.id === regionId);
    if (index !== -1) {
      regions.value[index] = { ...regions.value[index], ...updates };
      console.log('[useTimelineMarkers] Updated region:', regions.value[index]);
    }
  }

  function handleDeleteRegion(regionId: string) {
    const index = regions.value.findIndex((r) => r.id === regionId);
    if (index !== -1) {
      regions.value.splice(index, 1);
      console.log('[useTimelineMarkers] Deleted region:', regionId);
    }
  }

  return {
    // State
    inPoint,
    outPoint,
    regions,

    // In/Out Point handlers
    handleSetInPoint,
    handleSetOutPoint,
    handleClearInOutPoints,
    handleGoToInPoint,
    handleGoToOutPoint,

    // Region handlers
    handleAddRegion,
    handleUpdateRegion,
    handleDeleteRegion,
  };
}
