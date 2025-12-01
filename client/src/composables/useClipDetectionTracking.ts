import { reactive, computed } from 'vue';

export interface DetectionState {
  isActive: boolean;
  progress: number;
  stage: string;
  message: string;
  error: string;
  startedAt: number;
}

// Global state - tracks active detection per project
const activeDetections = reactive<Map<string, DetectionState>>(new Map());

/**
 * Global tracking for clip detection across multiple projects.
 * This allows users to:
 * - Run clip detection on multiple projects simultaneously
 * - Navigate away and come back to see progress
 * - Interact with other projects while detection runs
 */
export function useClipDetectionTracking() {
  /**
   * Start tracking detection for a project
   */
  function startDetection(projectId: string) {
    activeDetections.set(projectId, {
      isActive: true,
      progress: 0,
      stage: 'initializing',
      message: 'Starting clip detection...',
      error: '',
      startedAt: Date.now(),
    });
  }

  /**
   * Update detection progress for a project
   */
  function updateProgress(
    projectId: string,
    progress: number,
    stage: string,
    message: string,
    error: string = ''
  ) {
    const existing = activeDetections.get(projectId);
    if (existing) {
      activeDetections.set(projectId, {
        ...existing,
        progress,
        stage,
        message,
        error,
      });
    }
  }

  /**
   * Complete detection for a project (success or error)
   */
  function completeDetection(projectId: string, error: string = '') {
    const existing = activeDetections.get(projectId);
    if (existing) {
      activeDetections.set(projectId, {
        ...existing,
        isActive: false,
        progress: error ? existing.progress : 100,
        stage: error ? 'error' : 'completed',
        message: error ? 'Detection failed' : 'Clip detection completed!',
        error,
      });

      // Remove from tracking after a delay so UI can show completion state
      setTimeout(() => {
        activeDetections.delete(projectId);
      }, 3000);
    }
  }

  /**
   * Check if a project has active detection
   */
  function isDetectionActive(projectId: string): boolean {
    const state = activeDetections.get(projectId);
    return state?.isActive ?? false;
  }

  /**
   * Get detection state for a project
   */
  function getDetectionState(projectId: string): DetectionState | null {
    return activeDetections.get(projectId) ?? null;
  }

  /**
   * Get all projects with active detection
   */
  const activeProjectIds = computed(() => {
    return Array.from(activeDetections.entries())
      .filter(([_, state]) => state.isActive)
      .map(([id]) => id);
  });

  /**
   * Check if any detection is active (for app close warning)
   */
  const hasAnyActiveDetection = computed(() => {
    return Array.from(activeDetections.values()).some((state) => state.isActive);
  });

  return {
    // State
    activeDetections,
    activeProjectIds,
    hasAnyActiveDetection,

    // Methods
    startDetection,
    updateProgress,
    completeDetection,
    isDetectionActive,
    getDetectionState,
  };
}
