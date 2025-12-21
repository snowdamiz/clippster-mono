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
import { useHlsPlayback } from './useHlsPlayback';

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

// Playback modes
export type PlaybackMode = 'webrtc' | 'hls';

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
  playbackMode: PlaybackMode; // 'webrtc' for live, 'hls' for DVR

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
  const { activeSessions, monitoredStreamers, startMonitoring, stopMonitoring, dvrSessions } =
    useLivestreamMonitoring();

  // HLS Playback composable for reliable live streaming with DVR
  const hlsPlayback = useHlsPlayback();

  // Track the HLS recording output directory
  const hlsOutputDir = ref<string | null>(null);

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
    playbackMode: 'webrtc', // Start with live WebRTC playback
    bufferedRanges: [],
    sessionId: null,
    projectId: null,
    isTempRecording: false,
    tempSessionId: null,
    creatorProfile: null,
    watermarkId: null,
    watermarkSettings: null,
  });

  // LiveKit room instance (for WebRTC playback and viewer tracking)
  let room: Room | null = null;

  // Video element references
  const videoElement = ref<HTMLVideoElement | null>(null);
  const hlsVideoElement = ref<HTMLVideoElement | null>(null); // Separate element for HLS playback

  // WebRTC track references
  let remoteVideoTrack: RemoteVideoTrack | null = null;
  let remoteAudioTrack: RemoteAudioTrack | null = null;
  let videoAttachCleanup: (() => void) | null = null;
  let audioAttachCleanup: (() => void) | null = null;

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

      // Create and connect to LiveKit room (for WebRTC playback AND viewer tracking)
      console.log('[LiveViewer] Creating LiveKit room for WebRTC playback...');
      room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: { width: 1280, height: 720 },
        },
      });

      // Set up room event handlers (for WebRTC playback, viewer count, and connection status)
      setupRoomEventHandlers(room);

      // Connect to room with auto-subscribe for WebRTC playback
      console.log('[LiveViewer] Connecting to LiveKit room at:', livekitUrl);
      await room.connect(livekitUrl, token, { autoSubscribe: true }); // Subscribe to tracks for live playback
      console.log('[LiveViewer] Connected! Room state:', room.state);

      // Attach any existing tracks (streamer may already be publishing)
      attachExistingTracks();

      state.value.connectionState = 'connected';
      reconnectAttempts = 0;

      // Start HLS recording for playback and clipping
      if (autoStartRecording) {
        await ensureHlsRecordingAvailable(streamerId, mintId, displayName, profileImageUrl);
      }

      // Start live edge update timer
      startLiveEdgeUpdates();

      // Start segment polling for HLS
      startSegmentPolling();

      // Listen for segment events
      await setupSegmentEventListeners();

      // Start playback sync interval
      startPlaybackSync();

      // Initialize HLS playback when output dir is ready
      await initializeHlsPlayback();
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
    // Track subscription events for WebRTC playback
    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);

    // Connection events
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

  // Handle track subscription for WebRTC playback
  function handleTrackSubscribed(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) {
    console.log('[LiveViewer] Track subscribed:', track.kind, 'from:', participant.identity);

    if (track.kind === Track.Kind.Video) {
      remoteVideoTrack = track as RemoteVideoTrack;
      attachVideoTrack();
    } else if (track.kind === Track.Kind.Audio) {
      remoteAudioTrack = track as RemoteAudioTrack;
      attachAudioTrack();
    }
  }

  function handleTrackUnsubscribed(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) {
    console.log('[LiveViewer] Track unsubscribed:', track.kind, 'from:', participant.identity);

    if (track.kind === Track.Kind.Video) {
      detachVideoTrack();
      remoteVideoTrack = null;
    } else if (track.kind === Track.Kind.Audio) {
      detachAudioTrack();
      remoteAudioTrack = null;
    }
  }

  // Attach existing tracks when joining a room where streamer is already publishing
  function attachExistingTracks() {
    if (!room) return;

    room.remoteParticipants.forEach((participant) => {
      participant.trackPublications.forEach((publication) => {
        if (publication.track && publication.isSubscribed) {
          if (publication.track.kind === Track.Kind.Video) {
            remoteVideoTrack = publication.track as RemoteVideoTrack;
            attachVideoTrack();
          } else if (publication.track.kind === Track.Kind.Audio) {
            remoteAudioTrack = publication.track as RemoteAudioTrack;
            attachAudioTrack();
          }
        }
      });
    });
  }

  // Attach WebRTC video track to video element
  function attachVideoTrack() {
    if (!remoteVideoTrack || !videoElement.value) {
      console.log('[LiveViewer] Cannot attach video - track or element missing');
      return;
    }

    // Only attach if in WebRTC mode
    if (state.value.playbackMode !== 'webrtc') {
      console.log('[LiveViewer] Not in WebRTC mode, skipping video attach');
      return;
    }

    console.log('[LiveViewer] Attaching WebRTC video track');

    // Detach any existing attachment
    detachVideoTrack();

    // Attach the track to the video element
    remoteVideoTrack.attach(videoElement.value);
    videoAttachCleanup = () => {
      if (remoteVideoTrack && videoElement.value) {
        remoteVideoTrack.detach(videoElement.value);
      }
    };

    // Update state
    state.value.isBuffering = false;
    state.value.isPlaying = true;
    state.value.isAtLiveEdge = true;

    // Get video quality info
    const settings = remoteVideoTrack.mediaStreamTrack?.getSettings();
    if (settings) {
      state.value.streamQuality = `${settings.width}x${settings.height}`;
    }

    // Apply volume settings
    if (videoElement.value) {
      videoElement.value.volume = state.value.volume;
      videoElement.value.muted = state.value.isMuted;
    }
  }

  // Attach WebRTC audio track
  function attachAudioTrack() {
    if (!remoteAudioTrack || !videoElement.value) {
      console.log('[LiveViewer] Cannot attach audio - track or element missing');
      return;
    }

    // Only attach if in WebRTC mode
    if (state.value.playbackMode !== 'webrtc') {
      console.log('[LiveViewer] Not in WebRTC mode, skipping audio attach');
      return;
    }

    console.log('[LiveViewer] Attaching WebRTC audio track');

    // Detach any existing attachment
    detachAudioTrack();

    // Attach the track - audio is usually attached to the same element as video
    remoteAudioTrack.attach(videoElement.value);
    audioAttachCleanup = () => {
      if (remoteAudioTrack && videoElement.value) {
        remoteAudioTrack.detach(videoElement.value);
      }
    };
  }

  // Detach WebRTC video track
  function detachVideoTrack() {
    if (videoAttachCleanup) {
      videoAttachCleanup();
      videoAttachCleanup = null;
    }
  }

  // Detach WebRTC audio track
  function detachAudioTrack() {
    if (audioAttachCleanup) {
      audioAttachCleanup();
      audioAttachCleanup = null;
    }
  }

  // Switch to WebRTC playback mode (live)
  async function switchToWebRTC() {
    if (state.value.playbackMode === 'webrtc') return;

    console.log('[LiveViewer] Switching to WebRTC playback (live)');
    state.value.playbackMode = 'webrtc';
    state.value.isAtLiveEdge = true;

    // Pause HLS playback
    hlsPlayback.pause();

    // Attach WebRTC tracks to video element
    attachVideoTrack();
    attachAudioTrack();
  }

  // Switch to HLS playback mode (DVR)
  async function switchToHLS() {
    if (state.value.playbackMode === 'hls') return;

    console.log('[LiveViewer] Switching to HLS playback (DVR)');
    state.value.playbackMode = 'hls';

    // Detach WebRTC tracks
    detachVideoTrack();
    detachAudioTrack();

    // Initialize HLS if not already done
    if (hlsVideoElement.value && hlsOutputDir.value && !hlsPlayback.state.value.isInitialized) {
      await hlsPlayback.initialize(hlsVideoElement.value, hlsOutputDir.value);
    }

    // Play HLS
    await hlsPlayback.play();
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

  // Ensure HLS recording is available for playback and clipping
  async function ensureHlsRecordingAvailable(
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

      // Get the output directory for HLS playback
      try {
        const outputDir = await invoke<string>('get_recording_output_dir', {
          sessionId: session.sessionId,
        });
        hlsOutputDir.value = outputDir;
        console.log('[LiveViewer] HLS output directory:', outputDir);
      } catch (e) {
        console.warn('[LiveViewer] Could not get recording output dir:', e);
      }
      return;
    }

    // Start HLS recording via Tauri (Node.js recorder)
    try {
      console.log('[LiveViewer] Starting HLS recording for:', mintId);
      const result = await invoke<{ sessionId: string; outputDir: string }>('start_hls_recording', {
        mintId,
        streamerId,
        displayName,
      });

      state.value.sessionId = result.sessionId;
      state.value.isTempRecording = true;
      state.value.projectId = null;
      hlsOutputDir.value = result.outputDir;
      state.value.dvrStartTime = Date.now();

      console.log('[LiveViewer] HLS recording started:', result);
    } catch (error) {
      console.warn('[LiveViewer] Failed to start HLS recording:', error);
      state.value.connectionError = 'Failed to start recording';
    }
  }

  // Track if HLS is already initializing to prevent duplicate calls
  let isHlsInitializing = false;

  // Initialize HLS playback (for DVR mode - uses separate video element)
  async function initializeHlsPlayback() {
    // Use hlsVideoElement if available, otherwise fall back to main videoElement
    const hlsElement = hlsVideoElement.value || videoElement.value;

    if (!hlsElement || !hlsOutputDir.value) {
      console.log(
        '[LiveViewer] Cannot initialize HLS playback - missing video element or output dir'
      );
      return;
    }

    // Prevent duplicate initialization
    if (isHlsInitializing) {
      console.log('[LiveViewer] HLS playback already initializing, skipping...');
      return;
    }

    // Skip if already initialized
    if (hlsPlayback.state.value.isInitialized) {
      console.log('[LiveViewer] HLS playback already initialized');
      return;
    }

    isHlsInitializing = true;
    console.log(
      '[LiveViewer] Initializing HLS playback (DVR) with output dir:',
      hlsOutputDir.value
    );

    // Apply audio settings before initializing
    hlsPlayback.setVolume(state.value.volume);
    hlsPlayback.setMuted(state.value.isMuted);

    try {
      const success = await hlsPlayback.initialize(hlsElement, hlsOutputDir.value);

      if (success) {
        console.log('[LiveViewer] HLS playback initialized successfully (ready for DVR)');
        // Don't start playing - we're in WebRTC mode by default
        // HLS will start when user seeks backwards
        if (state.value.playbackMode === 'webrtc') {
          hlsPlayback.pause(); // Ensure HLS is paused while WebRTC is active
        }
      } else {
        console.error(
          '[LiveViewer] HLS playback initialization failed:',
          hlsPlayback.state.value.error
        );
        // Don't set error if we're in WebRTC mode - HLS is just backup
        if (state.value.playbackMode === 'hls') {
          state.value.connectionError =
            hlsPlayback.state.value.error || 'Failed to initialize DVR playback';
        }
      }
    } finally {
      isHlsInitializing = false;
    }
  }

  // Update available segments from HLS recording
  async function updateHlsSegments() {
    if (!hlsOutputDir.value) return;

    try {
      // Get segment info from the HLS playlist
      const segments = await invoke<SegmentInfo[]>('get_hls_segments', {
        outputDir: hlsOutputDir.value,
      });

      if (segments && segments.length > 0) {
        state.value.availableSegments = segments;
        state.value.totalRecordedDuration = segments[segments.length - 1].endTime;
      }
    } catch (error) {
      // Silently fail - segments may not be ready yet
      console.debug('[LiveViewer] Could not get HLS segments:', error);
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

  // Sync playback state based on current mode
  function startPlaybackSync() {
    if (playbackSyncInterval) {
      clearInterval(playbackSyncInterval);
    }

    playbackSyncInterval = window.setInterval(() => {
      if (state.value.playbackMode === 'hls') {
        // Sync state from HLS playback
        const ps = hlsPlayback.state.value;
        state.value.isPlaying = ps.isPlaying;
        state.value.isBuffering = ps.isBuffering;
        state.value.playbackPosition = ps.currentTime;
        state.value.isAtLiveEdge = ps.isAtLiveEdge;
        state.value.bufferedRanges = ps.bufferedRanges;
        state.value.totalRecordedDuration = ps.duration;
        state.value.liveEdgeTime = ps.liveEdgeTime;
        state.value.latencyMs = ps.latency * 1000; // Convert to ms

        // Sync error state
        if (ps.error && !state.value.connectionError) {
          state.value.connectionError = ps.error;
        }
      } else {
        // WebRTC mode - update state from video element
        if (videoElement.value) {
          state.value.isPlaying = !videoElement.value.paused;
          state.value.isBuffering = videoElement.value.readyState < 3;
        }

        // Always at live edge in WebRTC mode
        state.value.isAtLiveEdge = true;

        // Estimate latency for WebRTC (typically very low)
        state.value.latencyMs = 200; // ~200ms typical WebRTC latency

        // Still update total recorded duration from HLS (for DVR info)
        if (hlsPlayback.state.value.duration > 0) {
          state.value.totalRecordedDuration = hlsPlayback.state.value.duration;
          state.value.liveEdgeTime = hlsPlayback.state.value.liveEdgeTime;
        }
      }
    }, 100);
  }

  // Segment polling for HLS
  function startSegmentPolling() {
    if (segmentPollInterval) {
      clearInterval(segmentPollInterval);
    }

    // Poll to update available segments info (for clipping)
    segmentPollInterval = window.setInterval(async () => {
      await updateAvailableSegments();
    }, 2000); // HLS handles its own playlist updates, poll less frequently

    // Initial poll
    updateAvailableSegments();
  }

  async function updateAvailableSegments() {
    // For HLS recordings, update from the recording directory
    if (hlsOutputDir.value) {
      await updateHlsSegments();
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

    // For HLS mode, poll for new segments
    const hlsUpdateInterval = window.setInterval(() => {
      if (hlsOutputDir.value) {
        updateHlsSegments();
      }
    }, 2000);

    // Store cleanup function
    const cleanupHlsInterval = () => {
      clearInterval(hlsUpdateInterval);
    };

    unlistenFunctions.push(unlisten, cleanupHlsInterval as any);
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

    // Detach WebRTC tracks first
    detachVideoTrack();
    detachAudioTrack();
    remoteVideoTrack = null;
    remoteAudioTrack = null;

    // Clean up HLS playback (this handles HLS video element cleanup)
    await hlsPlayback.cleanup();

    // Reset HLS output directory
    hlsOutputDir.value = null;

    // Clear video element refs before room disconnect
    videoElement.value = null;
    hlsVideoElement.value = null;

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
    state.value.playbackMode = 'webrtc'; // Reset to default
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

  // Set video element reference (for WebRTC playback)
  function setVideoElement(element: HTMLVideoElement | null) {
    videoElement.value = element;

    // If we're already connected and in WebRTC mode, attach tracks
    if (
      element &&
      state.value.connectionState === 'connected' &&
      state.value.playbackMode === 'webrtc'
    ) {
      attachVideoTrack();
      attachAudioTrack();
    }
  }

  // Set HLS video element reference (for DVR playback)
  function setHlsVideoElement(element: HTMLVideoElement | null) {
    hlsVideoElement.value = element;

    // If we're already connected and have HLS output, initialize playback (but don't start it)
    if (element && state.value.connectionState === 'connected' && hlsOutputDir.value) {
      // Initialize HLS in background for DVR, but don't play yet
      initializeHlsPlayback();
    }
  }

  // Playback controls
  async function play() {
    console.log('[LiveViewer] play() called, mode:', state.value.playbackMode);

    if (state.value.playbackMode === 'webrtc') {
      // WebRTC is always "playing" when connected - just unmute if needed
      if (videoElement.value) {
        try {
          await videoElement.value.play();
          state.value.isPlaying = true;
        } catch (e) {
          console.warn('[LiveViewer] WebRTC play failed:', e);
        }
      }
    } else {
      await hlsPlayback.play();
    }
  }

  function pause() {
    console.log('[LiveViewer] pause() called, mode:', state.value.playbackMode);

    if (state.value.playbackMode === 'webrtc') {
      // Pause WebRTC video element
      if (videoElement.value) {
        videoElement.value.pause();
        state.value.isPlaying = false;
      }
    } else {
      hlsPlayback.pause();
    }
  }

  function togglePlayPause() {
    console.log('[LiveViewer] togglePlayPause() called, isPlaying:', state.value.isPlaying);

    if (state.value.isPlaying) {
      pause();
    } else {
      play();
    }
  }

  // Seek to a specific time
  async function seek(time: number) {
    console.log('[LiveViewer] seek() called:', time);

    // Calculate if seeking to near live edge
    const liveEdge = state.value.liveEdgeTime;
    const isNearLiveEdge = liveEdge > 0 && liveEdge - time < 5; // Within 5 seconds of live

    if (isNearLiveEdge) {
      // Seeking to live edge - use WebRTC for real-time
      await seekToLive();
    } else {
      // Seeking backwards - use HLS for DVR
      if (state.value.playbackMode !== 'hls') {
        await switchToHLS();
      }
      await hlsPlayback.seek(time);
      state.value.isAtLiveEdge = false;
    }
  }

  // Seek to live edge - switch to WebRTC for real-time playback
  async function seekToLive() {
    console.log('[LiveViewer] seekToLive() called');

    // Switch to WebRTC mode for real-time playback
    if (remoteVideoTrack) {
      await switchToWebRTC();
    } else {
      // Fallback to HLS live edge if WebRTC not available
      await hlsPlayback.seekToLive();
    }

    state.value.isAtLiveEdge = true;
  }

  // Volume controls
  function setVolume(volume: number) {
    console.log('[LiveViewer] setVolume called:', volume);
    state.value.volume = Math.max(0, Math.min(1, volume));
    saveVolumePreference(state.value.volume);
    hlsPlayback.setVolume(state.value.volume);
  }

  function setMuted(muted: boolean) {
    console.log('[LiveViewer] setMuted called:', muted);
    state.value.isMuted = muted;
    saveMutedPreference(muted);
    hlsPlayback.setMuted(muted);
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
    async (session) => {
      if (session) {
        state.value.sessionId = session.sessionId;
        state.value.projectId = session.projectId;

        // Get the output directory for HLS playback if available
        try {
          const outputDir = await invoke<string>('get_recording_output_dir', {
            sessionId: session.sessionId,
          });
          if (outputDir && !hlsOutputDir.value) {
            hlsOutputDir.value = outputDir;
            console.log('[LiveViewer] HLS output directory from session:', outputDir);
          }
        } catch (e) {
          // Ignore - may not have this command yet
        }
      }
    }
  );

  // Watch for HLS output directory to be ready
  watch(
    () => hlsOutputDir.value,
    async (outputDir) => {
      if (outputDir && videoElement.value && state.value.connectionState === 'connected') {
        console.log('[LiveViewer] HLS output dir ready, initializing playback');
        await initializeHlsPlayback();
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
    hlsVideoElement,

    // Connection
    connect,
    disconnect,

    // Element setup
    setVideoElement,
    setHlsVideoElement,

    // Playback controls
    play,
    pause,
    togglePlayPause,
    seek,
    seekToLive,
    setVolume,
    setMuted,
    toggleMute,

    // Mode switching
    switchToWebRTC,
    switchToHLS,

    // Utility
    updateAvailableSegments,
  };
}
