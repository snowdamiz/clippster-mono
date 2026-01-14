import { ref, reactive } from 'vue';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import {
  createRawVideo,
  getNextSegmentNumber,
  createProject,
  getDatabase,
} from '@/services/database';
import { generateId } from '@/services/database';
import { trackEvent } from '@/services/analytics';

// Event emitter for download completion notifications
const completionCallbacks = new Set<(download: ActiveDownload) => void>();

export interface DownloadProgress {
  download_id: string;
  progress: number;
  current_time?: number;
  total_time?: number;
  status: string;
}

export interface DownloadResult {
  download_id: string;
  success: boolean;
  file_path?: string;
  thumbnail_path?: string;
  duration?: number;
  width?: number;
  height?: number;
  codec?: string;
  file_size?: number;
  error?: string;
}

export interface ActiveDownload {
  id: string;
  title: string;
  mintId: string;
  progress: DownloadProgress;
  result?: DownloadResult;
  rawVideoId?: string;
  // Segment tracking information
  sourceClipId?: string;
  segmentNumber?: number;
  isSegment?: boolean;
  isAutoSegmented?: boolean;
  segmentStartTime?: number;
  segmentEndTime?: number;
  // Queue and video info
  videoUrl?: string;
  isQueued?: boolean;
  // Project grouping
  projectId?: string;
  parentProjectId?: string;
  provider?: 'pumpfun' | 'kick' | 'twitch';
  groupId?: string;
  totalSegments?: number;
  currentSegmentIndex?: number;
}

const activeDownloads = reactive<Map<string, ActiveDownload>>(new Map());
const queuedDownloads = reactive<Map<string, ActiveDownload>>(new Map());
const isInitialized = ref(false);

// Download queue settings
const MAX_CONCURRENT_DOWNLOADS = 1;
const activeDownloadIds = reactive<Set<string>>(new Set());

// Persistence keys
const ACTIVE_DOWNLOADS_KEY = 'clippster_active_downloads';
const QUEUED_DOWNLOADS_KEY = 'clippster_queued_downloads';

function saveState() {
  try {
    const activeList = Array.from(activeDownloads.values());
    const queuedList = Array.from(queuedDownloads.values());

    localStorage.setItem(ACTIVE_DOWNLOADS_KEY, JSON.stringify(activeList));
    localStorage.setItem(QUEUED_DOWNLOADS_KEY, JSON.stringify(queuedList));
  } catch (e) {
    console.warn('Failed to save downloads state:', e);
  }
}

function loadState() {
  try {
    const activeJson = localStorage.getItem(ACTIVE_DOWNLOADS_KEY);
    const queuedJson = localStorage.getItem(QUEUED_DOWNLOADS_KEY);

    // Clear current state first to avoid duplicates if called multiple times
    activeDownloads.clear();
    activeDownloadIds.clear();
    queuedDownloads.clear();

    if (activeJson) {
      const list = JSON.parse(activeJson) as ActiveDownload[];
      list.forEach((d) => {
        // If it has a result, it's completed.
        // If it doesn't have a result, it WAS active.

        if (!d.result) {
          // It was active.
          // We'll mark it as 'Interrupted' and NOT add to activeDownloadIds immediately.
          d.progress.status = 'Interrupted';
          // We intentionally do NOT add to activeDownloadIds here.
          // If the download is actually running, we'll receive a progress event,
          // and the listener will add it to activeDownloadIds then.
        }

        activeDownloads.set(d.id, d);

        // Note: We only add to activeDownloadIds if we are SURE it is running.
        // On reload, we assume nothing is running until proven otherwise (via progress event)
        // or unless we implement a backend check.
      });
    }

    if (queuedJson) {
      const list = JSON.parse(queuedJson) as ActiveDownload[];
      list.forEach((d) => queuedDownloads.set(d.id, d));
    }

    console.log(
      `[Downloads] State loaded. Active: ${activeDownloads.size}, Queued: ${queuedDownloads.size}`
    );
  } catch (e) {
    console.warn('Failed to load downloads state:', e);
  }
}

export function useDownloads() {
  async function initialize() {
    if (isInitialized.value) {
      return;
    }

    // Load state BEFORE setting up listeners so we don't miss immediate updates
    // if the backend is already sending them (though unlikely on strict reload)
    loadState();

    // Listen for download progress updates
    await listen<DownloadProgress>('download-progress', (event) => {
      const download = activeDownloads.get(event.payload.download_id);
      if (download) {
        download.progress = event.payload;

        // Ensure it's marked as active if we get progress
        // This recovers "Interrupted" downloads that are actually still running
        if (!download.result && !activeDownloadIds.has(download.id)) {
          activeDownloadIds.add(download.id);
        }

        saveState(); // Save progress updates
      } else {
        // If we receive progress for a download we don't know about (e.g. after hard refresh),
        // we could try to recover it if the backend sent full info, but progress event is partial.
        // For now, just log it.
        // Ideally backend would provide a "sync state" command.
        console.warn(
          '[Downloads] Received progress for unknown download:',
          event.payload.download_id
        );
      }
    });

    // Listen for download completion
    await listen<DownloadResult>('download-complete', async (event) => {
      console.log('[Downloads] Download complete event received:', event.payload.download_id);
      const download = activeDownloads.get(event.payload.download_id);
      if (download) {
        console.log('[Downloads] Download found in activeDownloads:', {
          id: download.id,
          title: download.title,
          projectId: download.projectId,
          parentProjectId: download.parentProjectId,
        });
        download.result = event.payload;
        saveState(); // Save result

        // If download was successful, validate the video and thumbnail before creating database record
        if (event.payload.success && event.payload.file_path) {
          try {
            // Validate the downloaded video and thumbnail
            const validationResult = await validateDownloadedVideo(
              event.payload.file_path,
              event.payload.thumbnail_path || null,
              download.title
            );

            if (validationResult.isValid) {
              // Determine project ID
              let finalProjectId = download.projectId;

              // If this is a child segment (has parent project), create a sub-project for it
              if (download.parentProjectId && !finalProjectId) {
                try {
                  finalProjectId = await createProject(
                    download.title,
                    undefined,
                    download.parentProjectId
                  );
                } catch (error) {
                  console.warn('[Downloads] Failed to create child project for segment:', error);
                  // Fallback to parent project
                  finalProjectId = download.parentProjectId;
                }
              }

              // Video is valid, create database record
              // Note: Waveform generation is deferred until the user opens the workspace
              const rawVideoId = await createRawVideo(event.payload.file_path, {
                projectId: finalProjectId,
                originalFilename: download.title,
                thumbnailPath: validationResult.thumbnailPath || event.payload.thumbnail_path,
                duration: event.payload.duration,
                width: event.payload.width,
                height: event.payload.height,
                frameRate: undefined, // We don't have this info from the basic download
                codec: event.payload.codec,
                fileSize: event.payload.file_size,
                // Segment tracking information
                sourceClipId: download.sourceClipId,
                sourceMintId: download.mintId,
                segmentNumber: download.segmentNumber,
                isSegment: download.isSegment || false,
                segmentStartTime: download.segmentStartTime,
                segmentEndTime: download.segmentEndTime,
                originalProjectId: download.parentProjectId,
              });

              // If we just added a video to a project, we should make sure the project's updated_at is refreshed
              // and maybe set a thumbnail if it doesn't have one
              if (finalProjectId) {
                try {
                  const { updateProject } = await import('@/services/database');
                  // Update timestamp
                  await updateProject(finalProjectId, undefined, undefined);

                  // Also update parent project if it exists
                  if (download.parentProjectId && download.parentProjectId !== finalProjectId) {
                    await updateProject(download.parentProjectId, undefined, undefined);
                  }

                  // Notify UI to refresh projects
                  console.log('[Downloads] Dispatching video-added event:', {
                    rawVideoId,
                    projectId: finalProjectId,
                    parentProjectId: download.parentProjectId,
                  });
                  window.dispatchEvent(
                    new CustomEvent('video-added', {
                      detail: { rawVideoId, projectId: finalProjectId },
                    })
                  );
                } catch (e) {
                  console.warn('Failed to update project timestamp:', e);
                }
              }

              download.rawVideoId = rawVideoId;

              // Pre-generate waveform in background for instant loading when user opens editor
              // This runs async and doesn't block the download completion
              try {
                const { invoke } = await import('@tauri-apps/api/core');
                console.log('[Downloads] Pre-generating waveform for:', event.payload.file_path);
                // Fire and forget - don't await, let it run in background
                invoke('extract_audio_waveform', {
                  videoPath: event.payload.file_path,
                }).then(() => {
                  console.log('[Downloads] Waveform pre-generation complete for:', download.title);
                }).catch((err) => {
                  console.warn('[Downloads] Waveform pre-generation failed (non-critical):', err);
                });
              } catch (e) {
                console.warn('[Downloads] Failed to start waveform pre-generation:', e);
              }
              
              // Track analytics
              trackEvent({
                event_type: 'vod_download',
                metadata: {
                  download_id: event.payload.download_id,
                  title: download.title,
                  provider: download.provider,
                  is_segment: download.isSegment,
                },
              });

              // Notify all listeners about completion
              completionCallbacks.forEach((callback) => {
                try {
                  callback(download);
                } catch (error) {
                  console.error('[Downloads] Error in completion callback:', error);
                }
              });
            } else {
              // Video validation failed, cleanup and notify error

              // Cleanup corrupted files
              await cleanupCorruptedDownload(
                event.payload.file_path,
                validationResult.thumbnailPath || event.payload.thumbnail_path || null,
                download.rawVideoId
              );

              // Update download result to show failure
              download.result = {
                ...event.payload,
                success: false,
                error: validationResult.error || 'Video validation failed',
              };

              // Notify listeners about validation failure
              completionCallbacks.forEach((callback) => {
                try {
                  callback(download);
                } catch (error) {
                  console.error('[Downloads] Error in completion callback:', error);
                }
              });
            }
          } catch (error) {
            // Cleanup on validation error
            await cleanupCorruptedDownload(
              event.payload.file_path,
              event.payload.thumbnail_path || null,
              download.rawVideoId
            );

            // Update result to show failure
            download.result = {
              ...event.payload,
              success: false,
              error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
          }
        }
      } else {
        console.warn(
          '[Downloads] Received completion for unknown download:',
          event.payload.download_id
        );
      }

      // Process queue when any download completes (successfully or not)
      if (activeDownloads.has(event.payload.download_id)) {
        // Remove from active downloads tracking
        activeDownloadIds.delete(event.payload.download_id);

        // Clean up metadata on successful completion (no need to keep it)
        if (event.payload.success) {
          try {
            await invoke('cleanup_completed_download', { downloadId: event.payload.download_id });
          } catch (cleanupError) {
            console.warn(
              '[Downloads] Failed to cleanup completed download metadata:',
              cleanupError
            );
          }
        }

        saveState(); // Save state after completion

        // Process next in queue
        processQueue();
      } else {
        // Even if it wasn't in active downloads (maybe lost sync), try to save state just in case
        // though likely we can't do much if we lost the record
        saveState();
      }
    });

    // Process queue on initialize
    processQueue();

    isInitialized.value = true;
  }

  async function startDownload(
    title: string,
    videoUrl: string,
    mintId: string,
    segmentRange?: { startTime: number; endTime: number },
    sourceClipId?: string,
    totalDuration?: number,
    options: {
      autoSegment?: boolean;
      segmentDuration?: number;
      provider?: 'pumpfun' | 'kick' | 'twitch';
      // Watermark settings from creator profile (stored with project for automatic application)
      creatorWatermarkSettings?: {
        watermarkId: string;
        watermarkSettings: string; // JSON string of per-ratio watermark settings
      };
    } = {}
  ): Promise<string> {
    await initialize();

    const provider = options.provider || 'pumpfun';

    // If this is a full stream download and we have duration info, check if we need auto-segmentation
    const shouldAutoSegment = options.autoSegment === true; // Default to false, only segment if explicitly requested
    const segmentDuration = options.segmentDuration || 3600; // Default to 1 hour

    if (!segmentRange && totalDuration && totalDuration > segmentDuration && shouldAutoSegment) {
      // Auto-segment into equal chunks, no larger than segmentDuration each
      console.log(
        `[Downloads] Auto-segmenting ${totalDuration}s video into ${
          segmentDuration / 60
        }-minute max chunks`
      );
      return await startAutoSegmentedDownload(
        title,
        videoUrl,
        mintId,
        sourceClipId || mintId,
        totalDuration,
        segmentDuration,
        provider,
        options.creatorWatermarkSettings
      );
    }

    const downloadId = generateId();

    const isSegmentDownload = !!(
      segmentRange &&
      sourceClipId &&
      segmentRange.startTime >= 0 &&
      segmentRange.endTime > segmentRange.startTime
    );

    let finalTitle = title;
    let segmentNumber: number | undefined;

    // Generate segment name if this is a segment download
    if (isSegmentDownload) {
      try {
        segmentNumber = await getNextSegmentNumber(sourceClipId);
        finalTitle = `${title} Segment ${segmentNumber}`;
      } catch (error) {
        // Fallback to original title if database isn't migrated
        finalTitle = title;
      }
    }

    // Create a project for this download
    let projectId: string | undefined;
    let parentProjectId: string | undefined;

    try {
      if (isSegmentDownload) {
        // For segments, try to find an existing parent project for this stream
        const db = await getDatabase();
        const { getCurrentUserId } = await import('@/services/database');
        const userId = getCurrentUserId();

        // Search for a project with the same name as the stream title (without "Segment X")
        // and that is a top-level project (no parent_id)
        // IMPORTANT: Filter by user_id to only find projects owned by current user
        let existingProjects: { id: string }[] = [];
        if (userId !== null) {
          existingProjects = await db.select<{ id: string }[]>(
            'SELECT id FROM projects WHERE name = ? AND parent_id IS NULL AND (user_id = ? OR user_id IS NULL)',
            [title, userId]
          );
        } else {
          existingProjects = await db.select<{ id: string }[]>(
            'SELECT id FROM projects WHERE name = ? AND parent_id IS NULL AND user_id IS NULL',
            [title]
          );
        }

        // Serialize watermark settings if provided
        const watermarkSettingsJson = options.creatorWatermarkSettings
          ? JSON.stringify(options.creatorWatermarkSettings)
          : undefined;

        if (existingProjects.length > 0) {
          // Found an existing parent project owned by current user
          parentProjectId = existingProjects[0].id;
        } else {
          // Create a new parent project
          const sourceLabel = provider === 'kick' ? `Channel: ${mintId}` : `Mint: ${mintId}`;
          parentProjectId = await createProject(
            title,
            `Manual downloads from ${provider === 'kick' ? 'Kick' : 'PumpFun'} (${sourceLabel})`,
            undefined,
            provider === 'kick' ? 'Kick' : 'PumpFun',
            watermarkSettingsJson
          );
        }

        // Create the child project for this specific segment
        projectId = await createProject(
          finalTitle,
          `Segment ${segmentNumber} of ${title}`,
          parentProjectId,
          provider === 'kick' ? 'Kick' : 'PumpFun',
          watermarkSettingsJson
        );
      } else {
        // Serialize watermark settings if provided
        const watermarkSettingsJson = options.creatorWatermarkSettings
          ? JSON.stringify(options.creatorWatermarkSettings)
          : undefined;

        // Full stream download - create a standard project
        const sourceLabel = provider === 'kick' ? `Channel: ${mintId}` : `Mint: ${mintId}`;
        projectId = await createProject(
          finalTitle,
          `Downloaded from ${provider === 'kick' ? 'Kick' : 'PumpFun'} (${sourceLabel})`,
          undefined,
          provider === 'kick' ? 'Kick' : 'PumpFun',
          watermarkSettingsJson
        );
      }
      console.log('[Downloads] Project structure created:', {
        projectId,
        parentProjectId,
        isSegmentDownload,
      });
    } catch (error) {
      console.warn('[Downloads] Failed to create project structure for download:', error);
    }

    const download: ActiveDownload = {
      id: downloadId,
      title: finalTitle,
      mintId,
      progress: {
        download_id: downloadId,
        progress: 0,
        status: 'Initializing...',
      },
      // Add segment tracking information
      sourceClipId: sourceClipId || (isSegmentDownload ? mintId : undefined),
      segmentNumber,
      isSegment: isSegmentDownload,
      segmentStartTime: segmentRange?.startTime,
      segmentEndTime: segmentRange?.endTime,
      projectId,
      parentProjectId,
      provider,
    };

    activeDownloads.set(downloadId, download);
    saveState(); // Save new download

    try {
      if (provider === 'kick') {
        if (isSegmentDownload) {
          invoke('download_kick_vod_segment', {
            downloadId,
            title: finalTitle,
            videoUrl,
            channelSlug: mintId,
            startTime: segmentRange.startTime,
            endTime: segmentRange.endTime,
          }).catch((_error) => {
            activeDownloads.delete(downloadId);
          });
        } else {
          invoke('download_kick_vod', {
            downloadId,
            title: finalTitle,
            videoUrl,
            channelSlug: mintId,
          }).catch((_error) => {
            activeDownloads.delete(downloadId);
          });
        }
      } else if (provider === 'twitch') {
        // Twitch VODs use the same download logic as Kick (yt-dlp based)
        if (isSegmentDownload) {
          invoke('download_kick_vod_segment', {
            downloadId,
            title: finalTitle,
            videoUrl,
            channelSlug: mintId, // channel name for Twitch
            startTime: segmentRange.startTime,
            endTime: segmentRange.endTime,
          }).catch((_error) => {
            activeDownloads.delete(downloadId);
          });
        } else {
          invoke('download_kick_vod', {
            downloadId,
            title: finalTitle,
            videoUrl,
            channelSlug: mintId, // channel name for Twitch
          }).catch((_error) => {
            activeDownloads.delete(downloadId);
          });
        }
      } else {
        // PumpFun (default)
        if (isSegmentDownload) {
          invoke('download_pumpfun_vod_segment', {
            downloadId,
            title: finalTitle,
            videoUrl,
            mintId,
            startTime: segmentRange.startTime,
            endTime: segmentRange.endTime,
          }).catch((_error) => {
            activeDownloads.delete(downloadId);
          });
        } else {
          invoke('download_pumpfun_vod', {
            downloadId,
            title: finalTitle,
            videoUrl,
            mintId,
          }).catch((_error) => {
            activeDownloads.delete(downloadId);
          });
        }
      }
    } catch (error) {
      // Remove from active downloads if failed to start
      activeDownloads.delete(downloadId);
      throw error;
    }

    return downloadId;
  }

  // Auto-segment download function for long videos
  async function startAutoSegmentedDownload(
    title: string,
    videoUrl: string,
    mintId: string,
    sourceClipId: string,
    totalDuration: number,
    maxSegmentDuration: number = 3600,
    provider: 'pumpfun' | 'kick' | 'twitch' = 'pumpfun',
    creatorWatermarkSettings?: { watermarkId: string; watermarkSettings: string }
  ): Promise<string> {
    await initialize();

    // Calculate equal segments, no larger than maxSegmentDuration each
    const numberOfSegments = Math.ceil(totalDuration / maxSegmentDuration);
    const segmentDuration = totalDuration / numberOfSegments;

    console.log(
      `[Downloads] Splitting into ${numberOfSegments} equal segments of ${segmentDuration.toFixed(2)}s each`
    );

    // Create segments with equal time ranges
    const segments: Array<{ startTime: number; endTime: number; segmentNumber: number }> = [];
    for (let i = 0; i < numberOfSegments; i++) {
      const startTime = i * segmentDuration;
      const endTime = Math.min((i + 1) * segmentDuration, totalDuration);
      segments.push({
        startTime: Math.round(startTime * 1000) / 1000, // Round to 3 decimal places
        endTime: Math.round(endTime * 1000) / 1000,
        segmentNumber: i + 1,
      });
    }

    // Create a group ID to link all segments together
    const groupId = generateId();
    const allDownloadIds: string[] = [];

    // Create a parent project for the auto-segmented download
    let parentProjectId: string | undefined;
    try {
      // Serialize watermark settings if provided
      const watermarkSettingsJson = creatorWatermarkSettings
        ? JSON.stringify(creatorWatermarkSettings)
        : undefined;

      parentProjectId = await createProject(
        title,
        `Auto-segmented download from ${provider === 'kick' ? 'Kick' : provider === 'twitch' ? 'Twitch' : 'PumpFun'} (${provider === 'kick' || provider === 'twitch' ? 'Channel' : 'Mint'}: ${mintId}). ${numberOfSegments} parts.`,
        undefined,
        provider === 'kick' ? 'Kick' : provider === 'twitch' ? 'Twitch' : 'PumpFun',
        watermarkSettingsJson
      );
    } catch (error) {
      console.warn(
        '[Downloads] Failed to create parent project for auto-segmented download:',
        error
      );
    }

    // Process segments with queue system
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const segmentTitle = `${title} Part ${segment.segmentNumber}`;

      // Create download object
      const downloadId = generateId();
      const download: ActiveDownload = {
        id: downloadId,
        title: segmentTitle,
        mintId,
        progress: {
          download_id: downloadId,
          progress: 0,
          status: i < MAX_CONCURRENT_DOWNLOADS ? 'Initializing...' : 'Queued...',
        },
        sourceClipId: sourceClipId,
        segmentNumber: segment.segmentNumber,
        isSegment: true,
        segmentStartTime: segment.startTime,
        segmentEndTime: segment.endTime,
        videoUrl: videoUrl,
        parentProjectId,
        groupId,
        totalSegments: numberOfSegments,
        currentSegmentIndex: i,
        isAutoSegmented: true,
        isQueued: i >= MAX_CONCURRENT_DOWNLOADS,
      };

      console.log(`[Downloads] Created segment download ${i + 1}/${numberOfSegments}:`, {
        id: downloadId,
        title: segmentTitle,
        groupId,
      });

      // Add to appropriate queue
      if (i < MAX_CONCURRENT_DOWNLOADS) {
        activeDownloads.set(downloadId, download);
        activeDownloadIds.add(downloadId);

        // Start the download immediately
        const startPromise =
          provider === 'kick'
            ? invoke('download_kick_vod_segment', {
                downloadId,
                title: segmentTitle,
                videoUrl,
                channelSlug: mintId,
                startTime: segment.startTime,
                endTime: segment.endTime,
              })
            : invoke('download_pumpfun_vod_segment', {
                downloadId,
                title: segmentTitle,
                videoUrl,
                mintId,
                startTime: segment.startTime,
                endTime: segment.endTime,
              });

        startPromise.catch((_error) => {
          // Remove from active downloads if failed to start
          activeDownloads.delete(downloadId);
          activeDownloadIds.delete(downloadId);
          saveState();
          // Start next in queue
          processQueue();
        });
      } else {
        // Add to queue
        queuedDownloads.set(downloadId, download);
        console.log(
          `[Downloads] Segment ${segment.segmentNumber} queued (position ${i - MAX_CONCURRENT_DOWNLOADS + 1})`
        );
      }

      allDownloadIds.push(downloadId);
    }

    saveState(); // Save initial queue state

    console.log(
      `[Downloads] Started ${Math.min(numberOfSegments, MAX_CONCURRENT_DOWNLOADS)} immediate downloads, queued ${Math.max(0, numberOfSegments - MAX_CONCURRENT_DOWNLOADS)} with group ID: ${groupId}`
    );

    // Return the first download ID as the primary identifier
    return allDownloadIds[0];
  }

  // Process queued downloads
  function processQueue() {
    // Clean up stale active downloads to prevent queue blocking
    // This removes any IDs from the active set that are not actually active (completed or interrupted)
    for (const id of activeDownloadIds) {
      const d = activeDownloads.get(id);
      if (!d || d.result || d.progress.status === 'Interrupted') {
        activeDownloadIds.delete(id);
      }
    }

    console.log('[Downloads] Processing queue...');
    if (queuedDownloads.size === 0) {
      console.log('[Downloads] Queue empty');
      return;
    }

    // Re-count active downloads from the reactive set to be sure
    const currentActiveCount = activeDownloadIds.size;

    if (currentActiveCount >= MAX_CONCURRENT_DOWNLOADS) {
      console.log(
        `[Downloads] Queue waiting. Active: ${currentActiveCount}/${MAX_CONCURRENT_DOWNLOADS}`
      );
      return;
    }

    // Get the next download from queue (FIFO)
    const nextQueuedId = queuedDownloads.keys().next().value;
    if (!nextQueuedId) return;

    const queuedDownload = queuedDownloads.get(nextQueuedId);
    if (!queuedDownload) return;

    // Move from queue to active
    queuedDownloads.delete(nextQueuedId);
    activeDownloads.set(nextQueuedId, queuedDownload);
    activeDownloadIds.add(nextQueuedId);

    saveState(); // Save state after moving from queue

    // Update status
    queuedDownload.progress.status = 'Initializing...';
    queuedDownload.isQueued = false;

    // Get segment info
    const segmentRange = {
      startTime: queuedDownload.segmentStartTime!,
      endTime: queuedDownload.segmentEndTime!,
    };

    console.log(
      `[Downloads] Starting queued download: ${queuedDownload.title} (ID: ${nextQueuedId})`
    );

    const provider = queuedDownload.provider || 'pumpfun';
    const startPromise =
      provider === 'kick'
        ? invoke('download_kick_vod_segment', {
            downloadId: nextQueuedId,
            title: queuedDownload.title,
            videoUrl: queuedDownload.videoUrl!,
            channelSlug: queuedDownload.mintId,
            startTime: segmentRange.startTime,
            endTime: segmentRange.endTime,
          })
        : invoke('download_pumpfun_vod_segment', {
            downloadId: nextQueuedId,
            title: queuedDownload.title,
            videoUrl: queuedDownload.videoUrl!,
            mintId: queuedDownload.mintId,
            startTime: segmentRange.startTime,
            endTime: segmentRange.endTime,
          });

    // Start the download
    startPromise.catch((_error) => {
      console.error(`[Downloads] Failed to start queued download ${nextQueuedId}:`, _error);
      // Remove from active downloads if failed to start
      activeDownloads.delete(nextQueuedId);
      activeDownloadIds.delete(nextQueuedId);
      saveState();
      // Start next in queue
      processQueue();
    });
  }

  function getDownload(downloadId: string): ActiveDownload | undefined {
    return activeDownloads.get(downloadId);
  }

  function getAllDownloads(): ActiveDownload[] {
    return [...Array.from(activeDownloads.values()), ...Array.from(queuedDownloads.values())];
  }

  function getActiveDownloads(): ActiveDownload[] {
    return Array.from(activeDownloads.values()).filter(
      (download) => !download.result || download.result.success === undefined
    );
  }

  function getQueuedDownloads(): ActiveDownload[] {
    return Array.from(queuedDownloads.values());
  }

  function getCompletedDownloads(): ActiveDownload[] {
    return Array.from(activeDownloads.values()).filter(
      (download) => download.result && download.result.success !== undefined
    );
  }

  function removeDownload(downloadId: string): boolean {
    return activeDownloads.delete(downloadId);
  }

  function clearCompleted(): void {
    for (const [id, download] of activeDownloads.entries()) {
      if (download.result && download.result.success !== undefined) {
        activeDownloads.delete(id);
      }
    }
  }

  // Cleanup old completed downloads (older than 5 minutes)
  function cleanupOldDownloads(): void {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    for (const [id, download] of activeDownloads.entries()) {
      if (download.result && download.result.success !== undefined) {
        // If it's a completed download, remove it if it's older than 5 minutes
        // This prevents the downloads list from growing indefinitely
        if (Date.now() - fiveMinutesAgo > 0) {
          activeDownloads.delete(id);
        }
      }
    }
  }

  // Cancel download function
  async function cancelDownload(downloadId: string): Promise<boolean> {
    try {
      console.log(`[Downloads] Canceling download: ${downloadId}`);

      let cancelled = false;

      // Check if download is in active downloads
      if (activeDownloads.has(downloadId)) {
        // Attempt to cancel the actual download process
        try {
          cancelled = await invoke('cancel_download', { downloadId });
        } catch (cancelError) {
          console.warn('[Downloads] Failed to cancel backend process:', cancelError);
          // Continue with cleanup even if backend cancellation fails
          cancelled = true; // Assume we can still clean up
        }

        // Remove from active downloads
        activeDownloads.delete(downloadId);
        activeDownloadIds.delete(downloadId);

        // Process next in queue
        processQueue();
      }

      // Check if download is in queue
      if (queuedDownloads.has(downloadId)) {
        // Simply remove from queue (no backend process to cancel)
        queuedDownloads.delete(downloadId);
        cancelled = true;
      }

      saveState();
      return cancelled;
    } catch (error) {
      console.error('[Downloads] Error canceling download:', error);
      return false;
    }
  }

  // Cancel all downloads in a group
  async function cancelGroup(groupId: string): Promise<void> {
    const downloads = getAllDownloads().filter((d) => d.groupId === groupId);
    console.log(`[Downloads] Canceling group ${groupId} with ${downloads.length} downloads`);
    for (const d of downloads) {
      await cancelDownload(d.id);
    }
  }

  // Register a callback for download completion events
  function onDownloadComplete(callback: (download: ActiveDownload) => void): () => void {
    completionCallbacks.add(callback);

    // Return a function to unregister the callback
    return () => {
      completionCallbacks.delete(callback);
    };
  }

  // Validation functions
  async function validateDownloadedVideo(
    filePath: string,
    thumbnailPath: string | null,
    _title: string
  ): Promise<{ isValid: boolean; thumbnailPath?: string | null; error?: string }> {
    try {
      // Check if video file exists and has content
      const videoExists = await invoke<boolean>('check_file_exists', { path: filePath });

      if (!videoExists) {
        return { isValid: false, error: 'Video file does not exist' };
      }

      // Validate video file integrity using FFmpeg
      const videoValidation = await invoke<any>('validate_video_file', { filePath });

      if (!videoValidation.is_valid) {
        return {
          isValid: false,
          error: videoValidation.error || 'Video file is corrupted or invalid',
        };
      }

      // Check if thumbnail exists, and if not, try to regenerate it
      let finalThumbnailPath = thumbnailPath;
      if (thumbnailPath) {
        const thumbnailExists = await invoke<boolean>('check_file_exists', { path: thumbnailPath });

        if (!thumbnailExists) {
          try {
            finalThumbnailPath = await invoke<string>('generate_thumbnail', {
              videoPath: filePath,
            });
          } catch (thumbnailError) {
            console.warn('[Validation] Failed to regenerate thumbnail:', thumbnailError);
            // Continue without thumbnail - not a critical failure
          }
        }
      } else {
        console.log('[Validation] No thumbnail path provided');
      }

      return { isValid: true, thumbnailPath: finalThumbnailPath };
    } catch (error) {
      return {
        isValid: false,
        error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async function cleanupCorruptedDownload(
    filePath: string | null,
    thumbnailPath: string | null,
    rawVideoId: string | undefined
  ): Promise<void> {
    try {
      // Delete video file if it exists
      if (filePath) {
        try {
          await invoke('delete_video_file', {
            filePath,
            thumbnailPath: thumbnailPath || undefined,
          });
        } catch (error) {
          console.warn('[Cleanup] Failed to delete video file:', error);
        }
      }

      // Delete database record if it was created
      if (rawVideoId) {
        try {
          const { deleteRawVideo } = await import('@/services/database');
          await deleteRawVideo(rawVideoId);
        } catch (error) {
          console.warn('[Cleanup] Failed to delete database record:', error);
        }
      }
    } catch (error) {
      console.error('[Cleanup] Error during cleanup:', error);
    }
  }

  return {
    activeDownloads,
    queuedDownloads,
    isInitialized,
    initialize,
    startDownload,
    getDownload,
    getAllDownloads,
    getActiveDownloads,
    getQueuedDownloads,
    getCompletedDownloads,
    removeDownload,
    clearCompleted,
    cleanupOldDownloads,
    cancelDownload,
    cancelGroup,
    onDownloadComplete,
    validateDownloadedVideo,
    cleanupCorruptedDownload,
  };
}
