import { ref, computed, watch, onUnmounted, type Ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteParticipant,
  ConnectionState,
  type RemoteVideoTrack,
  type RemoteAudioTrack,
} from 'livekit-client';
import {
  getCreatorProfileByPlatformId,
  getSegmentsBySession,
  getRawVideo,
  type CreatorProfileWithLinks,
} from '@/services/database';
import type { LiveStatus, LiveSession, SegmentEventPayload } from '@/types/livestream';
import { useLivestreamMonitoring } from './useLivestreamMonitoring';
import { useDvrRecording, type DvrChunk } from './useDvrRecording';
import { useDvrPlayback } from './useDvrPlayback';

// PumpFun LiveKit API endpoints
const PUMPFUN_LIVESTREAM_API = 'https://livestream-api.pump.fun';
const PUMPFUN_LIVEKIT_URL = 'https://pump-prod-tg2x8veh.livekit.cloud';

// Connection states
export type ViewerConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

// Segment info for clipping
export interface SegmentInfo {
  segmentNumber: number;
  filePath: string;
  startTime: number; // Seconds from stream start
  duration: number;
  endTime: number;
}

// Viewer state interface
export interface LivestreamViewerState {
  // Connection
  connectionState: ViewerConnectionState;
  connectionError: string | null;

  // Stream info
  mintId: string | null;
  streamerId: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  viewerCount: number;
  streamQuality: string | null;
  latencyMs: number | null;

  // Recording timeline (for clipping - all times relative to DVR start)
  recordingStartTime: number | null; // Unix timestamp when stream originally started
  dvrStartTime: number | null; // Unix timestamp when DVR recording started
  liveEdgeTime: number; // Current live edge in seconds from DVR start
  playbackPosition: number; // Current playback position in seconds
  availableSegments: SegmentInfo[];
  totalRecordedDuration: number; // Total seconds of recorded content

  // Playback state
  isPlaying: boolean;
  isBuffering: boolean;
  isMuted: boolean;
  volume: number;
  isAtLiveEdge: boolean; // Whether playback is at the live edge

  // Buffered ranges for seek bar
  bufferedRanges: Array<{ start: number; end: number }>;

  // Session (for persistent recording)
  sessionId: string | null;
  projectId: string | null;

  // Temp Recording (for watch-only DVR)
  isTempRecording: boolean;
  tempSessionId: string | null;

  // Watermark
  creatorProfile: CreatorProfileWithLinks | null;
  watermarkId: string | null;
  watermarkSettings: Record<string, any> | null;
}

// Join livestream API response
interface JoinLivestreamResponse {
  token?: string;
  serverUrl?: string;
  url?: string;
  wsUrl?: string;
}

// Local storage keys
const VOLUME_STORAGE_KEY = 'livestream-viewer-volume';
const MUTED_STORAGE_KEY = 'livestream-viewer-muted';

export function useLivestreamViewer() {
  // Get the monitoring composable to access active sessions
  const {
    activeSessions,
    monitoredStreamers,
    startMonitoring,
    stopMonitoring,
    dvrSessions,
    dvrRecording,
  } = useLivestreamMonitoring();

  // DVR Playback composable for MSE-based playback
  const dvrPlayback = useDvrPlayback();

  // Core state
  const state = ref<LivestreamViewerState>({
    connectionState: 'disconnected',
    connectionError: null,
    mintId: null,
    streamerId: null,
    displayName: null,
    profileImageUrl: null,
    viewerCount: 0,
    streamQuality: null,
    latencyMs: null,
    recordingStartTime: null,
    dvrStartTime: null,
    liveEdgeTime: 0,
    playbackPosition: 0,
    availableSegments: [],
    totalRecordedDuration: 0,
    isPlaying: false,
    isBuffering: true,
    isMuted: loadMutedPreference(),
    volume: loadVolumePreference(),
    isAtLiveEdge: true,
    bufferedRanges: [],
    sessionId: null,
    projectId: null,
    isTempRecording: false,
    tempSessionId: null,
    creatorProfile: null,
    watermarkId: null,
    watermarkSettings: null,
  });

  // LiveKit room instance (kept for viewer count and stream status only)
  let room: Room | null = null;

  // Video element reference
  const videoElement = ref<HTMLVideoElement | null>(null);

  // Reconnection state
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 5;
  let reconnectTimeout: number | null = null;
  let isIntentionalDisconnect = false; // Flag to prevent reconnects on intentional disconnect

  // Update timers
  let liveEdgeUpdateInterval: number | null = null;
  let segmentPollInterval: number | null = null;
  let playbackSyncInterval: number | null = null;

  // Event listeners
  const unlistenFunctions: UnlistenFn[] = [];

  // Computed values
  const isConnected = computed(() => state.value.connectionState === 'connected');
  const isLive = computed(() => state.value.connectionState === 'connected');

  // How much recorded DVR content is available for clipping
  const availableClipDuration = computed(() => state.value.totalRecordedDuration);

  // Is playback at the live edge
  const isAtLiveEdge = computed(() => state.value.isAtLiveEdge);

  // Helper functions
  function loadVolumePreference(): number {
    try {
      const stored = localStorage.getItem(VOLUME_STORAGE_KEY);
      return stored ? parseFloat(stored) : 1;
    } catch {
      return 1;
    }
  }

  function loadMutedPreference(): boolean {
    try {
      const stored = localStorage.getItem(MUTED_STORAGE_KEY);
      return stored === 'true';
    } catch {
      return false;
    }
  }

  function saveVolumePreference(volume: number) {
    try {
      localStorage.setItem(VOLUME_STORAGE_KEY, volume.toString());
    } catch {
      // Ignore storage errors
    }
  }

  function saveMutedPreference(muted: boolean) {
    try {
      localStorage.setItem(MUTED_STORAGE_KEY, muted.toString());
    } catch {
      // Ignore storage errors
    }
  }

  // API functions
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
      console.warn('[LiveViewer] Failed to check live status', error);
      return { isLive: false };
    }
  }

  async function joinLivestream(mintId: string): Promise<JoinLivestreamResponse> {
    try {
      const response = await invoke<string>('join_pumpfun_livestream', { mintId });
      if (!response) {
        throw new Error('Empty response from join API');
      }
      return JSON.parse(response);
    } catch (error) {
      console.error('[LiveViewer] Join livestream error:', error);
      throw new Error(`Failed to join livestream: ${error}`);
    }
  }

  async function getPreferredRegion(token: string): Promise<string> {
    try {
      const response = await invoke<string>('get_livekit_regions', { token });
      if (response) {
        const data = JSON.parse(response);
        if (Array.isArray(data?.regions) && data.regions.length > 0) {
          const sorted = [...data.regions].sort(
            (a: any, b: any) => Number(a.distance || Infinity) - Number(b.distance || Infinity)
          );
          const regionUrl = sorted[0]?.url;
          if (regionUrl) {
            console.log('[LiveViewer] Got preferred region:', regionUrl);
            return regionUrl;
          }
        }
      }
    } catch (error) {
      console.warn('[LiveViewer] Failed to get preferred region', error);
    }
    return PUMPFUN_LIVEKIT_URL;
  }

  // Load creator profile and watermark settings
  async function loadCreatorProfile(mintId: string) {
    try {
      const profile = await getCreatorProfileByPlatformId('pumpfun', mintId);
      if (profile) {
        state.value.creatorProfile = profile;
        state.value.watermarkId = profile.watermark_id;
        if (profile.watermark_settings) {
          try {
            state.value.watermarkSettings = JSON.parse(profile.watermark_settings);
          } catch {
            state.value.watermarkSettings = null;
          }
        }
      }
    } catch (error) {
      console.warn('[LiveViewer] Failed to load creator profile', error);
    }
  }

  // Connect to livestream
  async function connect(
    mintId: string,
    streamerId: string,
    displayName: string,
    profileImageUrl?: string,
    autoStartRecording: boolean = true
  ) {
    console.log('[LiveViewer] connect() called with:', { mintId, streamerId, displayName });

    if (!mintId) {
      console.error('[LiveViewer] No mintId provided!');
      state.value.connectionState = 'failed';
      state.value.connectionError = 'No stream ID provided';
      return;
    }

    if (state.value.connectionState === 'connecting') {
      console.log('[LiveViewer] Already connecting, skipping...');
      return;
    }

    // Reset intentional disconnect flag when starting a new connection
    isIntentionalDisconnect = false;

    console.log('[LiveViewer] Setting state to connecting...');
    state.value.connectionState = 'connecting';
    state.value.connectionError = null;
    state.value.mintId = mintId;
    state.value.streamerId = streamerId;
    state.value.displayName = displayName;
    state.value.profileImageUrl = profileImageUrl || null;
    state.value.isBuffering = true;

    try {
      // Check if stream is live
      console.log('[LiveViewer] Checking live status for mint:', mintId);
      const liveStatus = await fetchLiveStatus(mintId);
      console.log('[LiveViewer] Live status:', liveStatus);

      if (!liveStatus.isLive) {
        state.value.connectionState = 'failed';
        state.value.connectionError = 'Stream is not live';
        return;
      }

      state.value.viewerCount = liveStatus.numParticipants || 0;
      state.value.recordingStartTime = liveStatus.streamStartTimestamp
        ? Math.floor(liveStatus.streamStartTimestamp / 1000)
        : Math.floor(Date.now() / 1000);

      // Load creator profile for watermark
      await loadCreatorProfile(mintId);

      // Get join token for LiveKit (for viewer count tracking)
      console.log('[LiveViewer] Joining livestream...');
      const joinData = await joinLivestream(mintId);
      console.log('[LiveViewer] Join response:', joinData);
      const token = joinData.token;

      if (!token) {
        throw new Error('Failed to obtain LiveKit token');
      }

      // Get preferred region
      let livekitUrl = joinData.serverUrl || joinData.url || joinData.wsUrl;
      console.log('[LiveViewer] Server URL from join:', livekitUrl);

      if (!livekitUrl) {
        livekitUrl = await getPreferredRegion(token);
        console.log('[LiveViewer] Using preferred region URL:', livekitUrl);
      }

      // Ensure we're using wss:// protocol for WebSocket connection
      if (livekitUrl && livekitUrl.startsWith('https://')) {
        livekitUrl = livekitUrl.replace('https://', 'wss://');
        console.log('[LiveViewer] Converted to WebSocket URL:', livekitUrl);
      } else if (
        livekitUrl &&
        !livekitUrl.startsWith('wss://') &&
        !livekitUrl.startsWith('ws://')
      ) {
        livekitUrl = 'wss://' + livekitUrl;
        console.log('[LiveViewer] Added wss:// protocol:', livekitUrl);
      }

      // Create and connect to LiveKit room (for viewer count only, NOT for video playback)
      console.log('[LiveViewer] Creating LiveKit room for viewer tracking...');
      room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      // Set up room event handlers (for viewer count and connection status)
      setupRoomEventHandlers(room);

      // Connect to room
      console.log('[LiveViewer] Connecting to LiveKit room at:', livekitUrl);
      await room.connect(livekitUrl, token, { autoSubscribe: false }); // Don't subscribe to tracks
      console.log('[LiveViewer] Connected! Room state:', room.state);

      state.value.connectionState = 'connected';
      reconnectAttempts = 0;

      // Start DVR recording for playback and clipping
      if (autoStartRecording) {
        await ensureDvrAvailable(streamerId, mintId, displayName, profileImageUrl);
      }

      // Start live edge update timer
      startLiveEdgeUpdates();

      // Start segment polling for DVR
      startSegmentPolling();

      // Listen for segment events
      await setupSegmentEventListeners();

      // Start playback sync interval
      startPlaybackSync();

      // Initialize DVR playback if we have chunks
      await initializeDvrPlayback();
    } catch (error) {
      console.error('[LiveViewer] Connection failed:', error);
      state.value.connectionState = 'failed';
      state.value.isBuffering = false;

      // Provide more detailed error messages
      let errorMessage = 'Connection failed';
      if (error instanceof Error) {
        errorMessage = error.message;
        // Check for common errors
        if (error.message.includes('CORS') || error.message.includes('cors')) {
          errorMessage = 'Connection blocked by browser security (CORS)';
        } else if (error.message.includes('network') || error.message.includes('Network')) {
          errorMessage = 'Network error - check your internet connection';
        } else if (error.message.includes('token') || error.message.includes('Token')) {
          errorMessage = 'Authentication failed - invalid stream token';
        }
      }
      state.value.connectionError = errorMessage;

      console.error('[LiveViewer] Error details:', {
        message: errorMessage,
        originalError: error,
        mintId,
      });

      // Attempt reconnect (but not for auth errors)
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS && !errorMessage.includes('Authentication')) {
        scheduleReconnect(mintId, streamerId, displayName, profileImageUrl);
      }
    }
  }

  function setupRoomEventHandlers(room: Room) {
    // Only track viewer count and connection status, NOT video/audio tracks
    room.on(RoomEvent.Disconnected, handleDisconnected);
    room.on(RoomEvent.Reconnecting, handleReconnecting);
    room.on(RoomEvent.Reconnected, handleReconnected);
    room.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log('[LiveViewer] Participant connected:', participant.identity);
      updateViewerCount();
    });
    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      console.log('[LiveViewer] Participant disconnected:', participant.identity);
      updateViewerCount();
    });
    room.on(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);
    room.on(RoomEvent.ConnectionQualityChanged, handleConnectionQualityChanged);
  }

  function handleDisconnected() {
    console.log('[LiveViewer] Disconnected from room');
    state.value.connectionState = 'disconnected';

    // Attempt reconnect only if it wasn't intentional
    if (
      !isIntentionalDisconnect &&
      state.value.mintId &&
      reconnectAttempts < MAX_RECONNECT_ATTEMPTS
    ) {
      scheduleReconnect(
        state.value.mintId,
        state.value.streamerId || '',
        state.value.displayName || '',
        state.value.profileImageUrl || undefined
      );
    }
  }

  function handleReconnecting() {
    console.log('[LiveViewer] Reconnecting...');
    state.value.connectionState = 'reconnecting';
  }

  function handleReconnected() {
    console.log('[LiveViewer] Reconnected');
    state.value.connectionState = 'connected';
    reconnectAttempts = 0;
  }

  function handleConnectionStateChanged(connectionState: ConnectionState) {
    console.log('[LiveViewer] Connection state changed:', connectionState);

    if (connectionState === ConnectionState.Connected) {
      state.value.connectionState = 'connected';
    } else if (connectionState === ConnectionState.Reconnecting) {
      state.value.connectionState = 'reconnecting';
    } else if (connectionState === ConnectionState.Disconnected) {
      state.value.connectionState = 'disconnected';
    }
  }

  function handleConnectionQualityChanged(quality: any, participant: any) {
    // Update latency estimate based on connection quality
    if (participant.isLocal === false) {
      // Estimate latency based on quality
      const latencyMap: Record<string, number> = {
        excellent: 500,
        good: 1000,
        poor: 2000,
        lost: 5000,
      };
      state.value.latencyMs = latencyMap[quality] || 1000;
    }
  }

  function updateViewerCount() {
    if (room) {
      state.value.viewerCount = room.remoteParticipants.size + 1; // +1 for the streamer
    }
  }

  function scheduleReconnect(
    mintId: string,
    streamerId: string,
    displayName: string,
    profileImageUrl?: string
  ) {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }

    reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Exponential backoff, max 30s

    console.log(`[LiveViewer] Scheduling reconnect attempt ${reconnectAttempts} in ${delay}ms`);

    reconnectTimeout = window.setTimeout(() => {
      connect(mintId, streamerId, displayName, profileImageUrl, false);
    }, delay);
  }

  // Ensure DVR is available for playback and clipping
  async function ensureDvrAvailable(
    streamerId: string,
    mintId: string,
    displayName: string,
    profileImageUrl?: string
  ) {
    // Check if already has a persistent recording session
    const session = activeSessions.value.get(streamerId);
    if (session) {
      state.value.sessionId = session.sessionId;
      state.value.projectId = session.projectId;
      state.value.isTempRecording = false;
      console.log('[LiveViewer] Using existing persistent recording session:', session.sessionId);
      return;
    }

    // Check if DVR session already exists (started by monitoring)
    if (dvrRecording.isDvrSessionActive(mintId)) {
      state.value.isTempRecording = true;
      state.value.projectId = null;

      // Update available DVR chunks
      updateDvrChunksFromSession(mintId);

      console.log('[LiveViewer] Using existing DVR session for:', mintId);
      return;
    }

    // Start DVR recording for playback and clipping
    try {
      await dvrRecording.startDvrSession(mintId, streamerId, displayName);
      state.value.isTempRecording = true;
      state.value.projectId = null;
      console.log('[LiveViewer] Started DVR session for:', mintId);
    } catch (error) {
      console.warn('[LiveViewer] Failed to start DVR session:', error);
      state.value.connectionError = 'Failed to start DVR recording';
    }
  }

  // Initialize DVR playback with MSE
  async function initializeDvrPlayback() {
    if (!videoElement.value || !state.value.mintId) {
      console.log('[LiveViewer] Cannot initialize DVR playback - missing video element or mintId');
      return;
    }

    const chunks = getDvrChunks();
    console.log('[LiveViewer] Initializing DVR playback with', chunks.length, 'chunks');

    // Apply audio settings before initializing
    dvrPlayback.setVolume(state.value.volume);
    dvrPlayback.setMuted(state.value.isMuted);

    const success = await dvrPlayback.initialize(videoElement.value, state.value.mintId, chunks);

    if (success) {
      console.log('[LiveViewer] DVR playback initialized successfully');
    } else {
      console.error(
        '[LiveViewer] DVR playback initialization failed:',
        dvrPlayback.state.value.error
      );
      state.value.connectionError =
        dvrPlayback.state.value.error || 'Failed to initialize playback';
    }
  }

  // Get DVR chunks in the format needed for playback
  function getDvrChunks(): DvrChunk[] {
    if (!state.value.mintId) return [];
    return dvrRecording.getChunks(state.value.mintId);
  }

  // Update available segments from DVR session
  function updateDvrChunksFromSession(mintId: string) {
    const dvrSession = dvrRecording.getDvrSession(mintId);
    const chunks = dvrRecording.getChunks(mintId);

    // Set DVR start time if we have a session
    if (dvrSession && !state.value.dvrStartTime) {
      state.value.dvrStartTime = dvrSession.startedAt;
      console.log('[LiveViewer] DVR start time set:', new Date(dvrSession.startedAt).toISOString());
    }

    if (chunks.length > 0) {
      // Chunks are already relative to DVR start, use them directly
      state.value.availableSegments = chunks.map((chunk) => ({
        segmentNumber: chunk.index,
        filePath: chunk.path,
        startTime: chunk.startTime,
        duration: chunk.duration,
        endTime: chunk.endTime,
      }));

      state.value.totalRecordedDuration = dvrRecording.getTotalDuration(mintId);

      // Update DVR playback with new chunks
      dvrPlayback.updateChunks(chunks);
    }
  }

  // Live edge update timer
  function startLiveEdgeUpdates() {
    if (liveEdgeUpdateInterval) {
      clearInterval(liveEdgeUpdateInterval);
    }

    liveEdgeUpdateInterval = window.setInterval(() => {
      const referenceTime =
        state.value.dvrStartTime ||
        (state.value.recordingStartTime ? state.value.recordingStartTime * 1000 : null);

      if (referenceTime) {
        const now = Date.now();
        state.value.liveEdgeTime = Math.floor((now - referenceTime) / 1000);
      }
    }, 1000);
  }

  // Sync playback state from DVR playback composable
  function startPlaybackSync() {
    if (playbackSyncInterval) {
      clearInterval(playbackSyncInterval);
    }

    playbackSyncInterval = window.setInterval(() => {
      // Sync state from DVR playback
      const ps = dvrPlayback.state.value;
      state.value.isPlaying = ps.isPlaying;
      state.value.isBuffering = ps.isBuffering;
      state.value.playbackPosition = ps.currentTime;
      state.value.isAtLiveEdge = ps.isAtLiveEdge;
      state.value.bufferedRanges = ps.bufferedRanges;
      state.value.totalRecordedDuration = ps.duration;

      // Sync error state
      if (ps.error && !state.value.connectionError) {
        state.value.connectionError = ps.error;
      }
    }, 100);
  }

  // Segment polling for DVR
  function startSegmentPolling() {
    if (segmentPollInterval) {
      clearInterval(segmentPollInterval);
    }

    segmentPollInterval = window.setInterval(async () => {
      await updateAvailableSegments();
    }, 2000); // Poll every 2 seconds to catch new chunks quickly

    // Initial poll
    updateAvailableSegments();
  }

  async function updateAvailableSegments() {
    // For DVR (browser-based recording), get chunks from the DVR composable
    if (state.value.isTempRecording && state.value.mintId) {
      updateDvrChunksFromSession(state.value.mintId);
      return;
    }

    // For persistent recordings, get segments from database
    const sessionId = state.value.sessionId;
    if (!sessionId) {
      // Try to get session from activeSessions
      if (state.value.streamerId) {
        const session = activeSessions.value.get(state.value.streamerId);
        if (session) {
          state.value.sessionId = session.sessionId;
          state.value.projectId = session.projectId;
          state.value.isTempRecording = false;
        }
      }
      return;
    }

    try {
      const segments = await getSegmentsBySession(sessionId);
      const rawVideos = await Promise.all(
        segments.map((seg) =>
          seg.raw_video_id ? getRawVideo(seg.raw_video_id) : Promise.resolve(null)
        )
      );

      let cumulativeTime = 0;
      const segmentInfos: SegmentInfo[] = segments.map((seg, index) => {
        const startTime = cumulativeTime;
        const duration = seg.duration || state.value.totalRecordedDuration / segments.length;
        cumulativeTime += duration;
        const rawVideo = rawVideos[index];

        return {
          segmentNumber: seg.segment_number,
          filePath: rawVideo?.file_path || '',
          startTime,
          duration,
          endTime: cumulativeTime,
        };
      });

      state.value.availableSegments = segmentInfos;
      state.value.totalRecordedDuration = cumulativeTime;
    } catch (error) {
      console.warn('[LiveViewer] Failed to update segments', error);
    }
  }

  async function setupSegmentEventListeners() {
    // Listen for persistent recording segments
    const unlisten = await listen<SegmentEventPayload>('segment-ready', (event) => {
      if (event.payload.streamerId === state.value.streamerId && !state.value.isTempRecording) {
        // Update session ID if not set
        if (!state.value.sessionId) {
          state.value.sessionId = event.payload.sessionId;
        }

        // Add new segment to available segments
        const newSegment: SegmentInfo = {
          segmentNumber: event.payload.segment,
          filePath: event.payload.path,
          startTime: state.value.totalRecordedDuration,
          duration: event.payload.duration,
          endTime: state.value.totalRecordedDuration + event.payload.duration,
        };

        state.value.availableSegments = [...state.value.availableSegments, newSegment];
        state.value.totalRecordedDuration += event.payload.duration;
      }
    });

    // For DVR mode, poll the DVR session for new chunks
    const dvrUpdateInterval = window.setInterval(() => {
      if (state.value.isTempRecording && state.value.mintId) {
        updateDvrChunksFromSession(state.value.mintId);
      }
    }, 2000);

    // Store cleanup function
    const cleanupDvrInterval = () => {
      clearInterval(dvrUpdateInterval);
    };

    unlistenFunctions.push(unlisten, cleanupDvrInterval as any);
  }

  // Disconnect from livestream
  async function disconnect() {
    // Prevent multiple disconnects
    if (isIntentionalDisconnect) {
      console.log('[LiveViewer] Already disconnecting, skipping...');
      return;
    }

    console.log('[LiveViewer] Disconnecting...');

    // Mark as intentional disconnect to prevent reconnect attempts
    isIntentionalDisconnect = true;

    // Clear timers first
    if (liveEdgeUpdateInterval) {
      clearInterval(liveEdgeUpdateInterval);
      liveEdgeUpdateInterval = null;
    }

    if (segmentPollInterval) {
      clearInterval(segmentPollInterval);
      segmentPollInterval = null;
    }

    if (playbackSyncInterval) {
      clearInterval(playbackSyncInterval);
      playbackSyncInterval = null;
    }

    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    // Clean up event listeners
    for (const unlisten of unlistenFunctions) {
      unlisten();
    }
    unlistenFunctions.length = 0;

    // Clean up DVR playback first (this handles video element cleanup)
    await dvrPlayback.cleanup();

    // Clear video element ref before room disconnect
    videoElement.value = null;

    // Disconnect room
    if (room) {
      try {
        await room.disconnect(true);
        console.log('[LiveViewer] Room disconnected');
      } catch (e) {
        console.warn('[LiveViewer] Error disconnecting room:', e);
      }
      room = null;
    }

    // Reset state
    state.value.connectionState = 'disconnected';
    state.value.isPlaying = false;
    state.value.mintId = null;
    state.value.streamerId = null;
    state.value.isTempRecording = false;
    state.value.tempSessionId = null;
    state.value.sessionId = null;
    state.value.projectId = null;
    state.value.availableSegments = [];
    state.value.totalRecordedDuration = 0;
    state.value.dvrStartTime = null;
    state.value.liveEdgeTime = 0;
    state.value.playbackPosition = 0;
    state.value.bufferedRanges = [];
    state.value.isAtLiveEdge = true;

    // NOTE: Do NOT reset isIntentionalDisconnect here - async events may still fire
    // after disconnect completes. We reset it in connect() instead.

    console.log('[LiveViewer] Disconnect complete');
  }

  // Set video element reference
  function setVideoElement(element: HTMLVideoElement | null) {
    videoElement.value = element;

    // If we're already connected and have chunks, initialize playback
    if (element && state.value.connectionState === 'connected' && state.value.mintId) {
      initializeDvrPlayback();
    }
  }

  // Playback controls
  async function play() {
    console.log('[LiveViewer] play() called');
    await dvrPlayback.play();
  }

  function pause() {
    console.log('[LiveViewer] pause() called');
    dvrPlayback.pause();
  }

  function togglePlayPause() {
    console.log('[LiveViewer] togglePlayPause() called, isPlaying:', state.value.isPlaying);
    dvrPlayback.togglePlayPause();
  }

  // Seek to a specific time
  async function seek(time: number) {
    console.log('[LiveViewer] seek() called:', time);
    await dvrPlayback.seek(time);
  }

  // Seek to live edge
  async function seekToLive() {
    console.log('[LiveViewer] seekToLive() called');
    await dvrPlayback.seekToLive();
  }

  // Volume controls
  function setVolume(volume: number) {
    console.log('[LiveViewer] setVolume called:', volume);
    state.value.volume = Math.max(0, Math.min(1, volume));
    saveVolumePreference(state.value.volume);
    dvrPlayback.setVolume(state.value.volume);
  }

  function setMuted(muted: boolean) {
    console.log('[LiveViewer] setMuted called:', muted);
    state.value.isMuted = muted;
    saveMutedPreference(muted);
    dvrPlayback.setMuted(muted);
  }

  function toggleMute() {
    console.log('[LiveViewer] toggleMute called, current:', state.value.isMuted);
    setMuted(!state.value.isMuted);
  }

  // Cleanup on unmount
  onUnmounted(() => {
    disconnect();
  });

  // Watch for session updates from monitoring
  watch(
    () => activeSessions.value.get(state.value.streamerId || ''),
    (session) => {
      if (session) {
        state.value.sessionId = session.sessionId;
        state.value.projectId = session.projectId;
      }
    }
  );

  return {
    // State
    state,

    // Computed
    isConnected,
    isLive,
    availableClipDuration,
    isAtLiveEdge,

    // Video elements
    videoElement,

    // Connection
    connect,
    disconnect,

    // Element setup
    setVideoElement,

    // Playback controls
    play,
    pause,
    togglePlayPause,
    seek,
    seekToLive,
    setVolume,
    setMuted,
    toggleMute,

    // Utility
    updateAvailableSegments,
  };
}
