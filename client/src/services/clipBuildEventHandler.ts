/**
 * Global Clip Build Event Handler
 *
 * This service listens for clip-build-complete events from the Rust backend
 * and ensures the database is always updated, regardless of which view is active.
 *
 * This solves the issue where clips get stuck in "building" status when the user
 * navigates away from the view that initiated the build.
 */

import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { updateClipBuildStatus, updateClipBuild, getClipBuilds } from './database/clip-build';

interface ClipBuildCompletePayload {
  clip_id: string;
  project_id: string;
  success: boolean;
  output_path: string | null;
  all_output_paths: string[];
  thumbnail_path: string | null;
  duration: number | null;
  file_size: number | null;
  error: string | null;
}

let unlistenComplete: UnlistenFn | null = null;
let isInitialized = false;

/**
 * Handle clip build completion event
 * This is the global handler that always updates the database
 */
async function handleClipBuildComplete(event: { payload: ClipBuildCompletePayload }) {
  const payload = event.payload;

  if (!payload || !payload.clip_id) {
    console.error(
      '[GlobalClipBuildHandler] Received clip-build-complete event with invalid payload'
    );
    return;
  }

  const { clip_id, success, output_path, thumbnail_path, duration, file_size, error } = payload;

  console.log(`[GlobalClipBuildHandler] Processing clip-build-complete for: ${clip_id}`, {
    success,
    output_path,
    error,
  });

  const isCancelled = error && (error.includes('cancelled') || error.includes('Cancelled'));

  try {
    if (success) {
      console.log(`[GlobalClipBuildHandler] Updating database for successful build: ${clip_id}`);

      // Update the clips table (legacy support)
      await updateClipBuildStatus(clip_id, 'completed', {
        progress: 100,
        builtFilePath: output_path || undefined,
        builtThumbnailPath: thumbnail_path || undefined,
        builtDuration: duration || undefined,
        builtFileSize: file_size || undefined,
        error: undefined,
      });

      // Also update the clip_builds table - find the most recent building record
      try {
        const builds = await getClipBuilds(clip_id);
        const buildingBuild = builds.find((b) => b.status === 'building');
        if (buildingBuild) {
          console.log(`[GlobalClipBuildHandler] Updating clip_builds record: ${buildingBuild.id}`);
          await updateClipBuild(buildingBuild.id, {
            status: 'completed',
            progress: 100,
            filePath: output_path || undefined,
            outputPaths: payload.all_output_paths || (output_path ? [output_path] : []),
            thumbnailPath: thumbnail_path || undefined,
            duration: duration || undefined,
            fileSize: file_size || undefined,
          });
          console.log(`[GlobalClipBuildHandler] clip_builds record updated successfully`);
        } else {
          console.warn(
            `[GlobalClipBuildHandler] No building record found in clip_builds for clip: ${clip_id}`
          );
        }
      } catch (buildError) {
        console.error(`[GlobalClipBuildHandler] Failed to update clip_builds:`, buildError);
      }

      console.log(`[GlobalClipBuildHandler] Database updated successfully for clip: ${clip_id}`);
    } else if (isCancelled) {
      console.log(`[GlobalClipBuildHandler] Resetting cancelled build: ${clip_id}`);
      await updateClipBuildStatus(clip_id, 'pending', {
        progress: 0,
        error: 'Build cancelled by user',
      });

      // Update clip_builds table for cancelled build
      try {
        const builds = await getClipBuilds(clip_id);
        const buildingBuild = builds.find((b) => b.status === 'building');
        if (buildingBuild) {
          await updateClipBuild(buildingBuild.id, {
            status: 'failed',
            progress: 0,
            errorMessage: 'Build cancelled by user',
          });
        }
      } catch (buildError) {
        console.error(
          `[GlobalClipBuildHandler] Failed to update clip_builds for cancelled build:`,
          buildError
        );
      }
    } else {
      console.log(`[GlobalClipBuildHandler] Marking build as failed: ${clip_id}`);
      await updateClipBuildStatus(clip_id, 'failed', {
        error: error || 'Unknown build error',
      });

      // Update clip_builds table for failed build
      try {
        const builds = await getClipBuilds(clip_id);
        const buildingBuild = builds.find((b) => b.status === 'building');
        if (buildingBuild) {
          await updateClipBuild(buildingBuild.id, {
            status: 'failed',
            errorMessage: error || 'Unknown build error',
          });
        }
      } catch (buildError) {
        console.error(
          `[GlobalClipBuildHandler] Failed to update clip_builds for failed build:`,
          buildError
        );
      }
    }
  } catch (dbError) {
    console.error(
      `[GlobalClipBuildHandler] Failed to update database for clip ${clip_id}:`,
      dbError
    );
  }
}

/**
 * Initialize the global clip build event handler
 * Should be called once when the app starts (e.g., in App.vue)
 */
export async function initClipBuildEventHandler(): Promise<void> {
  if (isInitialized) {
    console.log('[GlobalClipBuildHandler] Already initialized, skipping');
    return;
  }

  try {
    console.log('[GlobalClipBuildHandler] Initializing global clip build event handler...');

    unlistenComplete = await listen<ClipBuildCompletePayload>(
      'clip-build-complete',
      handleClipBuildComplete
    );

    isInitialized = true;
    console.log(
      '[GlobalClipBuildHandler] Global clip build event handler initialized successfully'
    );
  } catch (error) {
    console.error('[GlobalClipBuildHandler] Failed to initialize:', error);
  }
}

/**
 * Cleanup the global clip build event handler
 * Should be called when the app is unmounting (if needed)
 */
export function cleanupClipBuildEventHandler(): void {
  if (unlistenComplete) {
    unlistenComplete();
    unlistenComplete = null;
  }
  isInitialized = false;
  console.log('[GlobalClipBuildHandler] Cleaned up global clip build event handler');
}

/**
 * Check if the handler is initialized
 */
export function isClipBuildEventHandlerInitialized(): boolean {
  return isInitialized;
}
