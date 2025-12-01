import { ref, computed } from 'vue';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useClipDetectionTracking } from './useClipDetectionTracking';

const showCloseDialog = ref(false);
const activeDownloadsCount = ref(0);

export function useWindowClose() {
  // Use global detection tracking for accurate multi-project detection status
  const { hasAnyActiveDetection } = useClipDetectionTracking();

  // Computed property that checks global tracking
  const clipGenerationInProgress = computed(() => hasAnyActiveDetection.value);

  async function initializeWindowCloseHandler() {
    // Listen for window close events from Tauri
    await listen<number>('window-close-requested', (event) => {
      activeDownloadsCount.value = event.payload;
      showCloseDialog.value = true;
    });
  }

  async function confirmCloseWithCleanup() {
    try {
      // Cancel all active downloads and clean up partial files
      await invoke<string[]>('cancel_all_downloads');

      // Close the window
      const window = getCurrentWebviewWindow();
      await window.close();

      return true;
    } catch (error) {
      // Still close the window even if cleanup failed
      const window = getCurrentWebviewWindow();
      await window.close();
      return true;
    }
  }

  function cancelClose() {
    showCloseDialog.value = false;
    activeDownloadsCount.value = 0;
  }

  // Legacy function - kept for backwards compatibility but no longer needed
  // as clipGenerationInProgress now uses global tracking directly
  function setClipGenerationInProgress(_isInProgress: boolean) {
    // No-op - state is now managed by useClipDetectionTracking
  }

  return {
    showCloseDialog,
    activeDownloadsCount,
    clipGenerationInProgress,
    initializeWindowCloseHandler,
    confirmCloseWithCleanup,
    cancelClose,
    setClipGenerationInProgress,
  };
}
