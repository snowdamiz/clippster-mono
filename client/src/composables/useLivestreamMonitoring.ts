import { ref, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  createLivestreamSession,
  endLivestreamSession,
  updateMonitoredStreamer,
  getMonitoredStreamer,
  deleteProject,
  hasRawVideosForProject,
  hasClipsForProject,
} from '@/services/database';
import type {
  LiveSession,
  LiveStatus,
  MonitoredStreamer,
  ActivityLog,
  SegmentEventPayload,
} from '@/types/livestream';
import { useLivestreamSegmentProcessing } from './useLivestreamSegmentProcessing';

const POLL_INTERVAL_MS = 30_000;

// Global State
const activeSessions = ref<Map<string, LiveSession>>(new Map());
const failedSessions = ref<Map<string, number>>(new Map()); // streamerId -> timestamp
const monitoredStreamers = ref<
  Map<string, { streamer: MonitoredStreamer; options: { detectClips: boolean } }>
>(new Map());
const pollingHandle = ref<number | null>(null);
// isMonitoring is true if we are actively polling any streamers
const isMonitoring = computed(() => monitoredStreamers.value.size > 0);

const activityLogs = ref<ActivityLog[]>([]);
const segmentLogIds = new Map<number, string>();
let listenersInitialized = false;
const unlistenFunctions: UnlistenFn[] = [];

// Instantiate segment processing once to maintain queue state if needed
const { handleSegmentReady } = useLivestreamSegmentProcessing();

async function fetchLiveStatus(mintId: string): Promise<LiveStatus> {
  try {
    const response = await invoke<string>('check_pumpfun_livestream', { mintId });
    if (!response) {
      return { isLive: false };
    }
    const data = JSON.parse(response);
    return {
      isLive: Boolean(data?.isLive),
      streamId: data?.id,
      streamStartTimestamp: data?.streamStartTimestamp,
      numParticipants: data?.numParticipants,
      roomName: data?.roomName,
      token: data?.token,
      raw: data,
    };
  } catch (error) {
    console.warn('[LiveMonitor] Failed to check live status', error);
    return { isLive: false };
  }
}

// Helper to generate unique IDs
function generateId() {
  return crypto.randomUUID();
}

// Helper to add activity log
function addActivityLog(
  log: Omit<ActivityLog, 'id' | 'timestamp'> & Partial<Pick<ActivityLog, 'id' | 'timestamp'>>
): string {
  const id = log.id ?? generateId();
  const entry: ActivityLog = {
    id,
    timestamp:
      log.timestamp ??
      new Date().toLocaleTimeString([], {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    streamerId: log.streamerId,
    streamerName: log.streamerName,
    platform: log.platform,
    message: log.message,
    status: log.status,
    mintId: log.mintId,
    profileImageUrl: log.profileImageUrl,
    streamThumbnailUrl: log.streamThumbnailUrl,
  };

  activityLogs.value.unshift(entry);
  if (activityLogs.value.length > 100) {
    activityLogs.value.pop();
  }
  return id;
}

function updateActivityLog(id: string, updates: Partial<ActivityLog>) {
  const index = activityLogs.value.findIndex((log) => log.id === id);
  if (index !== -1) {
    activityLogs.value[index] = { ...activityLogs.value[index], ...updates };
  }
}

// Helper to resolve streamer info even if session is closed
async function getStreamerInfo(streamerId: string): Promise<{
  displayName: string;
  platform: 'PumpFun';
  profileImageUrl?: string;
}> {
  const session = activeSessions.value.get(streamerId);
  if (session) {
    return {
      displayName: session.displayName,
      platform: session.platform as 'PumpFun',
      profileImageUrl: session.profileImageUrl,
    };
  }

  // Fallback to DB lookup
  try {
    const streamer = await getMonitoredStreamer(streamerId);
    if (streamer) {
      return {
        displayName: streamer.display_name,
        platform: 'PumpFun',
        profileImageUrl: streamer.profile_image_url || undefined,
      };
    }
  } catch (e) {
    // ignore
  }

  return {
    displayName: 'Unknown',
    platform: 'PumpFun',
  };
}

// Helper to clean up empty session projects
async function cleanupSessionProject(_sessionId: string, projectId: string) {
  try {
    // Check if project is empty (no videos, no clips)
    const hasVideos = await hasRawVideosForProject(projectId);
    const hasClips = await hasClipsForProject(projectId);

    if (!hasVideos && !hasClips) {
      console.log('[LiveMonitor] Cleaning up empty session project:', projectId);
      await deleteProject(projectId);

      // Notify UI to refresh projects list
      window.dispatchEvent(new CustomEvent('refresh-clips-projects'));
    }
  } catch (error) {
    console.warn('[LiveMonitor] Failed to cleanup session project', error);
  }
}

async function handleStreamEnd(streamer: MonitoredStreamer) {
  const session = activeSessions.value.get(streamer.id);
  if (!session) return;

  try {
    await invoke('stop_livestream_recording', { mintId: streamer.mintId });
  } catch (error) {
    console.warn('[LiveMonitor] Failed to stop recorder on end', error);
  }

  try {
    await endLivestreamSession(session.sessionId, Math.floor(Date.now() / 1000));

    // Clean up the project if it's empty
    if (session.projectId) {
      await cleanupSessionProject(session.sessionId, session.projectId);
    }
  } catch (error) {
    console.warn('[LiveMonitor] Failed to mark session ended', error);
  }

  await updateMonitoredStreamer(streamer.id, {
    is_currently_live: 0,
    current_session_id: null,
  });

  const newMap = new Map(activeSessions.value);
  newMap.delete(streamer.id);
  activeSessions.value = newMap;
}

async function initializeListeners() {
  if (listenersInitialized) return;

  const segmentUnlisten = await listen<SegmentEventPayload>('segment-ready', async (event) => {
    if (!isMonitoring.value && activeSessions.value.size === 0) return;

    const payload = event.payload;
    const info = await getStreamerInfo(payload.streamerId);

    // 1. Update previous segment log
    const startingLogId = segmentLogIds.get(payload.segment);
    if (startingLogId) {
      updateActivityLog(startingLogId, {
        message: `Segment ${payload.segment} finished recording`,
        status: 'success',
      });
      segmentLogIds.delete(payload.segment);
    } else {
      // Fallback
      addActivityLog({
        streamerId: payload.streamerId,
        streamerName: info.displayName,
        platform: info.platform,
        mintId: payload.mintId,
        message: `Segment ${payload.segment} finished recording`,
        status: 'success',
        profileImageUrl: info.profileImageUrl,
      });
    }

    // 2. Log next segment starting
    // Only if session is still active, otherwise we don't expect a next segment
    if (activeSessions.value.has(payload.streamerId)) {
      const nextSegment = payload.segment + 1;
      const id = addActivityLog({
        streamerId: payload.streamerId,
        streamerName: info.displayName,
        platform: info.platform,
        mintId: payload.mintId,
        message: `Segment ${nextSegment} starting recording`,
        status: 'loading',
        profileImageUrl: info.profileImageUrl,
      });
      segmentLogIds.set(nextSegment, id);
    }

    // 3. Create log for processing status
    const processingLogId = addActivityLog({
      streamerId: payload.streamerId,
      streamerName: info.displayName,
      platform: info.platform,
      mintId: payload.mintId,
      message: `Processing Segment ${payload.segment}...`,
      status: 'loading',
      profileImageUrl: info.profileImageUrl,
    });

    // Process the segment
    const session = activeSessions.value.get(payload.streamerId);
    // Use session config for detection
    const detectClips = session?.detectClips ?? true;

    await handleSegmentReady(payload.sessionId, payload, detectClips, (status) => {
      const isSuccess = status.includes('Found') || status.includes('Detection skipped');
      const isError =
        status.toLowerCase().includes('error') || status.toLowerCase().includes('failed');

      updateActivityLog(processingLogId, {
        message: status,
        status: isSuccess ? 'success' : isError ? 'info' : 'loading',
      });
    });
  });

  const streamEndedUnlisten = await listen<{ streamerId: string; mintId: string }>(
    'stream-ended',
    async (event) => {
      const { streamerId, mintId } = event.payload;
      // Capture info before deletion if possible, or use helper
      const info = await getStreamerInfo(streamerId);

      // When stream ends, we should probably stop monitoring it if it was monitored?
      // Or keep monitoring for when it comes back online?
      // Current logic: session ends, but we might still be polling if it's in monitoredStreamers.
      // The pollStreamers loop handles "not live && sessionActive" -> handleStreamEnd
      // So we might just let pollStreamers handle the cleanup of the session object,
      // or do it here. Doing it here is faster for UI feedback.

      // If we delete from activeSessions here, pollStreamers needs to know not to try to end it again immediately.
      const session = activeSessions.value.get(streamerId);
      if (session) {
        // We let handleStreamEnd do the heavy lifting to ensure DB updates etc.
        // But if this event comes from backend, it means the recording stopped.
        // We can trigger handleStreamEnd manually.
        const streamerEntry = monitoredStreamers.value.get(streamerId);
        if (streamerEntry) {
          await handleStreamEnd(streamerEntry.streamer);
        } else {
          // If not in monitored list but has active session (e.g. zombie), clean it up
          // BUT if it is marked as stopping, we wait for recorder-exit to clean it up
          if (!session.isStopping) {
            activeSessions.value.delete(streamerId);
          }
        }
      }

      addActivityLog({
        streamerId,
        streamerName: info.displayName,
        platform: info.platform,
        mintId,
        message: 'Stream ended. Finishing final segments...',
        status: 'info',
        profileImageUrl: info.profileImageUrl,
      });
    }
  );

  const recorderLogUnlisten = await listen<{
    streamerId: string;
    mintId: string;
    message: string;
    level: string;
  }>('recorder-log', async (event) => {
    const { streamerId, mintId, message } = event.payload;

    // Filter out overly verbose messages
    if (message.includes('Encoder waiting for media')) return;
    if (message.includes('Resolution changed')) return;

    const info = await getStreamerInfo(streamerId);

    addActivityLog({
      streamerId,
      streamerName: info.displayName,
      platform: info.platform,
      mintId,
      message: message,
      status: 'info',
      profileImageUrl: info.profileImageUrl,
    });
  });

  // 4. Process terminated log
  const processExitUnlisten = await listen<{
    streamerId: string;
    mintId: string;
    code: number | null;
  }>('recorder-exit', async (event) => {
    const { streamerId, code } = event.payload;
    const session = activeSessions.value.get(streamerId);

    console.log('[LiveMonitor] Recorder exit:', event.payload, 'Session active:', !!session);

    if (code !== 0 && code !== null) {
      // Mark as failed to prevent immediate restart
      failedSessions.value.set(streamerId, Date.now());
    } else {
      failedSessions.value.delete(streamerId);
    }

    // Only if we were stopping or monitoring this session
    if (session) {
      // Force reactivity update
      const newMap = new Map(activeSessions.value);
      newMap.delete(streamerId);
      activeSessions.value = newMap;

      if (!session.isStopping) {
        // If it exited unexpectedly (crashed), we should also clean up
        console.warn('[LiveMonitor] Recorder exited unexpectedly for', streamerId);
      }
    }
  });

  unlistenFunctions.push(
    segmentUnlisten,
    streamEndedUnlisten,
    recorderLogUnlisten,
    processExitUnlisten
  );
  listenersInitialized = true;
}

export function useLivestreamMonitoring() {
  async function startMonitoring(
    streamers: MonitoredStreamer[],
    options: { detectClips: boolean } = { detectClips: true }
  ) {
    if (streamers.length === 0) {
      return;
    }

    // Initialize listeners if not already done
    await initializeListeners();

    // Add or update streamers in the monitored set
    for (const streamer of streamers) {
      monitoredStreamers.value.set(streamer.id, { streamer, options });
    }

    // Start polling if not running
    if (!pollingHandle.value) {
      await pollAllStreamers(); // Initial immediate poll
      pollingHandle.value = window.setInterval(() => {
        pollAllStreamers();
      }, POLL_INTERVAL_MS);
    } else {
      // If already polling, just poll the new ones immediately to give fast feedback
      await pollStreamers(streamers);
    }
  }

  async function stopMonitoring(streamerIds?: string[]) {
    // If no IDs provided, stop all
    const idsToStop = streamerIds ?? Array.from(monitoredStreamers.value.keys());

    // Mark sessions as stopping IMMEDIATELY before removing from monitored list
    // This ensures UI transitions to "Stopping..." instead of "Idle"
    for (const id of idsToStop) {
      const session = activeSessions.value.get(id);
      if (session) {
        activeSessions.value.set(id, { ...session, isStopping: true });
      }
    }

    // Remove from monitoring list
    for (const id of idsToStop) {
      monitoredStreamers.value.delete(id);
    }

    // If no more streamers monitored, stop polling
    if (monitoredStreamers.value.size === 0 && pollingHandle.value) {
      clearInterval(pollingHandle.value);
      pollingHandle.value = null;
    }

    // Stop active sessions for these streamers
    await Promise.all(
      idsToStop.map(async (id) => {
        const session = activeSessions.value.get(id);
        if (!session) return;

        // Schedule fallback cleanup in case recorder-exit event is missed
        setTimeout(() => {
          const currentSession = activeSessions.value.get(id);
          if (currentSession && currentSession.isStopping) {
            console.warn('[LiveMonitor] Force removing session after timeout:', id);
            const newMap = new Map(activeSessions.value);
            newMap.delete(id);
            activeSessions.value = newMap;
          }
        }, 35000); // 35 seconds (Rust process timeout is 30s)

        try {
          await invoke('stop_livestream_recording', { mintId: session.mintId });
        } catch (error) {
          console.warn('[LiveMonitor] Failed to stop recorder', error);
        }

        try {
          await endLivestreamSession(session.sessionId, Math.floor(Date.now() / 1000));

          // Clean up the project if it's empty
          if (session.projectId) {
            await cleanupSessionProject(session.sessionId, session.projectId);
          }
        } catch (error) {
          console.warn('[LiveMonitor] Failed to close session', error);
        }
      })
    );
  }

  // Polls all currently monitored streamers
  async function pollAllStreamers() {
    const streamers = Array.from(monitoredStreamers.value.values()).map((v) => v.streamer);
    await pollStreamers(streamers);
  }

  async function pollStreamers(streamers: MonitoredStreamer[]) {
    for (const streamer of streamers) {
      // Check if still monitored (in case it was removed while polling)
      const config = monitoredStreamers.value.get(streamer.id);
      if (!config) continue;

      const status = await fetchLiveStatus(streamer.mintId);
      await updateMonitoredStreamer(streamer.id, {
        last_check_timestamp: Math.floor(Date.now() / 1000),
        is_currently_live: status.isLive ? 1 : 0,
      });

      const sessionActive = activeSessions.value.has(streamer.id);

      // Check if failed recently
      const failedAt = failedSessions.value.get(streamer.id);
      if (failedAt && Date.now() - failedAt < 60_000) {
        // Skip restart if failed recently (wait 1 minute)
        continue;
      }

      if (status.isLive && !sessionActive) {
        await handleStreamStart(streamer, status, config.options);
      } else if (!status.isLive && sessionActive) {
        await handleStreamEnd(streamer);
      }
    }
  }

  async function handleStreamStart(
    streamer: MonitoredStreamer,
    status: LiveStatus,
    options: { detectClips: boolean }
  ) {
    try {
      const sessionInfo = await createLivestreamSession(
        streamer.id,
        streamer.mintId,
        streamer.displayName,
        status.streamStartTimestamp ? Math.floor(status.streamStartTimestamp / 1000) : undefined
      );

      await invoke('start_livestream_recording', {
        mintId: streamer.mintId,
        streamerId: streamer.id,
        sessionId: sessionInfo.sessionId,
      });

      activeSessions.value.set(streamer.id, {
        sessionId: sessionInfo.sessionId,
        streamerId: streamer.id,
        mintId: streamer.mintId,
        startedAt: Date.now(),
        streamStartTime: status.streamStartTimestamp || Date.now(),
        totalSegments: 0,
        processedSegments: 0,
        isRecording: true,
        projectId: sessionInfo.projectId,
        displayName: streamer.displayName,
        platform: streamer.platform,
        profileImageUrl: streamer.profileImageUrl,
        detectClips: options.detectClips,
      });

      // Add log
      addActivityLog({
        streamerId: streamer.id,
        streamerName: streamer.displayName,
        platform: streamer.platform,
        message: `Monitoring started (${options.detectClips ? 'Auto-Detect' : 'Record Only'}).`,
        status: 'success',
        mintId: streamer.mintId,
        profileImageUrl: streamer.profileImageUrl,
      });

      // Initial segment start log
      const id = addActivityLog({
        streamerId: streamer.id,
        streamerName: streamer.displayName,
        platform: streamer.platform,
        message: 'Segment 1 starting recording',
        status: 'loading',
        mintId: streamer.mintId,
        profileImageUrl: streamer.profileImageUrl,
      });
      segmentLogIds.set(1, id);
    } catch (error) {
      console.error('[LiveMonitor] Failed to start stream session', error);
      addActivityLog({
        streamerId: streamer.id,
        streamerName: streamer.displayName,
        platform: streamer.platform,
        message: 'Failed to start stream session',
        status: 'info', // Error status
      });
    }
  }

  function clearLogs() {
    activityLogs.value = [];
    segmentLogIds.clear();
  }

  return {
    startMonitoring,
    stopMonitoring,
    activeSessions,
    monitoredStreamers,
    isMonitoring,
    activityLogs,
    addActivityLog,
    clearLogs,
  };
}
