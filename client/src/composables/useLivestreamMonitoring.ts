import { ref, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  createLivestreamSession,
  endLivestreamSession,
  updateMonitoredStreamer,
  getMonitoredStreamer,
  getAutoDvrStreamers,
  deleteProject,
  hasRawVideosForProject,
  hasClipsForProject,
  hasChildProjects,
  getSegmentsBySession,
} from '@/services/database';
import type {
  LiveSession,
  LiveStatus,
  MonitoredStreamer,
  ActivityLog,
  SegmentEventPayload,
  SupportedLivestreamPlatform,
} from '@/types/livestream';
import {
  checkKickLivestream,
  startKickRecording,
  stopKickRecording,
  type KickLiveStatus,
} from '@/services/kick';
import { useLivestreamSegmentProcessing } from './useLivestreamSegmentProcessing';
import { useCreditBalance } from './useCreditBalance';
import { useDvrRecording } from './useDvrRecording';
import { useToast } from './useToast';

const POLL_INTERVAL_MS = 30_000;
const AUTO_DVR_POLL_INTERVAL_MS = 60_000; // Poll Auto DVR streamers every 60 seconds

// Global State
type MonitoredStreamerEntry = { streamer: MonitoredStreamer; options: { detectClips: boolean } };
type ActiveSessionsMap = Map<string, LiveSession>;
type FailedSessionsMap = Map<string, number>;
type MonitoredStreamersMap = Map<string, MonitoredStreamerEntry>;
type DvrSessionsMap = Map<string, { mintId: string }>;

const activeSessions = ref<ActiveSessionsMap>(new Map());
const failedSessions = ref<FailedSessionsMap>(new Map()); // streamerId -> timestamp
const monitoredStreamers = ref<MonitoredStreamersMap>(new Map());
const pollingHandle = ref<number | null>(null);
// isMonitoring is true if we are actively polling any streamers
const isMonitoring = computed(() => monitoredStreamers.value.size > 0);

// Track DVR sessions for watched (but not persistently recorded) streamers
// Key: streamerId, Value: { mintId }
const dvrSessions = ref<DvrSessionsMap>(new Map());

// Auto DVR polling state
let autoDvrPollingHandle: number | null = null;
let autoDvrInitialized = false;

// Track chunk aggregation state for DVR-based auto-detect sessions
// Key: streamerId, Value: aggregation state
interface ChunkAggregationState {
  accumulatedChunks: number;
  segmentNumber: number;
  segmentStartChunk: number;
  chunksPerSegment: number;
  mintId: string;
  sessionId: string;
}
const chunkAggregationState = new Map<string, ChunkAggregationState>();

// Get the DVR recording composable instance (shared singleton)
const dvrRecording = useDvrRecording();

const activityLogs = ref<ActivityLog[]>([]);
// Key format: `${streamerId}-${segmentNumber}` to avoid collisions between streamers
const segmentLogIds = new Map<string, string>();
let listenersInitialized = false;
const unlistenFunctions: UnlistenFn[] = [];

// Instantiate segment processing once to maintain queue state if needed
const { handleSegmentReady } = useLivestreamSegmentProcessing();
const { success: showSuccess } = useToast();

function updateActiveSessionsMap(mutator: (map: ActiveSessionsMap) => void) {
  const next = new Map(activeSessions.value);
  mutator(next);
  activeSessions.value = next;
}

function updateMonitoredStreamersMap(mutator: (map: MonitoredStreamersMap) => void) {
  const next = new Map(monitoredStreamers.value);
  mutator(next);
  monitoredStreamers.value = next;
}

function updateDvrSessionsMap(mutator: (map: DvrSessionsMap) => void) {
  const next = new Map(dvrSessions.value);
  mutator(next);
  dvrSessions.value = next;
}

async function fetchPumpFunLiveStatus(mintId: string): Promise<LiveStatus> {
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
    console.warn('[LiveMonitor] Failed to check PumpFun live status', error);
    return { isLive: false };
  }
}

async function fetchKickLiveStatus(channelSlug: string): Promise<LiveStatus> {
  try {
    const kickStatus: KickLiveStatus = await checkKickLivestream(channelSlug);
    return {
      isLive: kickStatus.isLive,
      streamId: kickStatus.channelId,
      streamStartTimestamp: kickStatus.startedAt
        ? new Date(kickStatus.startedAt).getTime()
        : undefined,
      numParticipants: kickStatus.viewerCount,
      profileImageUrl: kickStatus.profileImageUrl,
      raw: kickStatus,
    };
  } catch (error) {
    console.warn('[LiveMonitor] Failed to check Kick live status', error);
    return { isLive: false };
  }
}

async function fetchLiveStatus(
  platformId: string,
  platform: SupportedLivestreamPlatform = 'PumpFun'
): Promise<LiveStatus> {
  switch (platform) {
    case 'Kick':
      return fetchKickLiveStatus(platformId);
    case 'PumpFun':
    default:
      return fetchPumpFunLiveStatus(platformId);
  }
}

async function setAutoDvr(streamerId: string, enabled: boolean) {
  await updateMonitoredStreamer(streamerId, { auto_dvr: enabled ? 1 : 0 });
  updateMonitoredStreamersMap((map) => {
    const existing = map.get(streamerId);
    if (!existing) return;
    map.set(streamerId, {
      ...existing,
      streamer: {
        ...existing.streamer,
        autoDvr: enabled,
      },
    });
  });
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
  platform: SupportedLivestreamPlatform;
  profileImageUrl?: string;
}> {
  const session = activeSessions.value.get(streamerId);
  if (session) {
    return {
      displayName: session.displayName,
      platform: session.platform,
      profileImageUrl: session.profileImageUrl,
    };
  }

  // Fallback to DB lookup
  try {
    const streamer = await getMonitoredStreamer(streamerId);
    if (streamer) {
      return {
        displayName: streamer.display_name,
        platform: (streamer.platform as SupportedLivestreamPlatform) || 'PumpFun',
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
async function cleanupSessionProject(sessionId: string, projectId: string) {
  try {
    // Check if there are any segments for this session (still being processed)
    const segments = await getSegmentsBySession(sessionId);
    if (segments.length > 0) {
      console.log('[LiveMonitor] Session has segments, skipping cleanup:', projectId);
      return;
    }

    // Check if project is empty (no videos, no clips, AND no child projects)
    const hasVideos = await hasRawVideosForProject(projectId);
    const hasClips = await hasClipsForProject(projectId);
    const hasChildren = await hasChildProjects(projectId);

    if (!hasVideos && !hasClips && !hasChildren) {
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
    // Stop platform-specific recording
    if (streamer.platform === 'Kick') {
      await stopKickRecording(streamer.mintId);
    } else {
      // PumpFun - process any remaining DVR chunks before stopping
      const state = chunkAggregationState.get(streamer.id);
      if (state && state.accumulatedChunks > 0) {
        console.log(
          `[LiveMonitor] Processing ${state.accumulatedChunks} remaining chunks for final segment`
        );

        // Get the DVR session to find the last chunk index
        const dvrSession = dvrRecording.getDvrSession(streamer.mintId);
        if (dvrSession && dvrSession.chunks.length > 0) {
          const lastChunk = dvrSession.chunks[dvrSession.chunks.length - 1];
          state.segmentNumber++;

          try {
            const DVR_CHUNK_DURATION = 4;
            const segmentPath = await invoke<string>('build_segment_from_dvr_chunks', {
              mintId: state.mintId,
              startChunk: state.segmentStartChunk,
              endChunk: lastChunk.index,
              segmentNumber: state.segmentNumber,
            });

            const actualDuration =
              (lastChunk.index - state.segmentStartChunk + 1) * DVR_CHUNK_DURATION;

            const payload: SegmentEventPayload = {
              streamerId: streamer.id,
              sessionId: state.sessionId,
              mintId: state.mintId,
              segment: state.segmentNumber,
              path: segmentPath,
              duration: actualDuration,
            };

            console.log(`[LiveMonitor] Final segment ${state.segmentNumber} built: ${segmentPath}`);
            handleDvrSegmentReady(payload);
          } catch (error) {
            console.error('[LiveMonitor] Failed to build final segment:', error);
          }
        }
      }

      // Clean up chunk aggregation state
      chunkAggregationState.delete(streamer.id);

      // Stop DVR recording
      await dvrRecording.stopDvrSession(streamer.mintId);
      // Also remove from DVR sessions tracking
      updateDvrSessionsMap((map) => {
        map.delete(streamer.id);
      });
    }
  } catch (error) {
    console.warn('[LiveMonitor] Failed to stop recorder on end', error);
  }

  try {
    await endLivestreamSession(session.sessionId, Math.floor(Date.now() / 1000));

    // Finalize the session (cleanup empty projects)
    await finalizeRecordingSession(session);
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

// Handle DVR cleanup when stream ends (for watch-only DVR sessions)
async function handleDvrStreamEnd(streamerId: string, mintId: string) {
  // Check for Kick DVR session first
  const kickSession = kickDvrSessions.value.get(streamerId);
  if (kickSession) {
    console.log('[LiveMonitor] Cleaning up Kick DVR session for', mintId);
    await stopKickDvrRecording(streamerId);

    // Also remove from general DVR sessions
    updateDvrSessionsMap((map) => {
      map.delete(streamerId);
    });
    return;
  }

  // Handle PumpFun DVR session
  const dvrSession = dvrSessions.value.get(streamerId);
  if (!dvrSession) return;

  console.log('[LiveMonitor] Cleaning up DVR session for', mintId);

  try {
    // Stop and cleanup DVR session (including temp files)
    await dvrRecording.stopDvrSession(mintId);
  } catch (error) {
    console.warn('[LiveMonitor] Failed to cleanup DVR session', error);
  }

  // Remove from DVR sessions tracking
  const newMap = new Map(dvrSessions.value);
  newMap.delete(streamerId);
  dvrSessions.value = newMap;
}

// Start DVR recording for a streamer (for watch-only DVR)
async function startDvrRecordingForStreamer(streamer: MonitoredStreamer): Promise<boolean> {
  // Don't start DVR if already has a persistent recording
  if (activeSessions.value.has(streamer.id)) {
    console.log('[LiveMonitor] Streamer has persistent recording, skipping DVR:', streamer.id);
    return false;
  }

  // Don't start if already has DVR recording
  if (dvrSessions.value.has(streamer.id)) {
    console.log('[LiveMonitor] Streamer already has DVR recording:', streamer.id);
    return true;
  }

  // For Kick streams, use yt-dlp based recording
  if (streamer.platform === 'Kick') {
    return startKickDvrRecording(streamer);
  }

  // For PumpFun, use the existing DVR recording system
  // Check if DVR session already exists (may have been started by another component)
  if (dvrRecording.isDvrSessionActive(streamer.mintId)) {
    // Track it locally
    const newMap = new Map(dvrSessions.value);
    newMap.set(streamer.id, { mintId: streamer.mintId });
    dvrSessions.value = newMap;
    console.log('[LiveMonitor] DVR already active for', streamer.mintId);
    return true;
  }

  try {
    await dvrRecording.startDvrSession(streamer.mintId, streamer.id, streamer.displayName);

    // Track the DVR session
    const newMap = new Map(dvrSessions.value);
    newMap.set(streamer.id, { mintId: streamer.mintId });
    dvrSessions.value = newMap;

    console.log('[LiveMonitor] Started DVR recording for', streamer.mintId);
    return true;
  } catch (error) {
    console.warn('[LiveMonitor] Failed to start DVR for', streamer.mintId, error);
    return false;
  }
}

// Track Kick DVR sessions separately (they use yt-dlp, not LiveKit)
// Key: streamerId, Value: { mintId, sessionId, outputDir }
type KickDvrSession = { mintId: string; sessionId: string; outputDir: string };
const kickDvrSessions = ref<Map<string, KickDvrSession>>(new Map());

// Start Kick DVR recording using yt-dlp
async function startKickDvrRecording(streamer: MonitoredStreamer): Promise<boolean> {
  // Check if already has Kick DVR recording
  if (kickDvrSessions.value.has(streamer.id)) {
    console.log('[LiveMonitor] Kick DVR already active for:', streamer.id);
    return true;
  }

  try {
    // Generate a DVR session ID
    const sessionId = `kick-dvr-${streamer.mintId}-${Date.now()}`;

    // Start yt-dlp recording via Rust backend
    await startKickRecording(
      streamer.mintId, // channel slug
      streamer.id, // streamer ID
      sessionId,
      5 // 5 minute segments (doesn't matter much for DVR)
    );

    // Get the output directory
    const outputDir = await invoke<string>('get_kick_session_output_dir', { sessionId });

    // Track the Kick DVR session
    const newMap = new Map(kickDvrSessions.value);
    newMap.set(streamer.id, { mintId: streamer.mintId, sessionId, outputDir });
    kickDvrSessions.value = newMap;

    // Also track in general DVR sessions for compatibility
    updateDvrSessionsMap((map) => {
      map.set(streamer.id, { mintId: streamer.mintId });
    });

    console.log(
      '[LiveMonitor] Started Kick DVR recording for',
      streamer.mintId,
      'output:',
      outputDir
    );
    return true;
  } catch (error) {
    console.warn('[LiveMonitor] Failed to start Kick DVR for', streamer.mintId, error);
    return false;
  }
}

// Stop Kick DVR recording
async function stopKickDvrRecording(streamerId: string): Promise<void> {
  const session = kickDvrSessions.value.get(streamerId);
  if (!session) return;

  try {
    await stopKickRecording(session.mintId);
    console.log('[LiveMonitor] Stopped Kick DVR recording for', session.mintId);
  } catch (error) {
    console.warn('[LiveMonitor] Failed to stop Kick DVR', error);
  }

  // Remove from tracking
  const newMap = new Map(kickDvrSessions.value);
  newMap.delete(streamerId);
  kickDvrSessions.value = newMap;
}

// Get Kick DVR session info
function getKickDvrSession(streamerId: string): KickDvrSession | null {
  return kickDvrSessions.value.get(streamerId) || null;
}

// Shared function to finalize a recording session (cleanup empty projects)
async function finalizeRecordingSession(session: { sessionId: string; projectId?: string }) {
  console.log('[LiveMonitor] finalizeRecordingSession called:', {
    sessionId: session.sessionId,
    projectId: session.projectId,
  });

  if (!session.projectId) {
    console.log('[LiveMonitor] No projectId, skipping finalize');
    return;
  }

  const sessionId = session.sessionId;
  const projectId = session.projectId;

  // Delay to allow final segment events to process
  setTimeout(async () => {
    console.log('[LiveMonitor] Delayed finalize starting for project:', projectId);
    await cleanupSessionProject(sessionId, projectId);
  }, 5000);
}

// Handle DVR segment ready - called directly from DVR callback (not via Tauri event)
// This processes segments the same way as the segment-ready event listener
async function handleDvrSegmentReady(payload: SegmentEventPayload) {
  if (!isMonitoring.value && activeSessions.value.size === 0) return;

  const { fetchBalance, hoursRemaining } = useCreditBalance();
  const info = await getStreamerInfo(payload.streamerId);

  // 1. Update previous segment log
  const segmentKey = `${payload.streamerId}-${payload.segment}`;
  const startingLogId = segmentLogIds.get(segmentKey);
  if (startingLogId) {
    updateActivityLog(startingLogId, {
      message: `Segment ${payload.segment} finished recording`,
      status: 'success',
    });
    segmentLogIds.delete(segmentKey);
  } else {
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
  const session = activeSessions.value.get(payload.streamerId);
  if (session && !session.isStopping) {
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
    const nextSegmentKey = `${payload.streamerId}-${nextSegment}`;
    segmentLogIds.set(nextSegmentKey, id);
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
  let detectClips = session?.detectClips ?? true;

  if (detectClips) {
    await fetchBalance();
    const balance = hoursRemaining.value;
    if (balance !== 'unlimited' && typeof balance === 'number' && balance <= 0) {
      detectClips = false;
      addActivityLog({
        streamerId: payload.streamerId,
        streamerName: info.displayName,
        platform: info.platform,
        mintId: payload.mintId,
        message: 'Detection skipped: Insufficient credits. Recording only.',
        status: 'info',
        profileImageUrl: info.profileImageUrl,
      });
    }
  }

  const promptContent = session?.promptContent;

  await handleSegmentReady(payload.sessionId, payload, detectClips, promptContent, (status: string) => {
    const normalized = status.toLowerCase();
    const isSuccess = status.includes('Found') || status.includes('Detection skipped');
    const isError = normalized.includes('error') || normalized.includes('failed');

    updateActivityLog(processingLogId, {
      message: status,
      status: isSuccess ? 'success' : isError ? 'info' : 'loading',
    });
  });
}

async function initializeListeners() {
  if (listenersInitialized) return;

  const { fetchBalance, hoursRemaining } = useCreditBalance();

  const segmentUnlisten = await listen<SegmentEventPayload>('segment-ready', async (event) => {
    if (!isMonitoring.value && activeSessions.value.size === 0) return;

    const payload = event.payload;
    const info = await getStreamerInfo(payload.streamerId);

    // 1. Update previous segment log (use streamerId-segment as key to avoid collisions)
    const segmentKey = `${payload.streamerId}-${payload.segment}`;
    const startingLogId = segmentLogIds.get(segmentKey);
    if (startingLogId) {
      updateActivityLog(startingLogId, {
        message: `Segment ${payload.segment} finished recording`,
        status: 'success',
      });
      segmentLogIds.delete(segmentKey);
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
    // Only if session is still active and NOT STOPPING, otherwise we don't expect a next segment
    const session = activeSessions.value.get(payload.streamerId);
    if (session && !session.isStopping) {
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
      const nextSegmentKey = `${payload.streamerId}-${nextSegment}`;
      segmentLogIds.set(nextSegmentKey, id);
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
    // Use session config for detection
    let detectClips = session?.detectClips ?? true;

    if (detectClips) {
      await fetchBalance();
      const balance = hoursRemaining.value;
      if (balance !== 'unlimited' && typeof balance === 'number' && balance <= 0) {
        detectClips = false;
        addActivityLog({
          streamerId: payload.streamerId,
          streamerName: info.displayName,
          platform: info.platform,
          mintId: payload.mintId,
          message: 'Detection skipped: Insufficient credits. Recording only.',
          status: 'info',
          profileImageUrl: info.profileImageUrl,
        });
      }
    }

    const promptContent = session?.promptContent;

    await handleSegmentReady(
      payload.sessionId,
      payload,
      detectClips,
      promptContent,
      (status: string) => {
        const normalized = status.toLowerCase();
        const isSuccess = status.includes('Found') || status.includes('Detection skipped');
        const isError = normalized.includes('error') || normalized.includes('failed');

        updateActivityLog(processingLogId, {
          message: status,
          status: isSuccess ? 'success' : isError ? 'info' : 'loading',
        });
      }
    );
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
    // Filter Kick recorder verbose startup messages
    if (message.includes('Starting stream capture')) return;
    if (message.includes('Starting Kick recording')) return;
    if (message.includes('Starting HLS recording')) return;
    // Filter periodic status updates (e.g., "Recording: 5 segments, 300s")
    if (message.includes('Recording:') && message.includes('segments')) return;

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

  // Handle credit exhaustion event from segment processor
  window.addEventListener('livestream-credit-exhausted', async (e: Event) => {
    const detail = (e as CustomEvent).detail;
    const { streamerId } = detail;

    const session = activeSessions.value.get(streamerId);
    const monitored = monitoredStreamers.value.get(streamerId);

    if (session) {
      // Update session state to stop trying to detect clips
      session.detectClips = false;
      activeSessions.value.set(streamerId, { ...session });

      const info = await getStreamerInfo(streamerId);

      addActivityLog({
        streamerId,
        streamerName: info.displayName,
        platform: info.platform,
        message: 'Credits exhausted. Switching to recording only.',
        status: 'info',
        profileImageUrl: info.profileImageUrl,
      });
    }

    if (monitored) {
      // Update monitored options too so it persists if stream restarts
      monitored.options.detectClips = false;
      monitoredStreamers.value.set(streamerId, monitored);
    }
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

// Export fetchLiveStatus for external use (e.g., checking live status on page load)
export { fetchLiveStatus };

export function useLivestreamMonitoring() {
  type StartOptions = {
    detectClips: boolean;
    segmentDurationMinutes?: number;
    promptId?: string;
    promptContent?: string;
  };

  async function startMonitoring(
    streamers: MonitoredStreamer[],
    options: StartOptions = { detectClips: true }
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

    // Handle Kick streamers immediately - they are skipped by regular polling
    // to avoid hitting the API too frequently, but we need to check them once on start
    const kickStreamers = streamers.filter((s) => s.platform === 'Kick');
    for (const streamer of kickStreamers) {
      const config = monitoredStreamers.value.get(streamer.id);
      if (!config) continue;

      try {
        const status = await fetchLiveStatus(streamer.mintId, 'Kick');
        await updateMonitoredStreamer(streamer.id, {
          last_check_timestamp: Math.floor(Date.now() / 1000),
          is_currently_live: status.isLive ? 1 : 0,
        });

        const sessionActive = activeSessions.value.has(streamer.id);

        if (status.isLive && !sessionActive) {
          console.log('[LiveMonitor] Kick streamer is live, starting recording:', streamer.mintId);
          await handleStreamStart(streamer, status, config.options);
        } else if (!status.isLive) {
          console.log('[LiveMonitor] Kick streamer is offline, will wait for manual refresh:', streamer.mintId);
        }
      } catch (error) {
        console.warn('[LiveMonitor] Failed to check Kick streamer status:', streamer.mintId, error);
      }
    }

    // Start polling if not running (for non-Kick streamers)
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
          // For PumpFun, stop DVR recording; for Kick, stop the Node.js recorder
          if (session.platform === 'Kick') {
            await invoke('stop_kick_recording', { channelSlug: session.mintId });
          } else {
            // PumpFun - process any remaining DVR chunks before stopping
            const state = chunkAggregationState.get(id);
            if (state && state.accumulatedChunks > 0) {
              console.log(
                `[LiveMonitor] Processing ${state.accumulatedChunks} remaining chunks for final segment`
              );

              const dvrSession = dvrRecording.getDvrSession(session.mintId);
              if (dvrSession && dvrSession.chunks.length > 0) {
                const lastChunk = dvrSession.chunks[dvrSession.chunks.length - 1];
                state.segmentNumber++;

                try {
                  const DVR_CHUNK_DURATION = 4;
                  const segmentPath = await invoke<string>('build_segment_from_dvr_chunks', {
                    mintId: state.mintId,
                    startChunk: state.segmentStartChunk,
                    endChunk: lastChunk.index,
                    segmentNumber: state.segmentNumber,
                  });

                  const actualDuration =
                    (lastChunk.index - state.segmentStartChunk + 1) * DVR_CHUNK_DURATION;

                  const payload: SegmentEventPayload = {
                    streamerId: id,
                    sessionId: state.sessionId,
                    mintId: state.mintId,
                    segment: state.segmentNumber,
                    path: segmentPath,
                    duration: actualDuration,
                  };

                  console.log(
                    `[LiveMonitor] Final segment ${state.segmentNumber} built: ${segmentPath}`
                  );
                  handleDvrSegmentReady(payload);
                } catch (error) {
                  console.error('[LiveMonitor] Failed to build final segment:', error);
                }
              }
            }

            // Clean up chunk aggregation state
            chunkAggregationState.delete(id);

            // Stop DVR recording
            await dvrRecording.stopDvrSession(session.mintId);
            // Also remove from DVR sessions tracking
            updateDvrSessionsMap((map) => {
              map.delete(id);
            });
          }
        } catch (error) {
          console.warn('[LiveMonitor] Failed to stop recorder', error);
        }

        try {
          await endLivestreamSession(session.sessionId, Math.floor(Date.now() / 1000));

          // Finalize the session (cleanup empty projects)
          await finalizeRecordingSession(session);
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

      // Skip Kick streamers - they should only be checked on manual refresh
      // to avoid hitting the API too frequently
      if (streamer.platform === 'Kick') continue;

      // Use platform-aware live status check
      const status = await fetchLiveStatus(streamer.mintId, streamer.platform);
      await updateMonitoredStreamer(streamer.id, {
        last_check_timestamp: Math.floor(Date.now() / 1000),
        is_currently_live: status.isLive ? 1 : 0,
      });

      const sessionActive = activeSessions.value.has(streamer.id);
      const hasDvrRecording = dvrSessions.value.has(streamer.id);

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

      // Auto-start DVR recording for live streamers that don't have persistent recording
      // This enables DVR for users who just want to watch (not record)
      if (status.isLive && !sessionActive && !hasDvrRecording) {
        await startDvrRecordingForStreamer(streamer);
      }

      // Cleanup DVR recording when stream ends (and no persistent session)
      if (!status.isLive && !sessionActive && hasDvrRecording) {
        await handleDvrStreamEnd(streamer.id, streamer.mintId);
      }
    }
  }

  async function handleStreamStart(streamer: MonitoredStreamer, status: LiveStatus, options: StartOptions) {
    try {
      const sessionInfo = await createLivestreamSession(
        streamer.id,
        streamer.mintId,
        streamer.displayName,
        status.streamStartTimestamp ? Math.floor(status.streamStartTimestamp / 1000) : undefined
      );

      // Use the streamer's configured segment duration, defaulting to 5 minutes
      const requestedDuration = options.segmentDurationMinutes ?? streamer.segmentDurationMinutes ?? 5;
      const segmentDuration = requestedDuration > 0 ? requestedDuration : 5;
      const isInfiniteSegment = options.segmentDurationMinutes === 0;

      // Start platform-specific recording
      if (streamer.platform === 'Kick') {
        await startKickRecording(
          streamer.mintId, // For Kick, mintId is the channel slug
          streamer.id,
          sessionInfo.sessionId,
          segmentDuration
        );
      } else {
        // PumpFun recording - use DVR-based recording for perfect A/V sync
        // The DVR system uses browser MediaRecorder which handles sync automatically
        console.log('[LiveMonitor] Starting DVR-based recording for PumpFun auto-detect');

        // DVR chunks are 4 seconds each. We need to aggregate them into longer segments
        // for clip detection. Calculate how many chunks make up one segment.
        const DVR_CHUNK_DURATION = 4; // seconds
        const segmentDurationSeconds = isInfiniteSegment ? Number.MAX_SAFE_INTEGER : segmentDuration * 60;
        const chunksPerSegment = isInfiniteSegment
          ? Number.MAX_SAFE_INTEGER
          : Math.ceil(segmentDurationSeconds / DVR_CHUNK_DURATION);

        // Initialize chunk aggregation state for this streamer
        chunkAggregationState.set(streamer.id, {
          accumulatedChunks: 0,
          segmentNumber: 0,
          segmentStartChunk: 0,
          chunksPerSegment,
          mintId: streamer.mintId,
          sessionId: sessionInfo.sessionId,
        });

        // Create callback to aggregate DVR chunks into segments
        const onChunkReady = async (
          chunk: { index: number; path: string; duration: number },
          mintId: string,
          streamerId: string,
          sessionId: string
        ) => {
          const state = chunkAggregationState.get(streamerId);
          if (!state) return;

          state.accumulatedChunks++;

          console.log(
            `[LiveMonitor] DVR chunk ${chunk.index} ready, accumulated: ${state.accumulatedChunks}/${state.chunksPerSegment}`
          );

          // Check if we have enough chunks to build a segment
          if (state.accumulatedChunks >= state.chunksPerSegment) {
            state.segmentNumber++;
            const segmentNum = state.segmentNumber;
            const startChunk = state.segmentStartChunk;
            const endChunk = chunk.index;

            // Reset state BEFORE async operation to prevent race conditions
            // New chunks arriving during build will count toward next segment
            state.segmentStartChunk = endChunk + 1;
            state.accumulatedChunks = 0;

            console.log(
              `[LiveMonitor] Building segment ${segmentNum} from chunks ${startChunk}-${endChunk}`
            );

            // Run build in background (don't await to avoid blocking chunk processing)
            (async () => {
              try {
                // Build segment file from DVR chunks using FFmpeg concat
                const segmentPath = await invoke<string>('build_segment_from_dvr_chunks', {
                  mintId,
                  startChunk,
                  endChunk,
                  segmentNumber: segmentNum,
                });

                console.log(`[LiveMonitor] Segment ${segmentNum} built: ${segmentPath}`);

                // Calculate segment duration from actual chunks used
                const actualDuration = (endChunk - startChunk + 1) * DVR_CHUNK_DURATION;

                // Emit segment-ready event
                const payload: SegmentEventPayload = {
                  streamerId,
                  sessionId,
                  mintId,
                  segment: segmentNum,
                  path: segmentPath,
                  duration: actualDuration,
                };

                // Process the segment for clip detection
                handleDvrSegmentReady(payload);
              } catch (error) {
                console.error(`[LiveMonitor] Failed to build segment ${segmentNum}:`, error);
              }
            })();
          }
        };

        // Start DVR session in background - don't await to avoid blocking UI updates
        // The DVR setup can take time and we want to show LIVE status immediately
        dvrRecording.startDvrSession(streamer.mintId, streamer.id, streamer.displayName, {
          sessionId: sessionInfo.sessionId,
          onChunkReady,
        }).catch((err) => {
          console.error('[LiveMonitor] DVR session failed to start:', err);
        });

        // Track that this is a DVR-based session
        updateDvrSessionsMap((map) => {
          map.set(streamer.id, { mintId: streamer.mintId });
        });
      }

      // Update activeSessions immediately so UI shows LIVE status
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
        segmentDurationMinutes: segmentDuration,
        promptId: options.promptId,
        promptContent: options.promptContent,
      });

      // Add log
      addActivityLog({
        streamerId: streamer.id,
        streamerName: streamer.displayName,
        platform: streamer.platform,
        message: `Stream is live! Recording started (${options.detectClips ? 'Auto-Detect' : 'Record Only'}).`,
        status: 'success',
        mintId: streamer.mintId,
        profileImageUrl: streamer.profileImageUrl,
      });

      showSuccess(
        `${streamer.displayName} is live`,
        options.detectClips ? 'Auto-detect recording started.' : 'Recording started.'
      );

      // Initial segment start log (use streamerId-1 as key)
      const id = addActivityLog({
        streamerId: streamer.id,
        streamerName: streamer.displayName,
        platform: streamer.platform,
        message: 'Segment 1 starting recording',
        status: 'loading',
        mintId: streamer.mintId,
        profileImageUrl: streamer.profileImageUrl,
      });
      segmentLogIds.set(`${streamer.id}-1`, id);
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

  // ============================================
  // Auto DVR System
  // Automatically starts DVR recording when streamers with auto_dvr=true go live
  // ============================================

  async function initAutoDvrPolling() {
    if (autoDvrInitialized) return;
    autoDvrInitialized = true;

    console.log('[LiveMonitor] Initializing Auto DVR polling system');

    // Do initial poll immediately
    await pollAutoDvrStreamers();

    // Start periodic polling
    autoDvrPollingHandle = window.setInterval(pollAutoDvrStreamers, AUTO_DVR_POLL_INTERVAL_MS);
  }

  function stopAutoDvrPolling() {
    if (autoDvrPollingHandle !== null) {
      clearInterval(autoDvrPollingHandle);
      autoDvrPollingHandle = null;
    }
    autoDvrInitialized = false;
    console.log('[LiveMonitor] Stopped Auto DVR polling');
  }

  async function pollAutoDvrStreamers() {
    try {
      // Get all streamers with auto_dvr enabled from database
      const autoDvrRecords = await getAutoDvrStreamers();

      if (autoDvrRecords.length === 0) return;

      console.log(`[LiveMonitor] Polling ${autoDvrRecords.length} Auto DVR streamers`);

      for (const record of autoDvrRecords) {
        // Skip if already has an active recording session (from Auto-Detect or Record mode)
        if (activeSessions.value.has(record.id)) continue;

        // Convert record to MonitoredStreamer type
        const streamer: MonitoredStreamer = {
          id: record.id,
          mintId: record.mint_id,
          displayName: record.display_name,
          platform: (record.platform as SupportedLivestreamPlatform) || 'PumpFun',
          lastCheckTimestamp: record.last_check_timestamp,
          isCurrentlyLive: Boolean(record.is_currently_live),
          currentSessionId: record.current_session_id,
          selected: false,
          isDetecting: false,
          profileImageUrl: record.profile_image_url || undefined,
          segmentDurationMinutes: record.segment_duration_minutes,
          autoDvr: Boolean(record.auto_dvr),
        };

        // Check if stream is live
        const status = await fetchLiveStatus(streamer.mintId, streamer.platform);

        // Update live status in database
        await updateMonitoredStreamer(streamer.id, {
          last_check_timestamp: Math.floor(Date.now() / 1000),
          is_currently_live: status.isLive ? 1 : 0,
        });

        const hasDvrRecording = dvrSessions.value.has(streamer.id);

        if (status.isLive && !hasDvrRecording) {
          // Stream is live and no DVR recording - start one
          console.log(`[LiveMonitor] Auto DVR: Starting DVR for live streamer ${streamer.displayName}`);
          const started = await startDvrRecordingForStreamer(streamer);
          if (started) {
            addActivityLog({
              streamerId: streamer.id,
              streamerName: streamer.displayName,
              platform: streamer.platform,
              mintId: streamer.mintId,
              profileImageUrl: streamer.profileImageUrl,
              message: 'Auto DVR started - streamer went live',
              status: 'success',
            });
          }
        } else if (!status.isLive && hasDvrRecording) {
          // Stream ended - stop DVR recording
          console.log(`[LiveMonitor] Auto DVR: Stopping DVR for offline streamer ${streamer.displayName}`);
          await handleDvrStreamEnd(streamer.id, streamer.mintId);
          addActivityLog({
            streamerId: streamer.id,
            streamerName: streamer.displayName,
            platform: streamer.platform,
            mintId: streamer.mintId,
            profileImageUrl: streamer.profileImageUrl,
            message: 'Auto DVR stopped - stream ended',
            status: 'info',
          });
        }
      }
    } catch (error) {
      console.error('[LiveMonitor] Auto DVR polling error:', error);
    }
  }

  return {
    startMonitoring,
    stopMonitoring,
    setAutoDvr,
    activeSessions,
    monitoredStreamers,
    isMonitoring,
    activityLogs,
    addActivityLog,
    clearLogs,
    // DVR recording exports
    dvrSessions,
    startDvrRecordingForStreamer,
    getDvrSession: (streamerId: string) => {
      const dvrInfo = dvrSessions.value.get(streamerId);
      if (!dvrInfo) return null;
      return dvrRecording.getDvrSession(dvrInfo.mintId);
    },
    hasDvrRecording: (streamerId: string) => dvrSessions.value.has(streamerId),
    // Direct access to DVR composable
    dvrRecording,
    // Kick DVR exports
    kickDvrSessions,
    getKickDvrSession,
    startKickDvrRecording,
    stopKickDvrRecording,
    // Auto DVR exports
    initAutoDvrPolling,
    stopAutoDvrPolling,
  };
}
