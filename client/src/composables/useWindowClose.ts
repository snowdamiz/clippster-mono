import { ref } from 'vue';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

const showCloseDialog = ref(false);
const activeDownloadsCount = ref(0);
const clipGenerationInProgress = ref(false);

export function useWindowClose() {
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

  function setClipGenerationInProgress(isInProgress: boolean) {
    clipGenerationInProgress.value = isInProgress;
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
