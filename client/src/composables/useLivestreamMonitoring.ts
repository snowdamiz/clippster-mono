import { ref, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  createLivestreamSession,
  endLivestreamSession,
  updateMonitoredStreamer,
  getAllMonitoredStreamers,
  getMonitoredStreamer,
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
const pollingHandle = ref<number | null>(null);
const isMonitoring = ref(false);
const monitoringOptions = ref<{ detectClips: boolean }>({ detectClips: true });
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

      activeSessions.value.delete(streamerId);

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

  unlistenFunctions.push(segmentUnlisten, streamEndedUnlisten, recorderLogUnlisten);
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

    if (pollingHandle.value) {
      clearInterval(pollingHandle.value);
      pollingHandle.value = null;
    }

    isMonitoring.value = true;
    monitoringOptions.value = options;

    // Initialize listeners if not already done
    await initializeListeners();

    await pollStreamers(streamers);

    pollingHandle.value = window.setInterval(() => {
      pollStreamers(streamers);
    }, POLL_INTERVAL_MS);
  }

  async function stopMonitoring() {
    if (pollingHandle.value) {
      clearInterval(pollingHandle.value);
      pollingHandle.value = null;
    }

    isMonitoring.value = false;

    const entries = Array.from(activeSessions.value.values());
    activeSessions.value.clear();

    await Promise.all(
      entries.map(async (session) => {
        try {
          await invoke('stop_livestream_recording', { mintId: session.mintId });
        } catch (error) {
          console.warn('[LiveMonitor] Failed to stop recorder', error);
        }

        try {
          await endLivestreamSession(session.sessionId, Math.floor(Date.now() / 1000));
        } catch (error) {
          console.warn('[LiveMonitor] Failed to close session', error);
        }
      })
    );
  }

  async function pollStreamers(streamers: MonitoredStreamer[]) {
    for (const streamer of streamers) {
      const status = await fetchLiveStatus(streamer.mintId);
      await updateMonitoredStreamer(streamer.id, {
        last_check_timestamp: Math.floor(Date.now() / 1000),
        is_currently_live: status.isLive ? 1 : 0,
      });

      const sessionActive = activeSessions.value.has(streamer.id);

      if (status.isLive && !sessionActive) {
        await handleStreamStart(streamer, status);
      } else if (!status.isLive && sessionActive) {
        await handleStreamEnd(streamer);
      }
    }
  }

  async function handleStreamStart(streamer: MonitoredStreamer, status: LiveStatus) {
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
        detectClips: monitoringOptions.value.detectClips,
      });

      // Add log
      addActivityLog({
        streamerId: streamer.id,
        streamerName: streamer.displayName,
        platform: streamer.platform,
        message: 'Monitoring started.',
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
    } catch (error) {
      console.warn('[LiveMonitor] Failed to mark session ended', error);
    }

    await updateMonitoredStreamer(streamer.id, {
      is_currently_live: 0,
      current_session_id: null,
    });

    activeSessions.value.delete(streamer.id);
  }

  function clearLogs() {
    activityLogs.value = [];
    segmentLogIds.clear();
  }

  return {
    startMonitoring,
    stopMonitoring,
    activeSessions,
    isMonitoring,
    activityLogs,
    addActivityLog,
    clearLogs,
  };
}
