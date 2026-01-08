import { ref, reactive } from 'vue';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'error'
  | 'up-to-date';

export interface UpdateInfo {
  version: string;
  date?: string;
  body?: string;
}

export interface DownloadProgress {
  downloaded: number;
  total: number;
  percent: number;
}

interface UpdateState {
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  progress: DownloadProgress;
  error: string | null;
}

const state = reactive<UpdateState>({
  status: 'idle',
  updateInfo: null,
  progress: {
    downloaded: 0,
    total: 0,
    percent: 0,
  },
  error: null,
});

// Store the update object for later use
let pendingUpdate: Update | null = null;

/**
 * Check for available updates
 * @returns true if an update is available, false otherwise
 */
async function checkForUpdates(): Promise<boolean> {
  state.status = 'checking';
  state.error = null;
  state.updateInfo = null;

  try {
    console.log('[AppUpdater] Checking for updates...');
    const update = await check();

    if (update) {
      console.log('[AppUpdater] Update available:', update.version);
      pendingUpdate = update;
      state.updateInfo = {
        version: update.version,
        date: update.date,
        body: update.body,
      };
      state.status = 'available';
      return true;
    } else {
      console.log('[AppUpdater] App is up to date');
      state.status = 'up-to-date';
      return false;
    }
  } catch (error) {
    console.error('[AppUpdater] Failed to check for updates:', error);
    state.error = error instanceof Error ? error.message : 'Failed to check for updates';
    state.status = 'error';
    return false;
  }
}

/**
 * Download and install the pending update, then restart the app
 */
async function downloadAndInstall(): Promise<void> {
  if (!pendingUpdate) {
    throw new Error('No update available to install');
  }

  state.status = 'downloading';
  state.progress = { downloaded: 0, total: 0, percent: 0 };

  try {
    console.log('[AppUpdater] Starting download and install...');

    await pendingUpdate.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          state.progress.total = event.data.contentLength ?? 0;
          console.log(`[AppUpdater] Download started: ${state.progress.total} bytes`);
          break;

        case 'Progress':
          state.progress.downloaded += event.data.chunkLength;
          if (state.progress.total > 0) {
            state.progress.percent = Math.round(
              (state.progress.downloaded / state.progress.total) * 100
            );
          }
          break;

        case 'Finished':
          state.progress.percent = 100;
          console.log('[AppUpdater] Download finished');
          break;
      }
    });

    state.status = 'installing';
    console.log('[AppUpdater] Update installed, restarting app...');

    // Small delay to show the installing state
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Restart the application
    await relaunch();
  } catch (error) {
    console.error('[AppUpdater] Failed to download/install update:', error);
    state.error = error instanceof Error ? error.message : 'Failed to install update';
    state.status = 'error';
    throw error;
  }
}

/**
 * Reset the updater state (e.g., after dismissing an error)
 */
function resetState(): void {
  state.status = 'idle';
  state.error = null;
  state.updateInfo = null;
  state.progress = { downloaded: 0, total: 0, percent: 0 };
  pendingUpdate = null;
}

export function useAppUpdater() {
  return {
    // State (reactive)
    status: ref(state).value.status,
    updateInfo: ref(state).value.updateInfo,
    progress: ref(state).value.progress,
    error: ref(state).value.error,

    // Get reactive state object directly
    state,

    // Actions
    checkForUpdates,
    downloadAndInstall,
    resetState,
  };
}
