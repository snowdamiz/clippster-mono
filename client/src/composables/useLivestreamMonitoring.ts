import { ref, computed } from 'vue';
import { formatTime } from '@/utils/dateTimeUtils';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  createLivestreamSession,
  endLivestreamSession,
  updateMonitoredStreamer,
  getMonitoredStreamer,
  getAutoDvrStreamers,
  getPersistentLiveMonitoringStreamers,
  deleteProject,
  deleteMonitoredStreamer,
  hasRawVideosForProject,
  hasClipsForProject,
  hasChildProjects,
  getSegmentsBySession,
} from '@/services/database';
import type {
  LiveSession,
  LiveStatus,
  LivestreamMonitoringMode,
  MonitoredStreamer,
  ActivityLog,
  SegmentEventPayload,
  SupportedLivestreamPlatform,
} from '@/types/livestream';
import {
  checkKickLivestream,
  startKickRecording,
  stopKickRecording,
  stopKickRecordingSession,
  type KickLiveStatus,
} from '@/services/kick';
import {
  checkTwitchLivestream,
  startTwitchRecording,
  stopTwitchRecording,
  stopTwitchRecordingSession,
  getTwitchSessionOutputDir,
  type TwitchLiveStatus,
} from '@/services/twitch';
import {
  checkYouTubeLivestream,
  startYouTubeRecording,
  stopYouTubeRecording,
  stopYouTubeRecordingSession,
  getYouTubeSessionOutputDir,
  type YouTubeLiveStatus,
} from '@/services/youtube';
import {
  checkRumbleLivestream,
  startRumbleRecording,
  stopRumbleRecording,
  stopRumbleRecordingSession,
  getRumbleSessionOutputDir,
  type RumbleLiveStatus,
} from '@/services/rumble';
import {
  validateTwitterUrl,
  startTwitterRecording,
  stopTwitterRecording,
  stopTwitterRecordingSession,
  getTwitterSessionOutputDir,
  checkTwitterLivestream,
  isDirectTwitterLiveUrl,
  type TwitterLiveStatus,
} from '@/services/twitter';
import { checkTokendLivestream, type TokendLiveStatus } from '@/services/tokend';
import { useLivestreamSegmentProcessing } from './useLivestreamSegmentProcessing';
import { useDvrRecording } from './useDvrRecording';
import { useToast } from './useToast';

const POLL_INTERVAL_MS = 30_000;
const AUTO_DVR_POLL_INTERVAL_MS = 60_000; // Poll Auto DVR streamers every 60 seconds

// Global State
type MonitoredStreamerEntry = { streamer: MonitoredStreamer; options: StartOptions };
type ActiveSessionsMap = Map<string, LiveSession>;
type FailedSessionsMap = Map<string, number>;
type MonitoredStreamersMap = Map<string, MonitoredStreamerEntry>;
type DvrSessionsMap = Map<string, { mintId: string }>;
type ActiveViewerSession = { streamerId: string; isAtLiveEdge: boolean; isWatching: boolean };

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

// Persistent live monitoring (My Creators auto-detect / record when live)
let persistentLivePollingHandle: number | null = null;
let persistentLiveInitialized = false;
const PERSISTENT_AUTO_DETECT_MAX_MINUTES = 60;
const persistentDetectionTimers = new Map<string, number>();
/** Streamers that hit the 60-min creator-page cap for the current live session (cleared when offline). */
const persistentAutoDetectCappedForLive = new Set<string>();

let monitoringApi: {
  startMonitoring: (streamers: MonitoredStreamer[], options?: StartOptions) => Promise<void>;
  stopMonitoring: (streamerIds?: string[]) => Promise<void>;
} | null = null;

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

type StartOptions = {
  mode: LivestreamMonitoringMode;
  segmentDurationMinutes?: number;
  promptId?: string;
  promptContent?: string;
  /** Local creator profile to seed the auto-detect project's clip layout from. */
  creatorProfileId?: string;
  /** When true, persist matched creator's clip_build_defaults into active_vod_preset_config. */
  applyCreatorClipLayout?: boolean;
  /** Auto-stop realtime detection after N minutes (My Creators persistent auto-detect). */
  maxDetectionMinutes?: number;
  /** When true, this session was started from the My Creators page preference. */
  fromCreatorPage?: boolean;
};

const DEFAULT_START_OPTIONS: StartOptions = { mode: 'record' };

function isRealtimeDetectMode(mode?: LivestreamMonitoringMode): boolean {
  return mode === 'realtime-detect';
}

/** Returns true if the user is currently on the Live Streams page */
function isOnLivePage(): boolean {
  return window.location.pathname.startsWith('/live-clip');
}

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

    // Validate response is JSON before parsing (PumpFun API returns error text like "error code: 504" during outages)
    const trimmed = response.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      // Non-JSON response (likely error text), silently return offline status
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

async function fetchTwitchLiveStatus(channelName: string): Promise<LiveStatus> {
  try {
    const twitchStatus: TwitchLiveStatus = await checkTwitchLivestream(channelName);
    return {
      isLive: twitchStatus.isLive,
      streamId: twitchStatus.channelId,
      streamStartTimestamp: twitchStatus.startedAt
        ? new Date(twitchStatus.startedAt).getTime()
        : undefined,
      numParticipants: twitchStatus.viewerCount,
      profileImageUrl: twitchStatus.profileImageUrl,
      raw: twitchStatus,
    };
  } catch (error) {
    console.warn('[LiveMonitor] Failed to check Twitch live status', error);
    return { isLive: false };
  }
}

async function fetchYouTubeLiveStatus(channel: string): Promise<LiveStatus> {
  try {
    const youtubeStatus: YouTubeLiveStatus = await checkYouTubeLivestream(channel);
    return {
      isLive: youtubeStatus.isLive,
      streamId: youtubeStatus.channelId,
      streamStartTimestamp: youtubeStatus.startedAt
        ? new Date(youtubeStatus.startedAt).getTime()
        : undefined,
      numParticipants: youtubeStatus.viewerCount
        ? parseInt(youtubeStatus.viewerCount.replace(/,/g, ''))
        : undefined,
      profileImageUrl: youtubeStatus.thumbnailUrl,
      raw: youtubeStatus,
    };
  } catch (error) {
    console.warn('[LiveMonitor] Failed to check YouTube live status', error);
    return { isLive: false };
  }
}

async function fetchRumbleLiveStatus(channel: string): Promise<LiveStatus> {
  try {
    const rumbleStatus: RumbleLiveStatus = await checkRumbleLivestream(channel);
    return {
      isLive: rumbleStatus.isLive,
      streamId: rumbleStatus.channelName,
      streamStartTimestamp: rumbleStatus.startedAt
        ? new Date(rumbleStatus.startedAt).getTime()
        : undefined,
      numParticipants: rumbleStatus.viewerCount,
      profileImageUrl: rumbleStatus.thumbnailUrl,
      raw: rumbleStatus,
    };
  } catch (error) {
    console.warn('[LiveMonitor] Failed to check Rumble live status', error);
    return { isLive: false };
  }
}

async function fetchTwitterLiveStatus(urlOrUsername: string): Promise<LiveStatus> {
  try {
    const twitterStatus: TwitterLiveStatus = await checkTwitterLivestream(urlOrUsername);
    return {
      isLive: twitterStatus.isLive,
      streamId: urlOrUsername,
      streamStartTimestamp: twitterStatus.startedAt
        ? new Date(twitterStatus.startedAt).getTime()
        : undefined,
      numParticipants: twitterStatus.viewerCount,
      profileImageUrl: twitterStatus.profileImageUrl,
      raw: twitterStatus,
    };
  } catch (error) {
    console.warn('[LiveMonitor] Failed to check Twitter live status', error);
    return { isLive: false };
  }
}

async function fetchTokendLiveStatus(channelOrUrl: string): Promise<LiveStatus> {
  try {
    const status: TokendLiveStatus = await checkTokendLivestream(channelOrUrl);
    return {
      isLive: status.isLive,
      streamId: status.channelId || channelOrUrl,
      streamStartTimestamp: status.startedAt ? new Date(status.startedAt).getTime() : undefined,
      numParticipants: status.viewerCount,
      profileImageUrl: status.profileImageUrl || undefined,
      raw: status,
    };
  } catch (error) {
    console.warn('[LiveMonitor] Failed to check Tokend live status', error);
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
    case 'Twitch':
      return fetchTwitchLiveStatus(platformId);
    case 'YouTube':
      return fetchYouTubeLiveStatus(platformId);
    case 'Rumble':
      return fetchRumbleLiveStatus(platformId);
    case 'Twitter':
      return fetchTwitterLiveStatus(platformId);
    case 'Tokend':
      return fetchTokendLiveStatus(platformId);
    case 'PumpFun':
    default:
      return fetchPumpFunLiveStatus(platformId);
  }
}

function clearPersistentDetectionTimer(streamerId: string) {
  const handle = persistentDetectionTimers.get(streamerId);
  if (handle !== undefined) {
    clearTimeout(handle);
    persistentDetectionTimers.delete(streamerId);
  }
}

function schedulePersistentDetectionAutoStop(streamerId: string, maxMinutes: number) {
  clearPersistentDetectionTimer(streamerId);
  const handle = window.setTimeout(async () => {
    persistentDetectionTimers.delete(streamerId);
    persistentAutoDetectCappedForLive.add(streamerId);
    if (!monitoredStreamers.value.has(streamerId)) return;
    console.log(
      `[LiveMonitor] Persistent auto-detect reached ${maxMinutes} minute cap for streamer ${streamerId}`
    );
    try {
      const { useRealtimeClipDetection } = await import('./useRealtimeClipDetection');
      const realtimeDetection = useRealtimeClipDetection();
      if (realtimeDetection.isActive.value) {
        realtimeDetection.stopDetection();
      }
      await monitoringApi?.stopMonitoring([streamerId]);
      const streamer = await getMonitoredStreamer(streamerId);
      if (streamer) {
        addActivityLog({
          streamerId,
          streamerName: streamer.display_name,
          platform: (streamer.platform as SupportedLivestreamPlatform) || 'PumpFun',
          mintId: streamer.mint_id,
          profileImageUrl: streamer.profile_image_url || undefined,
          message: `Auto-detect stopped after ${maxMinutes} minutes — use Live Clip Auto to continue this stream`,
          status: 'info',
        });
        if (!isOnLivePage()) {
          showSuccess(
            `${streamer.display_name}: auto-detect paused`,
            `Ran for ${maxMinutes} minutes. Go to Live Clip and click Auto on this stream to detect another 60 minutes.`,
            8000,
            'livestream'
          );
        }
      }
    } catch (error) {
      console.error('[LiveMonitor] Failed to auto-stop persistent detection:', error);
    }
  }, maxMinutes * 60 * 1000);
  persistentDetectionTimers.set(streamerId, handle);
}

function recordToMonitoredStreamer(
  record: import('@/services/database').MonitoredStreamerRecord
): MonitoredStreamer {
  const platformMap: Record<string, SupportedLivestreamPlatform> = {
    pumpfun: 'PumpFun',
    kick: 'Kick',
    twitch: 'Twitch',
    youtube: 'YouTube',
    rumble: 'Rumble',
    twitter: 'Twitter',
    tokend: 'Tokend',
  };
  const platform =
    platformMap[record.platform?.toLowerCase() || 'pumpfun'] || 'PumpFun';

  return {
    id: record.id,
    mintId: record.mint_id,
    displayName: record.display_name,
    platform,
    lastCheckTimestamp: record.last_check_timestamp,
    isCurrentlyLive: Boolean(record.is_currently_live),
    currentSessionId: record.current_session_id,
    selected: false,
    isDetecting: false,
    profileImageUrl: record.profile_image_url || undefined,
    streamThumbnailUrl: record.stream_thumbnail_url || undefined,
    segmentDurationMinutes: record.segment_duration_minutes ?? 5,
    autoDvr: Boolean(record.auto_dvr),
  };
}

function buildStartOptionsFromRecord(
  record: import('@/services/database').MonitoredStreamerRecord
): StartOptions | null {
  if (Boolean(record.persistent_auto_detect)) {
    return {
      mode: 'realtime-detect',
      segmentDurationMinutes: 1,
      promptId: record.auto_detect_prompt_id || undefined,
      promptContent: record.auto_detect_prompt_content || undefined,
      creatorProfileId: record.auto_detect_creator_profile_id || undefined,
      applyCreatorClipLayout: Boolean(record.auto_detect_use_creator_layout),
      maxDetectionMinutes: PERSISTENT_AUTO_DETECT_MAX_MINUTES,
      fromCreatorPage: true,
    };
  }
  if (Boolean(record.persistent_record)) {
    return {
      mode: 'record',
      segmentDurationMinutes: record.segment_duration_minutes ?? 5,
      creatorProfileId: record.record_creator_profile_id || undefined,
      applyCreatorClipLayout: Boolean(record.record_use_creator_layout),
      fromCreatorPage: true,
    };
  }
  return null;
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
      log.timestamp ?? formatTime(new Date()),
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

  clearPersistentDetectionTimer(streamer.id);
  persistentAutoDetectCappedForLive.delete(streamer.id);

  try {
    // Stop platform-specific recording using session-specific stop
    // This ensures we only kill the auto-detect session, not any concurrent DVR viewer session
    if (streamer.platform === 'Kick') {
      await stopKickRecordingSession(session.sessionId);
    } else if (streamer.platform === 'Twitch') {
      await stopTwitchRecordingSession(session.sessionId);
    } else if (streamer.platform === 'YouTube') {
      await stopYouTubeRecordingSession(session.sessionId);
    } else if (streamer.platform === 'Rumble') {
      await stopRumbleRecordingSession(session.sessionId);
    } else if (streamer.platform === 'Twitter') {
      await stopTwitterRecordingSession(session.sessionId);
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
            await handleDvrSegmentReady(payload);
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

  // Stop realtime detection after recorder teardown/final DVR chunk processing so
  // the final partial transcript batch can be flushed and judged before save.
  if (isRealtimeDetectMode(session.mode)) {
    try {
      const { useRealtimeClipDetection } = await import('./useRealtimeClipDetection');
      const detection = useRealtimeClipDetection();
      if (detection.isActive.value) {
        await detection.stopDetection();
      }
    } catch (error) {
      console.warn('[LiveMonitor] Failed to stop realtime detection on stream end', error);
    }
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

  if (streamer.platform === 'Twitter') {
    await removeEndedTwitterBroadcast(streamer, 'recording-ended');
  }
}

// Handle DVR cleanup when stream ends (for watch-only DVR sessions)
async function handleDvrStreamEnd(streamerId: string, mintId: string) {
  // Check if user is actively watching (at any position - live edge or behind)
  // Preserve DVR so they can continue watching after stream ends
  const viewerSession = activeViewerSessions.value.get(streamerId);
  if (viewerSession && viewerSession.isWatching) {
    console.log('[LiveMonitor] User is watching, preserving DVR for:', mintId);
    return; // Don't cleanup - user is watching (they may be 20 minutes behind)
  }

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

  // Check for Twitch DVR session
  const twitchSession = twitchDvrSessions.value.get(streamerId);
  if (twitchSession) {
    console.log('[LiveMonitor] Cleaning up Twitch DVR session for', mintId);
    await stopTwitchDvrRecording(streamerId);

    // Also remove from general DVR sessions
    updateDvrSessionsMap((map) => {
      map.delete(streamerId);
    });
    return;
  }

  // Check for Twitter DVR session
  const twitterSession = twitterDvrSessions.value.get(streamerId);
  if (twitterSession) {
    console.log('[LiveMonitor] Cleaning up Twitter DVR session for', mintId);
    await stopTwitterDvrRecording(streamerId);

    // Also remove from general DVR sessions
    updateDvrSessionsMap((map) => {
      map.delete(streamerId);
    });

    const entry = monitoredStreamers.value.get(streamerId);
    if (entry) {
      await removeEndedTwitterBroadcast(entry.streamer, 'dvr-ended');
    }
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

  if (streamer.platform === 'Tokend') {
    console.log('[LiveMonitor] Tokend DVR stub — no live media until partner APIs:', streamer.id);
    return false;
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
const kickDvrSessions = ref<Map<string, { mintId: string; channelSlug: string; sessionId: string; outputDir: string }>>(new Map());

// Track Twitch DVR sessions separately (they use yt-dlp, not LiveKit)
// Key: streamerId, Value: { mintId, sessionId, outputDir }
type TwitchDvrSession = { mintId: string; sessionId: string; outputDir: string };
const twitchDvrSessions = ref<Map<string, { mintId: string; channelName: string; sessionId: string; outputDir: string }>>(new Map());

// Track Twitter DVR sessions separately (they use yt-dlp, not LiveKit)
// Key: streamerId, Value: { mintId (broadcast URL), sessionId, outputDir }
type TwitterDvrSession = { mintId: string; sessionId: string; outputDir: string };
const twitterDvrSessions = ref<Map<string, { mintId: string; broadcastUrl: string; sessionId: string; outputDir: string }>>(new Map());

// Track YouTube DVR sessions separately (they use yt-dlp, not LiveKit)
// Key: streamerId, Value: { mintId (channel ID), sessionId, outputDir }
type YouTubeDvrSession = { mintId: string; sessionId: string; outputDir: string };
const youtubeDvrSessions = ref<Map<string, { mintId: string; channelId: string; sessionId: string; outputDir: string }>>(new Map());

// Track Rumble DVR sessions separately (they use yt-dlp, not LiveKit)
// Key: streamerId, Value: { mintId (channel ID), sessionId, outputDir }
type RumbleDvrSession = { mintId: string; sessionId: string; outputDir: string };
const rumbleDvrSessions = ref<Map<string, { mintId: string; channelId: string; sessionId: string; outputDir: string }>>(new Map());

function hasAnyDvrSession(streamerId: string): boolean {
  return (
    dvrSessions.value.has(streamerId) ||
    kickDvrSessions.value.has(streamerId) ||
    twitchDvrSessions.value.has(streamerId) ||
    twitterDvrSessions.value.has(streamerId) ||
    youtubeDvrSessions.value.has(streamerId) ||
    rumbleDvrSessions.value.has(streamerId)
  );
}

async function removeEndedTwitterBroadcast(
  streamer: MonitoredStreamer,
  reason: string
): Promise<void> {
  if (streamer.platform !== 'Twitter' || !isDirectTwitterLiveUrl(streamer.mintId)) {
    return;
  }

  const viewerSession = activeViewerSessions.value.get(streamer.id);
  if (viewerSession?.isWatching) {
    return;
  }

  if (activeSessions.value.has(streamer.id) || hasAnyDvrSession(streamer.id)) {
    return;
  }

  console.log('[LiveMonitor] Removing ended Twitter broadcast:', streamer.mintId, reason);
  try {
    await deleteMonitoredStreamer(streamer.id);
    monitoredStreamers.value.delete(streamer.id);

    const twMap = new Map(twitterDvrSessions.value);
    twMap.delete(streamer.id);
    twitterDvrSessions.value = twMap;

    addActivityLog({
      streamerId: streamer.id,
      streamerName: streamer.displayName,
      platform: streamer.platform,
      mintId: streamer.mintId,
      profileImageUrl: streamer.profileImageUrl,
      message: 'X broadcast ended — removed from Live Clip (paste a new broadcast URL next time)',
      status: 'info',
    });
  } catch (error) {
    console.warn('[LiveMonitor] Failed to remove ended Twitter broadcast:', error);
  }
}

// Track active viewer sessions to prevent cleanup when user is watching
const activeViewerSessions = ref<Map<string, ActiveViewerSession>>(new Map());

// Register a viewer session (called by useLivestreamViewer when user opens a stream)
function registerViewerSession(streamerId: string, isAtLiveEdge: boolean): void {
  const newMap = new Map(activeViewerSessions.value);
  newMap.set(streamerId, { streamerId, isAtLiveEdge, isWatching: true });
  activeViewerSessions.value = newMap;
}

// Update viewer session state (called when isAtLiveEdge changes)
function updateViewerSession(streamerId: string, isAtLiveEdge: boolean): void {
  const session = activeViewerSessions.value.get(streamerId);
  if (!session) return;
  
  const newMap = new Map(activeViewerSessions.value);
  newMap.set(streamerId, { ...session, isAtLiveEdge });
  activeViewerSessions.value = newMap;
}

// Unregister a viewer session (called when user closes the viewer)
function unregisterViewerSession(streamerId: string): void {
  const newMap = new Map(activeViewerSessions.value);
  newMap.delete(streamerId);
  activeViewerSessions.value = newMap;
}

// Cleanup DVR files when streamer is deleted from Live page
async function cleanupStreamerDvr(streamerId: string, mintId: string): Promise<void> {
  console.log('[LiveMonitor] Cleaning up DVR for deleted streamer:', mintId);
  
  // Check for Kick DVR session
  const kickSession = kickDvrSessions.value.get(streamerId);
  if (kickSession) {
    await stopKickDvrRecording(streamerId);
    return;
  }
  
  // Check for Twitch DVR session
  const twitchSession = twitchDvrSessions.value.get(streamerId);
  if (twitchSession) {
    await stopTwitchDvrRecording(streamerId);
    return;
  }
  
  // Check for Twitter DVR session
  const twitterSession = twitterDvrSessions.value.get(streamerId);
  if (twitterSession) {
    await stopTwitterDvrRecording(streamerId);
    return;
  }
  
  // Check for YouTube DVR session
  const youtubeSession = youtubeDvrSessions.value.get(streamerId);
  if (youtubeSession) {
    await stopYouTubeDvrRecording(streamerId);
    return;
  }
  
  // Check for Rumble DVR session
  const rumbleSession = rumbleDvrSessions.value.get(streamerId);
  if (rumbleSession) {
    await stopRumbleDvrRecording(streamerId);
    return;
  }
  
  // Check for PumpFun DVR session
  const dvrSession = dvrSessions.value.get(streamerId);
  if (dvrSession) {
    try {
      await dvrRecording.stopDvrSession(mintId);
    } catch (error) {
      console.warn('[LiveMonitor] Failed to cleanup PumpFun DVR', error);
    }
    
    const newMap = new Map(dvrSessions.value);
    newMap.delete(streamerId);
    dvrSessions.value = newMap;
  }
}

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

    // Start yt-dlp recording via Rust backend with 4-second segments for DVR
    await startKickRecording(
      streamer.mintId, // channel slug
      streamer.id, // streamer ID
      sessionId,
      1 // 1 minute triggers 4-second segments in backend for smooth DVR playback
    );

    // Get the output directory
    const outputDir = await invoke<string>('get_kick_session_output_dir', { sessionId });

    // Track the Kick DVR session
    const newMap = new Map(kickDvrSessions.value);
    newMap.set(streamer.id, { mintId: streamer.mintId, channelSlug: streamer.mintId, sessionId, outputDir });
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
    // Use session-specific stop to avoid killing concurrent auto-detect sessions
    await stopKickRecordingSession(session.sessionId);
    console.log('[LiveMonitor] Stopped Kick DVR session:', session.sessionId);
  } catch (error) {
    console.warn('[LiveMonitor] Failed to stop Kick DVR session', error);
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

// Manually add a Kick DVR session (for temp recordings started outside monitoring)
function addKickDvrSession(streamerId: string, mintId: string, sessionId: string, outputDir: string): void {
  const newMap = new Map(kickDvrSessions.value);
  newMap.set(streamerId, { mintId, channelSlug: mintId, sessionId, outputDir });
  kickDvrSessions.value = newMap;

  // Also track in general DVR sessions for compatibility
  updateDvrSessionsMap((map) => {
    map.set(streamerId, { mintId });
  });
}

// Manually remove a Kick DVR session
function removeKickDvrSession(streamerId: string): void {
  const newMap = new Map(kickDvrSessions.value);
  newMap.delete(streamerId);
  kickDvrSessions.value = newMap;

  // Also remove from general DVR sessions
  updateDvrSessionsMap((map) => {
    map.delete(streamerId);
  });
}

// Start Twitch DVR recording using yt-dlp
async function startTwitchDvrRecording(streamer: MonitoredStreamer): Promise<boolean> {
  // Check if already has Twitch DVR recording
  if (twitchDvrSessions.value.has(streamer.id)) {
    console.log('[LiveMonitor] Twitch DVR already active for:', streamer.id);
    return true;
  }

  try {
    // Generate a DVR session ID
    const sessionId = `twitch-dvr-${streamer.mintId}-${Date.now()}`;

    // Start yt-dlp recording via Rust backend with 4-second segments for DVR
    await startTwitchRecording(
      streamer.mintId, // channel name
      streamer.id, // streamer ID
      sessionId,
      1 // 1 minute triggers 4-second segments in backend for smooth DVR playback
    );

    // Get the output directory
    const outputDir = await getTwitchSessionOutputDir(sessionId);

    // Track the Twitch DVR session
    const newMap = new Map(twitchDvrSessions.value);
    newMap.set(streamer.id, { mintId: streamer.mintId, channelName: streamer.mintId, sessionId, outputDir });
    twitchDvrSessions.value = newMap;

    // Also track in general DVR sessions for compatibility
    updateDvrSessionsMap((map) => {
      map.set(streamer.id, { mintId: streamer.mintId });
    });

    console.log(
      '[LiveMonitor] Started Twitch DVR recording for',
      streamer.mintId,
      'output:',
      outputDir
    );
    return true;
  } catch (error) {
    console.warn('[LiveMonitor] Failed to start Twitch DVR for', streamer.mintId, error);
    return false;
  }
}

// Stop Twitch DVR recording
async function stopTwitchDvrRecording(streamerId: string): Promise<void> {
  const session = twitchDvrSessions.value.get(streamerId);
  if (!session) return;

  try {
    // Use session-specific stop to avoid killing concurrent auto-detect sessions
    await stopTwitchRecordingSession(session.sessionId);
    console.log('[LiveMonitor] Stopped Twitch DVR session:', session.sessionId);
  } catch (error) {
    console.warn('[LiveMonitor] Failed to stop Twitch DVR session', error);
  }

  // Remove from tracking
  const newMap = new Map(twitchDvrSessions.value);
  newMap.delete(streamerId);
  twitchDvrSessions.value = newMap;
}

// Get Twitch DVR session info
function getTwitchDvrSession(streamerId: string): TwitchDvrSession | null {
  return twitchDvrSessions.value.get(streamerId) || null;
}

// Manually add a Twitch DVR session (for temp recordings started outside monitoring)
function addTwitchDvrSession(streamerId: string, mintId: string, sessionId: string, outputDir: string): void {
  const newMap = new Map(twitchDvrSessions.value);
  newMap.set(streamerId, { mintId, channelName: mintId, sessionId, outputDir });
  twitchDvrSessions.value = newMap;

  // Also track in general DVR sessions for compatibility
  updateDvrSessionsMap((map) => {
    map.set(streamerId, { mintId });
  });
}

// Manually remove a Twitch DVR session
function removeTwitchDvrSession(streamerId: string): void {
  const newMap = new Map(twitchDvrSessions.value);
  newMap.delete(streamerId);
  twitchDvrSessions.value = newMap;

  // Also remove from general DVR sessions
  updateDvrSessionsMap((map) => {
    map.delete(streamerId);
  });
}

// Start Twitter DVR recording using yt-dlp
async function startTwitterDvrRecording(streamer: MonitoredStreamer): Promise<boolean> {
  // Check if already has Twitter DVR recording
  if (twitterDvrSessions.value.has(streamer.id)) {
    console.log('[LiveMonitor] Twitter DVR already active for:', streamer.id);
    return true;
  }

  try {
    // Generate a DVR session ID
    const sessionId = `twitter-dvr-${Date.now()}`;

    // Start yt-dlp recording via Rust backend with 4-second segments for DVR
    await startTwitterRecording(
      streamer.mintId, // broadcast URL
      streamer.id, // streamer ID
      sessionId,
      undefined // Use default 5-minute segments (will be overridden to 4s in viewer)
    );

    // Get the output directory
    const outputDir = await getTwitterSessionOutputDir(sessionId);

    // Track the Twitter DVR session
    const newMap = new Map(twitterDvrSessions.value);
    newMap.set(streamer.id, { mintId: streamer.mintId, broadcastUrl: streamer.mintId, sessionId, outputDir });
    twitterDvrSessions.value = newMap;

    // Also track in general DVR sessions for compatibility
    updateDvrSessionsMap((map) => {
      map.set(streamer.id, { mintId: streamer.mintId });
    });

    console.log(
      '[LiveMonitor] Started Twitter DVR recording for',
      streamer.mintId,
      'output:',
      outputDir
    );
    return true;
  } catch (error) {
    console.warn('[LiveMonitor] Failed to start Twitter DVR for', streamer.mintId, error);
    return false;
  }
}

// Stop Twitter DVR recording
async function stopTwitterDvrRecording(streamerId: string): Promise<void> {
  const session = twitterDvrSessions.value.get(streamerId);
  if (!session) return;

  try {
    // Use session-specific stop to avoid killing concurrent auto-detect sessions
    await stopTwitterRecordingSession(session.sessionId);
    console.log('[LiveMonitor] Stopped Twitter DVR session:', session.sessionId);
  } catch (error) {
    console.warn('[LiveMonitor] Failed to stop Twitter DVR session', error);
  }

  // Remove from tracking
  const newMap = new Map(twitterDvrSessions.value);
  newMap.delete(streamerId);
  twitterDvrSessions.value = newMap;
}

// Get Twitter DVR session info
function getTwitterDvrSession(streamerId: string): TwitterDvrSession | null {
  return twitterDvrSessions.value.get(streamerId) || null;
}

// Manually add a Twitter DVR session (for temp recordings started outside monitoring)
function addTwitterDvrSession(streamerId: string, mintId: string, sessionId: string, outputDir: string): void {
  const newMap = new Map(twitterDvrSessions.value);
  newMap.set(streamerId, { mintId, broadcastUrl: mintId, sessionId, outputDir });
  twitterDvrSessions.value = newMap;

  // Also track in general DVR sessions for compatibility
  updateDvrSessionsMap((map) => {
    map.set(streamerId, { mintId });
  });
}

// Manually remove a Twitter DVR session
function removeTwitterDvrSession(streamerId: string): void {
  const newMap = new Map(twitterDvrSessions.value);
  newMap.delete(streamerId);
  twitterDvrSessions.value = newMap;

  // Also remove from general DVR sessions
  updateDvrSessionsMap((map) => {
    map.delete(streamerId);
  });
}

async function tryRemoveEndedTwitterBroadcastById(streamerId: string, reason: string): Promise<void> {
  const entry = monitoredStreamers.value.get(streamerId);
  if (entry) {
    await removeEndedTwitterBroadcast(entry.streamer, reason);
    return;
  }

  try {
    const fromDb = await getMonitoredStreamer(streamerId);
    if (fromDb) {
      const platformMap: Record<string, MonitoredStreamer['platform']> = {
        pumpfun: 'PumpFun',
        kick: 'Kick',
        twitch: 'Twitch',
        youtube: 'YouTube',
        rumble: 'Rumble',
        twitter: 'Twitter',
        tokend: 'Tokend',
      };
      const streamer: MonitoredStreamer = {
        id: fromDb.id,
        mintId: fromDb.mint_id,
        displayName: fromDb.display_name,
        platform: platformMap[fromDb.platform.toLowerCase()] || 'Twitter',
        lastCheckTimestamp: fromDb.last_check_timestamp,
        isCurrentlyLive: Boolean(fromDb.is_currently_live),
        currentSessionId: fromDb.current_session_id,
        selected: false,
        isDetecting: false,
        profileImageUrl: fromDb.profile_image_url || undefined,
        streamThumbnailUrl: fromDb.stream_thumbnail_url || undefined,
        segmentDurationMinutes: fromDb.segment_duration_minutes,
        autoDvr: Boolean(fromDb.auto_dvr),
      };
      await removeEndedTwitterBroadcast(streamer, reason);
    }
  } catch (error) {
    console.warn('[LiveMonitor] Failed to load streamer for Twitter cleanup:', error);
  }
}

// Start YouTube DVR recording using yt-dlp
async function startYouTubeDvrRecording(streamer: MonitoredStreamer): Promise<boolean> {
  // Check if already has YouTube DVR recording
  if (youtubeDvrSessions.value.has(streamer.id)) {
    console.log('[LiveMonitor] YouTube DVR already active for:', streamer.id);
    return true;
  }

  try {
    // Generate a DVR session ID
    const sessionId = `youtube-dvr-${streamer.mintId}-${Date.now()}`;

    // Start yt-dlp recording via Rust backend with 4-second segments for DVR
    const { startYouTubeRecording, getYouTubeSessionOutputDir } = await import('@/services/youtube');
    await startYouTubeRecording(
      streamer.mintId, // channel ID
      streamer.id, // streamer ID
      sessionId,
      1 // 1 minute triggers 4-second segments in backend for smooth DVR playback
    );

    // Get the output directory
    const outputDir = await getYouTubeSessionOutputDir(sessionId);

    // Track the YouTube DVR session
    const newMap = new Map(youtubeDvrSessions.value);
    newMap.set(streamer.id, { mintId: streamer.mintId, channelId: streamer.mintId, sessionId, outputDir });
    youtubeDvrSessions.value = newMap;

    // Also track in general DVR sessions for compatibility
    updateDvrSessionsMap((map) => {
      map.set(streamer.id, { mintId: streamer.mintId });
    });

    console.log(
      '[LiveMonitor] Started YouTube DVR recording for',
      streamer.mintId,
      'output:',
      outputDir
    );
    return true;
  } catch (error) {
    console.warn('[LiveMonitor] Failed to start YouTube DVR for', streamer.mintId, error);
    return false;
  }
}

// Stop YouTube DVR recording
async function stopYouTubeDvrRecording(streamerId: string): Promise<void> {
  const session = youtubeDvrSessions.value.get(streamerId);
  if (!session) return;

  try {
    // Use session-specific stop to avoid killing concurrent auto-detect sessions
    const { stopYouTubeRecordingSession } = await import('@/services/youtube');
    await stopYouTubeRecordingSession(session.sessionId);
    console.log('[LiveMonitor] Stopped YouTube DVR session:', session.sessionId);
  } catch (error) {
    console.warn('[LiveMonitor] Failed to stop YouTube DVR session', error);
  }

  // Remove from tracking
  const newMap = new Map(youtubeDvrSessions.value);
  newMap.delete(streamerId);
  youtubeDvrSessions.value = newMap;
}

// Get YouTube DVR session info
function getYouTubeDvrSession(streamerId: string): YouTubeDvrSession | null {
  return youtubeDvrSessions.value.get(streamerId) || null;
}

// Manually add a YouTube DVR session (for temp recordings started outside monitoring)
function addYouTubeDvrSession(streamerId: string, mintId: string, sessionId: string, outputDir: string): void {
  const newMap = new Map(youtubeDvrSessions.value);
  newMap.set(streamerId, { mintId, channelId: mintId, sessionId, outputDir });
  youtubeDvrSessions.value = newMap;

  // Also track in general DVR sessions for compatibility
  updateDvrSessionsMap((map) => {
    map.set(streamerId, { mintId });
  });
}

// Manually remove a YouTube DVR session
function removeYouTubeDvrSession(streamerId: string): void {
  const newMap = new Map(youtubeDvrSessions.value);
  newMap.delete(streamerId);
  youtubeDvrSessions.value = newMap;

  // Also remove from general DVR sessions
  updateDvrSessionsMap((map) => {
    map.delete(streamerId);
  });
}

// Start Rumble DVR recording using yt-dlp
async function startRumbleDvrRecording(streamer: MonitoredStreamer): Promise<boolean> {
  // Check if already has Rumble DVR recording
  if (rumbleDvrSessions.value.has(streamer.id)) {
    console.log('[LiveMonitor] Rumble DVR already active for:', streamer.id);
    return true;
  }

  try {
    // Generate a DVR session ID
    const sessionId = `rumble-dvr-${streamer.mintId}-${Date.now()}`;

    // Start yt-dlp recording via Rust backend with 4-second segments for DVR
    const { startRumbleRecording, getRumbleSessionOutputDir } = await import('@/services/rumble');
    await startRumbleRecording(
      streamer.mintId, // channel ID
      streamer.id, // streamer ID
      sessionId,
      1 // 1 minute triggers 4-second segments in backend for smooth DVR playback
    );

    // Get the output directory
    const outputDir = await getRumbleSessionOutputDir(sessionId);

    // Track the Rumble DVR session
    const newMap = new Map(rumbleDvrSessions.value);
    newMap.set(streamer.id, { mintId: streamer.mintId, channelId: streamer.mintId, sessionId, outputDir });
    rumbleDvrSessions.value = newMap;

    // Also track in general DVR sessions for compatibility
    updateDvrSessionsMap((map) => {
      map.set(streamer.id, { mintId: streamer.mintId });
    });

    console.log(
      '[LiveMonitor] Started Rumble DVR recording for',
      streamer.mintId,
      'output:',
      outputDir
    );
    return true;
  } catch (error) {
    console.warn('[LiveMonitor] Failed to start Rumble DVR for', streamer.mintId, error);
    return false;
  }
}

// Stop Rumble DVR recording
async function stopRumbleDvrRecording(streamerId: string): Promise<void> {
  const session = rumbleDvrSessions.value.get(streamerId);
  if (!session) return;

  try {
    // Use session-specific stop to avoid killing concurrent auto-detect sessions
    const { stopRumbleRecordingSession } = await import('@/services/rumble');
    await stopRumbleRecordingSession(session.sessionId);
    console.log('[LiveMonitor] Stopped Rumble DVR session:', session.sessionId);
  } catch (error) {
    console.warn('[LiveMonitor] Failed to stop Rumble DVR session', error);
  }

  // Remove from tracking
  const newMap = new Map(rumbleDvrSessions.value);
  newMap.delete(streamerId);
  rumbleDvrSessions.value = newMap;
}

// Get Rumble DVR session info
function getRumbleDvrSession(streamerId: string): RumbleDvrSession | null {
  return rumbleDvrSessions.value.get(streamerId) || null;
}

// Manually add a Rumble DVR session (for temp recordings started outside monitoring)
function addRumbleDvrSession(streamerId: string, mintId: string, sessionId: string, outputDir: string): void {
  const newMap = new Map(rumbleDvrSessions.value);
  newMap.set(streamerId, { mintId, channelId: mintId, sessionId, outputDir });
  rumbleDvrSessions.value = newMap;

  // Also track in general DVR sessions for compatibility
  updateDvrSessionsMap((map) => {
    map.set(streamerId, { mintId });
  });
}

// Manually remove a Rumble DVR session
function removeRumbleDvrSession(streamerId: string): void {
  const newMap = new Map(rumbleDvrSessions.value);
  newMap.delete(streamerId);
  rumbleDvrSessions.value = newMap;

  // Also remove from general DVR sessions
  updateDvrSessionsMap((map) => {
    map.delete(streamerId);
  });
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

async function trackRealtimeSegment(
  activeSession: LiveSession,
  payload: SegmentEventPayload,
  queueTranscript = false
) {
  if (!activeSession.segments) {
    activeSession.segments = [];
  }

  const duration = payload.duration || 4;
  const previousSegment = activeSession.segments[activeSession.segments.length - 1];
  const startTime = previousSegment?.endTime ?? 0;
  const newSegment = {
    segmentNumber: payload.segment,
    filePath: payload.path,
    startTime,
    duration,
    endTime: startTime + duration,
  };

  activeSession.segments.push(newSegment);

  const { useRealtimeClipDetection } = await import('./useRealtimeClipDetection');
  const detection = useRealtimeClipDetection();
  if (detection.isActive.value) {
    detection.updateSegments(activeSession.segments || []);
  }

  if (queueTranscript) {
    const { useRealtimeTranscription } = await import('./useRealtimeTranscription');
    await useRealtimeTranscription().queueSegment({
      ...payload,
      duration,
      streamTime: newSegment.startTime,
    });
  }
}

// Handle DVR segment ready - called directly from DVR callback (not via Tauri event)
// This processes segments silently since it's internal chunk aggregation for PumpFun.
async function handleDvrSegmentReady(payload: SegmentEventPayload) {
  if (!isMonitoring.value && activeSessions.value.size === 0) return;

  const session = activeSessions.value.get(payload.streamerId);
  if (!session) return;

  if (isRealtimeDetectMode(session.mode)) {
    await trackRealtimeSegment(session, payload, true);
    return;
  }

  await handleSegmentReady(payload.sessionId, payload);
}

async function initializeListeners() {
  if (listenersInitialized) return;

  const segmentUnlisten = await listen<SegmentEventPayload>('segment-ready', async (event) => {
    if (!isMonitoring.value && activeSessions.value.size === 0) return;

    const payload = event.payload;

    // CRITICAL: Only process segments that belong to an active auto-detect session.
    // DVR viewer sessions (4-sec segments) have different session IDs (e.g., kick-dvr-*, kick-view-*)
    // that won't match any activeSessions entry. Without this filter, DVR segments would
    // leak into the auto-detect clip detection pipeline.
    const activeSession = activeSessions.value.get(payload.streamerId);
    if (!activeSession || activeSession.sessionId !== payload.sessionId) {
      // This segment belongs to a DVR/viewer session, not an auto-detect session - skip it
      return;
    }

    console.log('[LiveMonitor] segment-ready - mode:', activeSession.mode);
    if (isRealtimeDetectMode(activeSession.mode)) {
      console.log('[LiveMonitor] Real-time detection mode - tracking segment for clip extraction');
      await trackRealtimeSegment(activeSession, payload);
      return;
    }

    const info = await getStreamerInfo(payload.streamerId);

    // 1. Update previous segment log (use streamerId-segment as key to avoid collisions)
    const segmentKey = `${payload.streamerId}-${payload.segment}`;
    const startingLogId = segmentLogIds.get(segmentKey);
    if (startingLogId) {
      updateActivityLog(startingLogId, {
        message: `Segment ${payload.segment} finished`,
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
        message: `Segment ${payload.segment} finished`,
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
        message: `Segment ${nextSegment} started`,
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
      message: `Processing segment...`,
      status: 'loading',
      profileImageUrl: info.profileImageUrl,
    });

    await handleSegmentReady(
      payload.sessionId,
      payload,
      (status: string) => {
        const normalized = status.toLowerCase();
        const isSuccess = normalized.includes('recorded') || normalized.includes('completed');
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
        const streamerEntry = monitoredStreamers.value.get(streamerId);
        if (streamerEntry) {
          await handleStreamEnd(streamerEntry.streamer);
        } else {
          if (!session.isStopping) {
            const newMap = new Map(activeSessions.value);
            newMap.delete(streamerId);
            activeSessions.value = newMap;
          }
          if (twitterDvrSessions.value.has(streamerId)) {
            await stopTwitterDvrRecording(streamerId);
          }
          await tryRemoveEndedTwitterBroadcastById(streamerId, 'stream-ended');
        }
      } else if (twitterDvrSessions.value.has(streamerId)) {
        await stopTwitterDvrRecording(streamerId);
        await tryRemoveEndedTwitterBroadcastById(streamerId, 'stream-ended');
      }

      addActivityLog({
        streamerId,
        streamerName: info.displayName,
        platform: info.platform,
        mintId,
        message: 'Stream ended',
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

    // Skip ALL recorder logs when in real-time detection mode
    const session = activeSessions.value.get(streamerId);
    if (session && isRealtimeDetectMode(session.mode)) {
      return;
    }

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
  async function startMonitoring(
    streamers: MonitoredStreamer[],
    options: StartOptions = DEFAULT_START_OPTIONS
  ) {
    if (streamers.length === 0) {
      return;
    }

    // Initialize listeners if not already done
    await initializeListeners();

    // Add or update streamers in the monitored set
    for (const streamer of streamers) {
      monitoredStreamers.value.set(streamer.id, { streamer, options: { ...DEFAULT_START_OPTIONS, ...options } });
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
      clearPersistentDetectionTimer(id);
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
          // Stop platform-specific recording using session-specific stop
          // This ensures we only kill the auto-detect session, not any concurrent DVR viewer session
          if (session.platform === 'Kick') {
            await stopKickRecordingSession(session.sessionId);
          } else if (session.platform === 'Twitch') {
            await stopTwitchRecordingSession(session.sessionId);
          } else if (session.platform === 'YouTube') {
            await stopYouTubeRecordingSession(session.sessionId);
          } else if (session.platform === 'Rumble') {
            await stopRumbleRecordingSession(session.sessionId);
          } else if (session.platform === 'Twitter') {
            await stopTwitterRecordingSession(session.sessionId);
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
                  await handleDvrSegmentReady(payload);
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

        if (isRealtimeDetectMode(session.mode)) {
          try {
            const { useRealtimeClipDetection } = await import('./useRealtimeClipDetection');
            const detection = useRealtimeClipDetection();
            if (detection.isActive.value) {
              await detection.stopDetection();
            }
          } catch (error) {
            console.warn('[LiveMonitor] Failed to stop realtime detection', error);
          }
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

      // Use platform-aware live status check
      const status = await fetchLiveStatus(streamer.mintId, streamer.platform);
      const streamerUpdates: Record<string, any> = {
        last_check_timestamp: Math.floor(Date.now() / 1000),
        is_currently_live: status.isLive ? 1 : 0,
      };
      // Persist profile image if we got one and the streamer doesn't have one yet
      if (status.profileImageUrl && !streamer.profileImageUrl) {
        streamerUpdates.profile_image_url = status.profileImageUrl;
        streamer.profileImageUrl = status.profileImageUrl;
      }
      await updateMonitoredStreamer(streamer.id, streamerUpdates);

      const sessionActive = activeSessions.value.has(streamer.id);
      const hasDvrRecording = hasAnyDvrSession(streamer.id);

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
      if (status.isLive && !sessionActive && !hasDvrRecording && streamer.platform !== 'Tokend') {
        await startDvrRecordingForStreamer(streamer);
      }

      // Cleanup DVR recording when stream ends (and no persistent session)
      if (!status.isLive && !sessionActive && hasDvrRecording) {
        await handleDvrStreamEnd(streamer.id, streamer.mintId);
      } else if (!status.isLive && !sessionActive && streamer.platform === 'Twitter') {
        await removeEndedTwitterBroadcast(streamer, 'stream-offline');
      }
    }
  }

  async function handleStreamStart(streamer: MonitoredStreamer, status: LiveStatus, options: StartOptions) {
    try {
      if (streamer.platform === 'Tokend') {
        console.log(
          '[LiveMonitor] Tokend live media stub — status monitoring only until partner APIs'
        );
        addActivityLog({
          streamerId: streamer.id,
          streamerName: streamer.displayName,
          platform: streamer.platform,
          mintId: streamer.mintId,
          message:
            'Tokend Watch/DVR is not available yet. Channel stays monitored for live status only.',
          status: 'info',
          profileImageUrl: streamer.profileImageUrl,
        });
        if (!isOnLivePage()) {
          showSuccess(
            `${streamer.displayName} is live on Tokend`,
            'Recording/DVR unlocks when Tokend partner live media APIs ship.',
            undefined,
            'livestream'
          );
        }
        return;
      }

      // Note: "Streamer went live" toast is handled by global polling system
      // This function is called for both automatic detection and manual user actions
      
      // Allow temp viewer sessions (4-sec segments) and persistent auto-detect sessions (5-min segments)
      // to coexist. They write to different directories and serve different purposes:
      // - Viewer sessions: smooth scrubbing for watching
      // - Auto-detect sessions: efficient clip detection
      
      const sessionInfo = await createLivestreamSession(
        streamer.id,
        streamer.mintId,
        streamer.displayName,
        status.streamStartTimestamp ? Math.floor(status.streamStartTimestamp / 1000) : undefined,
        streamer.platform
      );

      const realtimeMode = isRealtimeDetectMode(options.mode);

      // Record-mode parity with the VOD download flow's "Use creator layout":
      // when the user opted in via the record dialog, seed the recording
      // project's `active_vod_preset_config` from the matched creator profile's
      // `clip_build_defaults` so manual clips built from this session inherit
      // the framing/subtitle defaults. Realtime mode has its own dedicated
      // auto-clip project that's seeded inside useRealtimeClipDetection, so we
      // skip the recording project there to avoid clobbering an existing
      // parent project that's reused across multiple sessions per day.
      if (
        !realtimeMode &&
        options.applyCreatorClipLayout &&
        options.creatorProfileId
      ) {
        try {
          const { seedCreatorClipLayoutOnProject } = await import(
            './useCreatorClipDefaults'
          );
          await seedCreatorClipLayoutOnProject(
            sessionInfo.projectId,
            options.creatorProfileId,
            true
          );
        } catch (err) {
          console.warn(
            '[LiveMonitor] Failed to seed creator clip layout on recording project:',
            err
          );
        }
      }
      // Realtime detection consumes short recording chunks and makes one AI decision
      // per Whisper batch. Record-only can keep the user's configured segment size.
      const requestedDuration = realtimeMode
        ? 1
        : (options.segmentDurationMinutes ?? streamer.segmentDurationMinutes ?? 5);
      const segmentDuration = requestedDuration > 0 ? requestedDuration : 5;
      const isInfiniteSegment = options.segmentDurationMinutes === 0;

      // CRITICAL: Add to activeSessions IMMEDIATELY after getting sessionInfo
      // This prevents race conditions where viewer checks for existing sessions
      // before they're tracked, which would cause both to use the same session ID
      console.log('[LiveMonitor] Creating session with mode:', options.mode);
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
        mode: options.mode,
        segmentDurationMinutes: segmentDuration,
        promptId: options.promptId,
        promptContent: options.promptContent,
      });

      // Start platform-specific recording
      if (streamer.platform === 'Kick') {
        await startKickRecording(
          streamer.mintId, // For Kick, mintId is the channel slug
          streamer.id,
          sessionInfo.sessionId,
          segmentDuration
        );
      } else if (streamer.platform === 'Twitch') {
        // Twitch recording - use yt-dlp/FFmpeg HLS (same approach as Kick)
        // Segments are emitted via 'segment-ready' Tauri event from the Rust backend
        console.log('[LiveMonitor] Starting Twitch recording via yt-dlp/FFmpeg');
        await startTwitchRecording(
          streamer.mintId, // For Twitch, mintId is the channel name
          streamer.id,
          sessionInfo.sessionId,
          segmentDuration
        );
      } else if (streamer.platform === 'YouTube') {
        console.log('[LiveMonitor] Starting YouTube recording via yt-dlp/FFmpeg');
        await startYouTubeRecording(
          streamer.mintId, // For YouTube, mintId is the channel ID or handle
          streamer.id,
          sessionInfo.sessionId,
          segmentDuration
        );
      } else if (streamer.platform === 'Rumble') {
        console.log('[LiveMonitor] Starting Rumble recording via yt-dlp/FFmpeg');
        await startRumbleRecording(
          streamer.mintId, // For Rumble, mintId is the channel name
          streamer.id,
          sessionInfo.sessionId,
          segmentDuration
        );
      } else if (streamer.platform === 'Twitter') {
        console.log('[LiveMonitor] Starting Twitter recording via yt-dlp/FFmpeg');
        // For Twitter, mintId should be the broadcast/Space URL
        await startTwitterRecording(
          streamer.mintId, // For Twitter, mintId is the broadcast/Space URL
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
        const chunksPerSegment = realtimeMode
          ? 1
          : isInfiniteSegment
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

      if (realtimeMode) {
        try {
          const { useRealtimeClipDetection } = await import('./useRealtimeClipDetection');
          const detection = useRealtimeClipDetection();
          await detection.startDetection({
            sessionId: sessionInfo.sessionId,
            streamerName: streamer.displayName,
            platform: streamer.platform,
            mintId: streamer.mintId,
            prompt: options.promptContent || 'Detect viral moments',
            segments: activeSessions.value.get(streamer.id)?.segments || [],
            creatorProfileId: options.creatorProfileId,
            applyCreatorClipLayout: options.applyCreatorClipLayout,
          });

          addActivityLog({
            streamerId: streamer.id,
            streamerName: streamer.displayName,
            platform: streamer.platform,
            mintId: streamer.mintId,
            message: 'Real-time clip detection started',
            status: 'success',
            profileImageUrl: streamer.profileImageUrl,
          });

          if (options.maxDetectionMinutes && options.maxDetectionMinutes > 0) {
            schedulePersistentDetectionAutoStop(streamer.id, options.maxDetectionMinutes);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error('[LiveMonitor] Failed to start real-time detection', error);
          addActivityLog({
            streamerId: streamer.id,
            streamerName: streamer.displayName,
            platform: streamer.platform,
            mintId: streamer.mintId,
            message: `Real-time detection failed to start: ${message}`,
            status: 'info',
            profileImageUrl: streamer.profileImageUrl,
          });
        }
      } else {
        addActivityLog({
          streamerId: streamer.id,
          streamerName: streamer.displayName,
          platform: streamer.platform,
          mintId: streamer.mintId,
          message: 'Stream is live - Recording started',
          status: 'success',
          profileImageUrl: streamer.profileImageUrl,
        });
      }

      if (!isOnLivePage()) {
        showSuccess(
          `${streamer.displayName} is live`,
          realtimeMode ? 'Auto-detect recording started.' : 'Recording started.',
          undefined,
          'livestream'
        );
      }

      // Initial segment start log (use streamerId-1 as key)
      const id = addActivityLog({
        streamerId: streamer.id,
        streamerName: streamer.displayName,
        platform: streamer.platform,
        mintId: streamer.mintId,
        message: 'Segment 1 started',
        status: 'loading',
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

        const hasDvrRecording = hasAnyDvrSession(streamer.id);

        if (status.isLive && !hasDvrRecording) {
          // Stream is live and no DVR recording - start one
          console.log(`[LiveMonitor] Auto DVR: Starting DVR for live streamer ${streamer.displayName}`);
          
          // Show toast notification that streamer went live (skip on Live page)
          if (!isOnLivePage()) {
            showSuccess(`${streamer.displayName} is now live!`, undefined, 7000, 'livestream');
          }
          
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
        } else if (!status.isLive && streamer.platform === 'Twitter') {
          await removeEndedTwitterBroadcast(streamer, 'auto-dvr-offline');
        }
      }
    } catch (error) {
      console.error('[LiveMonitor] Auto DVR polling error:', error);
    }
  }

  // ============================================
  // Persistent live monitoring (My Creators)
  // Auto-starts record / auto-detect when streamers go live
  // ============================================

  async function pollPersistentLiveMonitoring() {
    try {
      const records = await getPersistentLiveMonitoringStreamers();
      if (records.length === 0) return;

      for (const record of records) {
        if (activeSessions.value.has(record.id)) continue;
        if (monitoredStreamers.value.has(record.id)) continue;

        const options = buildStartOptionsFromRecord(record);
        if (!options) continue;

        const streamer = recordToMonitoredStreamer(record);
        const status = await fetchLiveStatus(streamer.mintId, streamer.platform);

        await updateMonitoredStreamer(streamer.id, {
          last_check_timestamp: Math.floor(Date.now() / 1000),
          is_currently_live: status.isLive ? 1 : 0,
        });

        if (!status.isLive) {
          persistentAutoDetectCappedForLive.delete(record.id);
          continue;
        }

        if (
          options.mode === 'realtime-detect' &&
          persistentAutoDetectCappedForLive.has(record.id)
        ) {
          continue;
        }

        const { useRealtimeClipDetection } = await import('./useRealtimeClipDetection');
        const realtimeDetection = useRealtimeClipDetection();
        if (
          options.mode === 'realtime-detect' &&
          realtimeDetection.isActive.value
        ) {
          continue;
        }

        console.log(
          `[LiveMonitor] Persistent ${options.mode}: starting for live streamer ${streamer.displayName}`
        );

        if (!isOnLivePage()) {
          const label = options.mode === 'realtime-detect' ? 'Auto-detect' : 'Recording';
          showSuccess(
            `${streamer.displayName} is live`,
            `${label} started from your My Creators settings.`,
            7000,
            'livestream'
          );
        }

        await startMonitoring([streamer], options);
      }
    } catch (error) {
      console.error('[LiveMonitor] Persistent live monitoring polling error:', error);
    }
  }

  async function initPersistentLiveMonitoringPolling() {
    if (persistentLiveInitialized) return;
    persistentLiveInitialized = true;

    console.log('[LiveMonitor] Initializing persistent live monitoring polling');
    await pollPersistentLiveMonitoring();
    persistentLivePollingHandle = window.setInterval(
      pollPersistentLiveMonitoring,
      AUTO_DVR_POLL_INTERVAL_MS
    );
  }

  function stopPersistentLiveMonitoringPolling() {
    if (persistentLivePollingHandle !== null) {
      clearInterval(persistentLivePollingHandle);
      persistentLivePollingHandle = null;
    }
    persistentLiveInitialized = false;
  }

  monitoringApi = { startMonitoring, stopMonitoring };

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
    hasDvrRecording: (streamerId: string) => hasAnyDvrSession(streamerId),
    // Direct access to DVR composable
    dvrRecording,
    // Kick DVR exports
    kickDvrSessions,
    getKickDvrSession,
    startKickDvrRecording,
    stopKickDvrRecording,
    addKickDvrSession,
    removeKickDvrSession,
    // Twitch DVR exports
    twitchDvrSessions,
    getTwitchDvrSession,
    startTwitchDvrRecording,
    stopTwitchDvrRecording,
    addTwitchDvrSession,
    removeTwitchDvrSession,
    // Twitter DVR exports
    twitterDvrSessions,
    getTwitterDvrSession,
    startTwitterDvrRecording,
    stopTwitterDvrRecording,
    addTwitterDvrSession,
    removeTwitterDvrSession,
    tryRemoveEndedTwitterBroadcastById,
    // YouTube DVR exports
    youtubeDvrSessions,
    getYouTubeDvrSession,
    startYouTubeDvrRecording,
    stopYouTubeDvrRecording,
    addYouTubeDvrSession,
    removeYouTubeDvrSession,
    // Rumble DVR exports
    rumbleDvrSessions,
    getRumbleDvrSession,
    startRumbleDvrRecording,
    stopRumbleDvrRecording,
    addRumbleDvrSession,
    removeRumbleDvrSession,
    // Auto DVR exports
    initAutoDvrPolling,
    stopAutoDvrPolling,
    // Persistent My Creators live monitoring
    initPersistentLiveMonitoringPolling,
    stopPersistentLiveMonitoringPolling,
    // Viewer session tracking exports
    registerViewerSession,
    updateViewerSession,
    unregisterViewerSession,
    // DVR cleanup export
    cleanupStreamerDvr,
  };
}

// Global live status polling state (outside composable scope)
let globalLiveStatusInterval: number | null = null;
let globalLiveStatusInitialized = false;
let isInitialPoll = true; // Track if this is the first poll after app startup

/**
 * Initialize global live status polling for all monitored streamers.
 * This runs on app startup and checks live status every 60 seconds,
 * showing toast notifications when streamers go live.
 * 
 * This is separate from the monitoring system (Auto-Detect/Record) and
 * ensures users get notifications for ALL streamers in their list.
 */
/** Start background polling for My Creators persistent auto-detect / record. */
export async function initPersistentLiveMonitoringPolling(): Promise<void> {
  const monitoring = useLivestreamMonitoring();
  await monitoring.initPersistentLiveMonitoringPolling();
}

export function stopPersistentLiveMonitoringPolling(): void {
  useLivestreamMonitoring().stopPersistentLiveMonitoringPolling();
}

export async function initGlobalLiveStatusPolling(): Promise<void> {
  if (globalLiveStatusInitialized) {
    console.log('[GlobalLiveStatus] Already initialized, skipping');
    return;
  }

  console.log('[GlobalLiveStatus] Initializing global live status polling...');
  
  // Import database function
  const { getAllMonitoredStreamers } = await import('@/services/database');
  
  async function checkAllStreamersLiveStatus() {
    try {
      const streamers = await getAllMonitoredStreamers();

      if (streamers.length === 0) return;

      console.log(`[GlobalLiveStatus] Checking ${streamers.length} streamers (initial: ${isInitialPoll})`);

      const { updateMonitoredStreamer: updateStreamer } = await import('@/services/database');

      // Check all streamers in parallel instead of sequentially
      await Promise.allSettled(
        streamers.map(async (record) => {
          const wasLive = Boolean(record.is_currently_live);

          // Check live status with a 10s timeout per streamer
          const status = await Promise.race([
            fetchLiveStatus(
              record.mint_id,
              (record.platform as SupportedLivestreamPlatform) || 'PumpFun'
            ),
            new Promise<LiveStatus>((resolve) =>
              setTimeout(() => resolve({ isLive: false }), 10_000)
            ),
          ]);

          // Update database
          await updateStreamer(record.id, {
            is_currently_live: status.isLive ? 1 : 0,
            last_check_timestamp: Math.floor(Date.now() / 1000),
          });

          if (
            record.platform.toLowerCase() === 'twitter' &&
            isDirectTwitterLiveUrl(record.mint_id) &&
            !status.isLive
          ) {
            const monitoring = useLivestreamMonitoring();
            await monitoring.tryRemoveEndedTwitterBroadcastById(record.id, 'global-poll-offline');
          }

          // Show toast if went live (offline → online transition)
          // BUT skip toasts on initial poll to avoid spam when app first opens
          // Also skip on Live page where live status is already visible
          if (!wasLive && status.isLive && !isInitialPoll && !isOnLivePage()) {
            showSuccess(`${record.display_name} is now live!`, undefined, 7000, 'livestream');

            // Dispatch global event
            window.dispatchEvent(
              new CustomEvent('streamer-went-live', {
                detail: {
                  streamerId: record.id,
                  displayName: record.display_name,
                  platform: record.platform,
                  mintId: record.mint_id,
                },
              })
            );
          }
        })
      );

      // After first poll completes, mark as no longer initial
      if (isInitialPoll) {
        isInitialPoll = false;
        console.log('[GlobalLiveStatus] Initial poll complete, future polls will show toasts');
      }
    } catch (error) {
      console.error('[GlobalLiveStatus] Polling error:', error);
    }
  }
  
  // Initial check (won't show toasts)
  await checkAllStreamersLiveStatus();
  
  // Start periodic polling (every 60 seconds, will show toasts)
  globalLiveStatusInterval = window.setInterval(checkAllStreamersLiveStatus, 60_000);
  
  globalLiveStatusInitialized = true;
  console.log('[GlobalLiveStatus] Global live status polling initialized');
}

/**
 * Stop global live status polling (cleanup on app unmount if needed)
 */
export function stopGlobalLiveStatusPolling(): void {
  if (globalLiveStatusInterval !== null) {
    clearInterval(globalLiveStatusInterval);
    globalLiveStatusInterval = null;
  }
  globalLiveStatusInitialized = false;
  console.log('[GlobalLiveStatus] Stopped global live status polling');
}
