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
  type VideoTrack,
  type AudioTrack,
} from 'livekit-client';
import {
  getCreatorProfileByPlatformId,
  getSegmentsBySession,
  type CreatorProfileWithLinks,
} from '@/services/database';
import type { LiveStatus, LiveSession, SegmentEventPayload } from '@/types/livestream';
import { useLivestreamMonitoring } from './useLivestreamMonitoring';
import { useDvrRecording, type DvrChunk } from './useDvrRecording';

// PumpFun LiveKit API endpoints
const PUMPFUN_LIVESTREAM_API = 'https://livestream-api.pump.fun';
const PUMPFUN_LIVEKIT_URL = 'https://pump-prod-tg2x8veh.livekit.cloud';

// Connection states
export type ViewerConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

// Playback modes
export type PlaybackMode = 'live' | 'dvr';

// Segment info for DVR playback
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
  
  // DVR Timeline (all times are relative to DVR start, not stream start)
  recordingStartTime: number | null; // Unix timestamp when stream originally started (for reference)
  dvrStartTime: number | null; // Unix timestamp when DVR recording started (this is the timeline origin)
  liveEdgeTime: number; // Current live edge in seconds from DVR start
  playbackPosition: number; // Current playback position in seconds from DVR start
  isAtLiveEdge: boolean;
  availableSegments: SegmentInfo[];
  totalRecordedDuration: number; // Total seconds of recorded content
  
  // Playback
  playbackMode: PlaybackMode;
  isPlaying: boolean;
  isBuffering: boolean;
  isMuted: boolean;
  volume: number;
  playbackSpeed: number;
  
  // Session (for persistent recording)
  sessionId: string | null;
  projectId: string | null;
  
  // Temp Recording (for watch-only DVR)
  isTempRecording: boolean; // True if using temp recording (no persistent project)
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
  const { activeSessions, monitoredStreamers, startMonitoring, stopMonitoring, dvrSessions, dvrRecording } = useLivestreamMonitoring();
  
  // DVR recording composable is now accessed through monitoring (singleton pattern)
  
  // Constants
  const LIVE_EDGE_THRESHOLD = 5; // seconds - within this range switches to live mode
  
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
    isAtLiveEdge: true,
    availableSegments: [],
    totalRecordedDuration: 0,
    playbackMode: 'live',
    isPlaying: false,
    isBuffering: false,
    isMuted: loadMutedPreference(),
    volume: loadVolumePreference(),
    playbackSpeed: 1,
    sessionId: null,
    projectId: null,
    isTempRecording: false,
    tempSessionId: null,
    creatorProfile: null,
    watermarkId: null,
    watermarkSettings: null,
  });
  
  // LiveKit room instance
  let room: Room | null = null;
  
  // Video/Audio elements
  const videoElement = ref<HTMLVideoElement | null>(null);
  const liveVideoTrack = ref<VideoTrack | null>(null);
  const liveAudioTrack = ref<AudioTrack | null>(null);
  
  // DVR video element (for segment playback)
  const dvrVideoElement = ref<HTMLVideoElement | null>(null);
  
  // Reconnection state
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 5;
  let reconnectTimeout: number | null = null;
  
  // Update timers
  let liveEdgeUpdateInterval: number | null = null;
  let segmentPollInterval: number | null = null;
  
  // DVR chunk transition state
  let waitingForNextChunk = false;
  let waitingForChunkInterval: number | null = null;
  
  // Event listeners
  const unlistenFunctions: UnlistenFn[] = [];
  
  // Computed values
  const isConnected = computed(() => state.value.connectionState === 'connected');
  const isLive = computed(() => state.value.playbackMode === 'live' && state.value.isAtLiveEdge);
  const behindLiveSeconds = computed(() => {
    if (state.value.isAtLiveEdge) return 0;
    return Math.max(0, state.value.liveEdgeTime - state.value.playbackPosition);
  });
  const behindLiveFormatted = computed(() => {
    const seconds = behindLiveSeconds.value;
    if (seconds < 60) return `${Math.floor(seconds)}s behind`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (minutes < 60) return `${minutes}m ${secs}s behind`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m behind`;
  });
  // Can only seek backward if there's DVR content and we're not at position 0
  const canSeekBackward = computed(() => {
    const hasDvrContent = state.value.availableSegments.length > 0;
    return hasDvrContent && state.value.playbackPosition > 0;
  });
  const canSeekForward = computed(() => !state.value.isAtLiveEdge);
  // How much recorded DVR content is available to rewind through
  const availableDvrDuration = computed(() => state.value.totalRecordedDuration);
  // Current position represents how much content we can clip from
  const availableClipDuration = computed(() => state.value.playbackPosition);
  
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
    
    console.log('[LiveViewer] Setting state to connecting...');
    state.value.connectionState = 'connecting';
    state.value.connectionError = null;
    state.value.mintId = mintId;
    state.value.streamerId = streamerId;
    state.value.displayName = displayName;
    state.value.profileImageUrl = profileImageUrl || null;
    
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
      
      // Get join token
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
      } else if (livekitUrl && !livekitUrl.startsWith('wss://') && !livekitUrl.startsWith('ws://')) {
        livekitUrl = 'wss://' + livekitUrl;
        console.log('[LiveViewer] Added wss:// protocol:', livekitUrl);
      }
      
      // Create and connect to LiveKit room
      console.log('[LiveViewer] Creating LiveKit room...');
      room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      
      // Set up room event handlers
      setupRoomEventHandlers(room);
      
      // Connect to room
      console.log('[LiveViewer] Connecting to LiveKit room at:', livekitUrl);
      await room.connect(livekitUrl, token, { autoSubscribe: true });
      console.log('[LiveViewer] Connected! Room state:', room.state);
      
      state.value.connectionState = 'connected';
      reconnectAttempts = 0;
      
      // Log room participants info
      console.log('[LiveViewer] Remote participants count:', room.remoteParticipants.size);
      
      // Handle existing participants' tracks (they may already be publishing)
      room.remoteParticipants.forEach((participant) => {
        console.log('[LiveViewer] Participant:', participant.identity, 'tracks:', participant.trackPublications.size);
        participant.trackPublications.forEach((publication) => {
          console.log('[LiveViewer] Track publication:', publication.trackSid, 'kind:', publication.kind, 'subscribed:', publication.isSubscribed, 'track:', !!publication.track);
          if (publication.track && publication.isSubscribed) {
            handleTrackSubscribed(
              publication.track as RemoteTrack,
              publication as RemoteTrackPublication,
              participant
            );
          } else if (!publication.isSubscribed && publication.kind === 'video') {
            // Try to subscribe manually if not auto-subscribed
            console.log('[LiveViewer] Attempting to subscribe to video track:', publication.trackSid);
            publication.setSubscribed(true);
          }
        });
      });
      
      // Start DVR if enabled (for clipping/seeking capability)
      if (autoStartRecording) {
        await ensureDvrAvailable(streamerId, mintId, displayName, profileImageUrl);
      }
      
      // Start live edge update timer
      startLiveEdgeUpdates();
      
      // Start segment polling for DVR
      startSegmentPolling();
      
      // Listen for segment events
      await setupSegmentEventListeners();
      
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
    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    room.on(RoomEvent.TrackPublished, (publication, participant) => {
      console.log('[LiveViewer] Track published:', publication.trackSid, 'kind:', publication.kind, 'by:', participant.identity);
    });
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
    room.on(RoomEvent.MediaDevicesError, (error) => {
      console.error('[LiveViewer] Media devices error:', error);
    });
    room.on(RoomEvent.SignalConnected, () => {
      console.log('[LiveViewer] Signal connected');
    });
  }
  
  function handleTrackSubscribed(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) {
    console.log('[LiveViewer] Track subscribed:', track.kind, 'from participant:', participant.identity);
    
    if (track.kind === Track.Kind.Video) {
      liveVideoTrack.value = track as VideoTrack;
      
      // Attach to video element if available and in live mode
      if (videoElement.value && state.value.playbackMode === 'live') {
        console.log('[LiveViewer] Attaching video track to element');
        track.attach(videoElement.value);
        state.value.isPlaying = true;
        state.value.isBuffering = false;
        
        // Get video quality info
        const dimensions = (track as VideoTrack).dimensions;
        if (dimensions) {
          const height = dimensions.height;
          state.value.streamQuality = height >= 1080 ? '1080p' : height >= 720 ? '720p' : height >= 480 ? '480p' : '360p';
          console.log('[LiveViewer] Video dimensions:', dimensions.width, 'x', dimensions.height);
        }
        
        // Try to play the video
        videoElement.value.play().catch((err) => {
          console.log('[LiveViewer] Video autoplay blocked:', err);
        });
      }
    } else if (track.kind === Track.Kind.Audio) {
      liveAudioTrack.value = track as AudioTrack;
      
      // Attach audio if in live mode
      if (videoElement.value && state.value.playbackMode === 'live') {
        console.log('[LiveViewer] Attaching audio track to element');
        track.attach(videoElement.value);
        applyAudioSettings();
      }
    }
  }
  
  function handleTrackUnsubscribed(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) {
    console.log('[LiveViewer] Track unsubscribed:', track.kind);
    
    if (track.kind === Track.Kind.Video && liveVideoTrack.value === track) {
      track.detach();
      liveVideoTrack.value = null;
    } else if (track.kind === Track.Kind.Audio && liveAudioTrack.value === track) {
      track.detach();
      liveAudioTrack.value = null;
    }
  }
  
  function handleDisconnected() {
    console.log('[LiveViewer] Disconnected from room');
    state.value.connectionState = 'disconnected';
    
    // Attempt reconnect if it wasn't intentional
    if (state.value.mintId && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
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
  
  // Ensure DVR is available for clipping/DVR capability
  // DVR is now browser-based (MediaRecorder), not FFmpeg-based
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
    
    // Start DVR recording for watch-only mode
    // This creates a background LiveKit connection with MediaRecorder
    try {
      await dvrRecording.startDvrSession(mintId, streamerId, displayName);
      state.value.isTempRecording = true;
      state.value.projectId = null;
      console.log('[LiveViewer] Started DVR session for:', mintId);
    } catch (error) {
      console.warn('[LiveViewer] Failed to start DVR session:', error);
      // Even if DVR fails, we can still watch live (just no DVR/seeking capability)
    }
  }
  
  // Update available segments from DVR session
  // All times are relative to DVR start (not stream start)
  function updateDvrChunksFromSession(mintId: string) {
    const dvrSession = dvrRecording.getDvrSession(mintId);
    const chunks = dvrRecording.getChunks(mintId);
    
    // Debug logging
    if (!dvrSession) {
      console.log('[LiveViewer] No DVR session found for:', mintId);
    }
    
    // Set DVR start time if we have a session
    if (dvrSession && !state.value.dvrStartTime) {
      state.value.dvrStartTime = dvrSession.startedAt;
      console.log('[LiveViewer] DVR start time set:', new Date(dvrSession.startedAt).toISOString());
    }
    
    if (chunks.length > 0) {
      // Chunks are already relative to DVR start, use them directly
      state.value.availableSegments = chunks.map(chunk => ({
        segmentNumber: chunk.index,
        filePath: chunk.path,
        startTime: chunk.startTime,
        duration: chunk.duration,
        endTime: chunk.endTime,
      }));
      
      state.value.totalRecordedDuration = dvrRecording.getTotalDuration(mintId);
      
      // Only log when chunks change
      if (state.value.availableSegments.length !== chunks.length) {
        console.log(`[LiveViewer] DVR chunks updated: ${chunks.length} chunks, ${state.value.totalRecordedDuration}s total`);
      }
    }
  }
  
  // Live edge update timer
  // Timeline is relative to DVR start, not stream start
  function startLiveEdgeUpdates() {
    if (liveEdgeUpdateInterval) {
      clearInterval(liveEdgeUpdateInterval);
    }
    
    liveEdgeUpdateInterval = window.setInterval(() => {
      // Use DVR start time if available, otherwise fall back to recording start time
      const referenceTime = state.value.dvrStartTime || (state.value.recordingStartTime ? state.value.recordingStartTime * 1000 : null);
      
      if (referenceTime) {
        const now = Date.now();
        state.value.liveEdgeTime = Math.floor((now - referenceTime) / 1000);
        
        // Update playback position if at live edge
        if (state.value.isAtLiveEdge && state.value.playbackMode === 'live') {
          state.value.playbackPosition = state.value.liveEdgeTime;
        }
      }
    }, 1000);
  }
  
  // Segment polling for DVR
  function startSegmentPolling() {
    if (segmentPollInterval) {
      clearInterval(segmentPollInterval);
    }
    
    // Poll for segments every 10 seconds
    segmentPollInterval = window.setInterval(async () => {
      await updateAvailableSegments();
    }, 10000);
    
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
      
      let cumulativeTime = 0;
      const segmentInfos: SegmentInfo[] = segments.map((seg, index) => {
        const startTime = cumulativeTime;
        const duration = seg.duration || (state.value.totalRecordedDuration / segments.length);
        cumulativeTime += duration;
        
        return {
          segmentNumber: seg.segment_number,
          filePath: seg.file_path,
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
    
    // For DVR mode, poll the DVR session for new chunks (since MediaRecorder runs in same process)
    // DVR chunks are added directly to the session state, we just need to sync them
    const dvrUpdateInterval = window.setInterval(() => {
      if (state.value.isTempRecording && state.value.mintId) {
        updateDvrChunksFromSession(state.value.mintId);
      }
    }, 2000);  // Check for new chunks every 2 seconds
    
    // Store cleanup function
    const cleanupDvrInterval = () => {
      clearInterval(dvrUpdateInterval);
    };
    
    unlistenFunctions.push(unlisten, cleanupDvrInterval as any);
  }
  
  // Disconnect from livestream
  async function disconnect() {
    console.log('[LiveViewer] Disconnecting...');
    
    // Clear timers
    if (liveEdgeUpdateInterval) {
      clearInterval(liveEdgeUpdateInterval);
      liveEdgeUpdateInterval = null;
    }
    
    if (segmentPollInterval) {
      clearInterval(segmentPollInterval);
      segmentPollInterval = null;
    }
    
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    
    // Stop waiting for next chunk if active
    stopWaitingForChunk();
    
    // Clean up event listeners
    for (const unlisten of unlistenFunctions) {
      unlisten();
    }
    unlistenFunctions.length = 0;
    
    // Stop and clear video elements first
    if (videoElement.value) {
      videoElement.value.pause();
      videoElement.value.srcObject = null;
      videoElement.value.src = '';
      videoElement.value.load(); // Reset the video element
    }
    
    if (dvrVideoElement.value) {
      dvrVideoElement.value.pause();
      dvrVideoElement.value.src = '';
      dvrVideoElement.value.load();
    }
    
    // Clean up blob URLs
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
      currentBlobUrl = null;
    }
    if (pendingBlobUrl) {
      URL.revokeObjectURL(pendingBlobUrl);
      pendingBlobUrl = null;
    }
    
    // Cancel any pending seek
    if (seekAbortController) {
      seekAbortController.abort();
      seekAbortController = null;
    }
    
    // Detach tracks from any elements they might be attached to
    if (liveVideoTrack.value) {
      try {
        liveVideoTrack.value.detach();
      } catch (e) {
        console.warn('[LiveViewer] Error detaching video track:', e);
      }
      liveVideoTrack.value = null;
    }
    
    if (liveAudioTrack.value) {
      try {
        liveAudioTrack.value.detach();
      } catch (e) {
        console.warn('[LiveViewer] Error detaching audio track:', e);
      }
      liveAudioTrack.value = null;
    }
    
    // Disconnect room
    if (room) {
      try {
        await room.disconnect(true); // true = stop all tracks
        console.log('[LiveViewer] Room disconnected');
      } catch (e) {
        console.warn('[LiveViewer] Error disconnecting room:', e);
      }
      room = null;
    }
    
    // Clear video element refs
    videoElement.value = null;
    dvrVideoElement.value = null;
    
    // Reset state
    state.value.connectionState = 'disconnected';
    state.value.isPlaying = false;
    state.value.playbackMode = 'live';
    state.value.isAtLiveEdge = true;
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
    
    console.log('[LiveViewer] Disconnect complete');
  }
  
  // Set video element reference
  function setVideoElement(element: HTMLVideoElement | null) {
    videoElement.value = element;
    
    if (element && liveVideoTrack.value && state.value.playbackMode === 'live') {
      console.log('[LiveViewer] Attaching existing video track to video element');
      liveVideoTrack.value.attach(element);
      state.value.isPlaying = true;
      state.value.isBuffering = false;
      
      // Get video quality info
      const dimensions = liveVideoTrack.value.dimensions;
      if (dimensions) {
        const height = dimensions.height;
        state.value.streamQuality = height >= 1080 ? '1080p' : height >= 720 ? '720p' : height >= 480 ? '480p' : '360p';
      }
      
      if (liveAudioTrack.value) {
        liveAudioTrack.value.attach(element);
      }
      applyAudioSettings();
    }
  }
  
  // Set DVR video element reference
  function setDvrVideoElement(element: HTMLVideoElement | null) {
    dvrVideoElement.value = element;
    
    if (element) {
      element.addEventListener('timeupdate', handleDvrTimeUpdate);
      element.addEventListener('ended', handleDvrEnded);
      element.addEventListener('waiting', () => { state.value.isBuffering = true; });
      element.addEventListener('playing', () => { state.value.isBuffering = false; });
    }
  }
  
  function handleDvrTimeUpdate() {
    if (dvrVideoElement.value && state.value.playbackMode === 'dvr') {
      // Update playback position directly from video currentTime
      // (since we're using concatenated file, currentTime is absolute position)
      state.value.playbackPosition = dvrVideoElement.value.currentTime;
    }
  }
  
  // Handle DVR video ended event
  function handleDvrEnded() {
    if (state.value.playbackMode !== 'dvr') return;
    
    console.log('[LiveViewer] DVR video ended at position:', state.value.playbackPosition);
    
    // Check if we're close to live
    const timeBehindLive = state.value.liveEdgeTime - state.value.playbackPosition;
    
    if (timeBehindLive <= LIVE_EDGE_THRESHOLD) {
      // Close enough to live - switch to live mode
      console.log('[LiveViewer] Caught up to live edge, switching to live mode');
      goToLive();
    } else {
      // Still behind but the recording has ended - check if new chunks are available
      console.log('[LiveViewer] DVR ended but still behind live, checking for new chunks...');
      waitForNextChunk();
    }
  }
  
  function waitForNextChunk() {
    if (waitingForNextChunk) return;
    
    waitingForNextChunk = true;
    state.value.isBuffering = true;
    
    const currentPosition = state.value.playbackPosition;
    const previousChunkCount = state.value.availableSegments.length;
    
    console.log('[LiveViewer] Waiting for new chunks, current position:', currentPosition, 'chunks:', previousChunkCount);
    
    // Poll for new chunks every 500ms
    waitingForChunkInterval = window.setInterval(async () => {
      // Update available segments from DVR session
      if (state.value.mintId && state.value.isTempRecording) {
        updateDvrChunksFromSession(state.value.mintId);
      }
      
      // Check if new chunks are available
      const newChunkCount = state.value.availableSegments.length;
      
      if (newChunkCount > previousChunkCount) {
        // New chunk is available - reload the concatenated file and continue
        console.log('[LiveViewer] New chunks available:', newChunkCount, 'vs', previousChunkCount);
        stopWaitingForChunk();
        
        // Force reload by resetting the data size tracker
        currentDvrDataSize = 0;
        
        // Get the last segment to continue from current position
        const lastSegment = state.value.availableSegments[state.value.availableSegments.length - 1];
        if (lastSegment) {
          // Find the segment containing our current position
          const currentSegment = state.value.availableSegments.find(
            seg => currentPosition >= seg.startTime && currentPosition < seg.endTime
          ) || state.value.availableSegments[0];
          
          await playSegment(currentSegment, currentPosition - currentSegment.startTime);
        }
      } else {
        // Check if stream has ended
        if (state.value.mintId && dvrRecording.hasStreamEnded(state.value.mintId)) {
          // Stream ended and no more chunks - go to last available position
          console.log('[LiveViewer] Stream ended, no more chunks available');
          stopWaitingForChunk();
          state.value.isBuffering = false;
          
          // Check if we should go to live (stream just ended)
          const timeBehindLive = state.value.liveEdgeTime - state.value.playbackPosition;
          if (timeBehindLive <= LIVE_EDGE_THRESHOLD) {
            goToLive();
          }
        }
      }
    }, 500);
    
    // Timeout after 30 seconds of waiting
    setTimeout(() => {
      if (waitingForNextChunk) {
        console.warn('[LiveViewer] Timeout waiting for next chunk');
        stopWaitingForChunk();
        state.value.isBuffering = false;
        
        // Try to go live as fallback
        goToLive();
      }
    }, 30000);
  }
  
  function stopWaitingForChunk() {
    waitingForNextChunk = false;
    if (waitingForChunkInterval) {
      clearInterval(waitingForChunkInterval);
      waitingForChunkInterval = null;
    }
  }
  
  function getCurrentDvrSegment(): SegmentInfo | null {
    // Find the segment that contains the current playback position
    return state.value.availableSegments.find(
      seg => state.value.playbackPosition >= seg.startTime && state.value.playbackPosition < seg.endTime
    ) || null;
  }
  
  function getNextDvrSegment(): SegmentInfo | null {
    const current = getCurrentDvrSegment();
    if (!current) return state.value.availableSegments[0] || null;
    
    const nextIndex = state.value.availableSegments.findIndex(s => s.segmentNumber === current.segmentNumber) + 1;
    return state.value.availableSegments[nextIndex] || null;
  }
  
  // Playback controls
  function play() {
    console.log('[LiveViewer] play() called, mode:', state.value.playbackMode, 'hasVideoEl:', !!videoElement.value, 'hasTrack:', !!liveVideoTrack.value);
    if (state.value.playbackMode === 'live' && videoElement.value) {
      videoElement.value.play().then(() => {
        console.log('[LiveViewer] Video playing');
        state.value.isPlaying = true;
      }).catch((err) => {
        console.error('[LiveViewer] Play failed:', err);
      });
    } else if (state.value.playbackMode === 'dvr' && dvrVideoElement.value) {
      dvrVideoElement.value.play();
      state.value.isPlaying = true;
    } else {
      console.log('[LiveViewer] Cannot play - no video element or wrong mode');
    }
  }
  
  function pause() {
    console.log('[LiveViewer] pause() called');
    if (state.value.playbackMode === 'live' && videoElement.value) {
      videoElement.value.pause();
      state.value.isPlaying = false;
    } else if (state.value.playbackMode === 'dvr' && dvrVideoElement.value) {
      dvrVideoElement.value.pause();
      state.value.isPlaying = false;
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
  
  // Volume controls
  function setVolume(volume: number) {
    console.log('[LiveViewer] setVolume called:', volume);
    state.value.volume = Math.max(0, Math.min(1, volume));
    saveVolumePreference(state.value.volume);
    applyAudioSettings();
  }
  
  function setMuted(muted: boolean) {
    console.log('[LiveViewer] setMuted called:', muted);
    state.value.isMuted = muted;
    saveMutedPreference(muted);
    applyAudioSettings();
  }
  
  function toggleMute() {
    console.log('[LiveViewer] toggleMute called, current:', state.value.isMuted);
    setMuted(!state.value.isMuted);
  }
  
  function applyAudioSettings() {
    console.log('[LiveViewer] applyAudioSettings:', {
      mode: state.value.playbackMode,
      volume: state.value.volume,
      isMuted: state.value.isMuted,
      hasLiveElement: !!videoElement.value,
      hasDvrElement: !!dvrVideoElement.value
    });
    
    // Apply to both elements - settings should be synced
    if (videoElement.value) {
      // Remove the HTML muted attribute if unmuting (it can interfere)
      if (!state.value.isMuted) {
        videoElement.value.removeAttribute('muted');
      }
      videoElement.value.volume = state.value.volume;
      videoElement.value.muted = state.value.isMuted;
      console.log('[LiveViewer] Applied to live element:', {
        actualVolume: videoElement.value.volume,
        actualMuted: videoElement.value.muted,
        hasMutedAttr: videoElement.value.hasAttribute('muted')
      });
    }
    
    if (dvrVideoElement.value) {
      // Remove the HTML muted attribute if unmuting
      if (!state.value.isMuted) {
        dvrVideoElement.value.removeAttribute('muted');
      }
      dvrVideoElement.value.volume = state.value.volume;
      dvrVideoElement.value.muted = state.value.isMuted;
      console.log('[LiveViewer] Applied to DVR element:', {
        actualVolume: dvrVideoElement.value.volume,
        actualMuted: dvrVideoElement.value.muted,
        hasMutedAttr: dvrVideoElement.value.hasAttribute('muted')
      });
    }
  }
  
  // Pause live playback (for DVR mode) - keeps tracks so we can return to live
  function stopLivePlayback() {
    console.log('[LiveViewer] Pausing live playback for DVR mode');
    
    // Detach live tracks from the video element
    if (liveVideoTrack.value && videoElement.value) {
      liveVideoTrack.value.detach(videoElement.value);
    }
    if (liveAudioTrack.value && videoElement.value) {
      liveAudioTrack.value.detach(videoElement.value);
    }
    
    // Completely silence and pause the live video element
    if (videoElement.value) {
      videoElement.value.pause();
      videoElement.value.muted = true;
      videoElement.value.volume = 0;
      // Clear srcObject but don't stop the tracks (we need them for returning to live)
      videoElement.value.srcObject = null;
      videoElement.value.src = '';
      videoElement.value.load(); // Reset the element
    }
  }
  
  // Playback speed (DVR only)
  // Supported speeds for UI
  const SUPPORTED_PLAYBACK_SPEEDS = [0.5, 1, 1.25, 1.5, 2] as const;
  
  function setPlaybackSpeed(speed: number) {
    // Only allow speed changes in DVR mode (live mode is always 1x - real-time)
    if (state.value.playbackMode === 'dvr') {
      // Clamp to valid speeds
      const validSpeed = Math.max(0.5, Math.min(2, speed));
      state.value.playbackSpeed = validSpeed;
      if (dvrVideoElement.value) {
        dvrVideoElement.value.playbackRate = validSpeed;
      }
    }
  }
  
  // Cycle through playback speeds (useful for keyboard shortcuts)
  function cyclePlaybackSpeed() {
    if (state.value.playbackMode !== 'dvr') return;
    
    const currentIndex = SUPPORTED_PLAYBACK_SPEEDS.indexOf(state.value.playbackSpeed as any);
    const nextIndex = (currentIndex + 1) % SUPPORTED_PLAYBACK_SPEEDS.length;
    setPlaybackSpeed(SUPPORTED_PLAYBACK_SPEEDS[nextIndex]);
  }
  
  // Seeking (all positions are relative to DVR start)
  let lastSeekTime = 0;
  let lastSeekPosition = -1;
  
  async function seek(positionSeconds: number) {
    const targetPosition = Math.max(0, Math.min(positionSeconds, state.value.liveEdgeTime));
    
    // Debounce rapid seeks to the same position
    const now = Date.now();
    if (Math.abs(targetPosition - lastSeekPosition) < 0.5 && now - lastSeekTime < 100) {
      console.log('[LiveViewer] Debouncing rapid seek to same position');
      return;
    }
    lastSeekTime = now;
    lastSeekPosition = targetPosition;
    
    const timeBehindLive = state.value.liveEdgeTime - targetPosition;
    
    // Check if seeking near live edge (within threshold)
    if (timeBehindLive <= LIVE_EDGE_THRESHOLD) {
      await goToLive();
      return;
    }
    
    // Check if seeking before DVR start (position 0)
    if (targetPosition < 0) {
      await seek(0);
      return;
    }
    
    // Check if we have ANY DVR content at all
    if (state.value.availableSegments.length === 0) {
      console.log('[LiveViewer] No DVR content available yet, staying at live');
      await goToLive();
      return;
    }
    
    // Switch to DVR mode
    await switchToDvrMode(targetPosition);
  }
  
  async function seekRelative(deltaSeconds: number) {
    await seek(state.value.playbackPosition + deltaSeconds);
  }
  
  // Convenience seeking functions
  async function seekForward(seconds: number = 10) {
    await seek(state.value.playbackPosition + seconds);
  }
  
  async function seekBackward(seconds: number = 10) {
    await seek(Math.max(0, state.value.playbackPosition - seconds));
  }
  
  async function goToLive() {
    console.log('[LiveViewer] Going to live');
    
    // Cancel any pending seek
    if (seekAbortController) {
      seekAbortController.abort();
      seekAbortController = null;
    }
    
    state.value.isAtLiveEdge = true;
    state.value.playbackMode = 'live';
    state.value.playbackPosition = state.value.liveEdgeTime;
    state.value.playbackSpeed = 1;
    
    // Stop DVR playback and cleanup blob URLs
    if (dvrVideoElement.value) {
      dvrVideoElement.value.pause();
      dvrVideoElement.value.src = '';
      dvrVideoElement.value.load();
    }
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
      currentBlobUrl = null;
    }
    if (pendingBlobUrl) {
      URL.revokeObjectURL(pendingBlobUrl);
      pendingBlobUrl = null;
    }
    // Reset DVR data size so next DVR seek will reload
    currentDvrDataSize = 0;
    
    // Re-attach live tracks and resume playback
    if (videoElement.value && liveVideoTrack.value) {
      // Restore volume first (it was set to 0 in stopLivePlayback)
      videoElement.value.volume = state.value.volume;
      
      liveVideoTrack.value.attach(videoElement.value);
      if (liveAudioTrack.value) {
        liveAudioTrack.value.attach(videoElement.value);
      }
      // Restore audio settings (this will unmute if user preference is not muted)
      applyAudioSettings();
      // Ensure element is playing
      try {
        await videoElement.value.play();
      } catch (e) {
        console.log('[LiveViewer] Play error (might be normal for LiveKit):', e);
      }
      state.value.isPlaying = true;
    }
  }
  
  async function switchToDvrMode(targetPosition: number) {
    console.log('[LiveViewer] Switching to DVR mode at position:', targetPosition);
    console.log('[LiveViewer] Available segments:', state.value.availableSegments.length, 
                'Total recorded:', state.value.totalRecordedDuration);
    
    // First, check if we have ANY segments available
    if (state.value.availableSegments.length === 0) {
      console.warn('[LiveViewer] No DVR segments available, staying at live');
      await goToLive();
      return;
    }
    
    // Find the segment containing the target position
    const targetSegment = state.value.availableSegments.find(
      seg => targetPosition >= seg.startTime && targetPosition < seg.endTime
    );
    
    if (!targetSegment) {
      // No segment for this position - find nearest available
      console.warn('[LiveViewer] No segment found for position:', targetPosition);
      
      // Find the closest segment
      let closestSegment = state.value.availableSegments[0];
      let closestDistance = Math.abs(targetPosition - closestSegment.startTime);
      
      for (const seg of state.value.availableSegments) {
        const distStart = Math.abs(targetPosition - seg.startTime);
        const distEnd = Math.abs(targetPosition - seg.endTime);
        const dist = Math.min(distStart, distEnd);
        
        if (dist < closestDistance) {
          closestDistance = dist;
          closestSegment = seg;
        }
      }
      
      // If target is before all segments, go to earliest
      if (targetPosition < closestSegment.startTime) {
        console.log('[LiveViewer] Seeking to earliest available segment at:', closestSegment.startTime);
        state.value.isAtLiveEdge = false;
        state.value.playbackMode = 'dvr';
        state.value.playbackPosition = closestSegment.startTime;
        state.value.isBuffering = true;
        
        // Completely stop live playback
        stopLivePlayback();
        
        await playSegment(closestSegment, 0);
        return;
      }
      
      // Target is after all recorded content - go to live
      console.log('[LiveViewer] Target position is after all recorded content, going to live');
      await goToLive();
      return;
    }
    
    // We have a valid target segment
    state.value.isAtLiveEdge = false;
    state.value.playbackMode = 'dvr';
    state.value.playbackPosition = targetPosition;
    state.value.isBuffering = true;
    
    // Completely stop live playback
    stopLivePlayback();
    
    await playSegment(targetSegment, targetPosition - targetSegment.startTime);
  }
  
  // Track current blob URL for cleanup
  let currentBlobUrl: string | null = null;
  let pendingBlobUrl: string | null = null;
  let isSeekInProgress = false;
  let seekAbortController: AbortController | null = null;
  let currentDvrDataSize = 0; // Track if we need to reload
  
  async function playSegment(segment: SegmentInfo, seekTime: number = 0) {
    if (!dvrVideoElement.value) {
      console.warn('[LiveViewer] No DVR video element available');
      return;
    }
    
    // Cancel any pending seek operation
    if (seekAbortController) {
      seekAbortController.abort();
    }
    seekAbortController = new AbortController();
    const abortSignal = seekAbortController.signal;
    
    // If already seeking, wait a bit
    if (isSeekInProgress) {
      console.log('[LiveViewer] Seek already in progress, waiting...');
      await new Promise(resolve => setTimeout(resolve, 50));
      if (abortSignal.aborted) return;
    }
    
    isSeekInProgress = true;
    
    try {
      const mintId = state.value.mintId;
      
      if (!mintId) {
        console.error('[LiveViewer] No mint ID available for DVR playback');
        return;
      }
      
      // Calculate the absolute seek position within the recording
      const absoluteSeekTime = segment.startTime + seekTime;
      
      console.log(`[LiveViewer] Loading DVR for mint ${mintId}, seeking to ${absoluteSeekTime}s`);
      
      // Read ALL chunks concatenated for continuous playback
      // This ensures we have all keyframes available for proper decoding
      const chunkData = await invoke<number[]>('read_all_dvr_chunks', {
        mintId
      });
      
      // Check if aborted
      if (abortSignal.aborted) {
        console.log('[LiveViewer] Seek was aborted');
        return;
      }
      
      // Convert to Uint8Array and create blob URL
      const uint8Array = new Uint8Array(chunkData);
      const blob = new Blob([uint8Array], { type: 'video/webm' });
      
      console.log(`[LiveViewer] Created blob URL for concatenated DVR, size: ${uint8Array.length} bytes`);
      
      // Check if we need to reload (new data available) or just seek
      const needsReload = currentBlobUrl === null || uint8Array.length !== currentDvrDataSize;
      
      if (needsReload) {
        // Store the old URL to cleanup after the new one is loaded
        const oldBlobUrl = currentBlobUrl;
        pendingBlobUrl = URL.createObjectURL(blob);
        
        // Check if aborted again
        if (abortSignal.aborted) {
          URL.revokeObjectURL(pendingBlobUrl);
          pendingBlobUrl = null;
          return;
        }
        
        // Pause current video before changing source
        dvrVideoElement.value.pause();
        
        // Set the new source
        currentBlobUrl = pendingBlobUrl;
        pendingBlobUrl = null;
        currentDvrDataSize = uint8Array.length;
        dvrVideoElement.value.src = currentBlobUrl;
        
        // Wait for video to be ready
        await new Promise<void>((resolve, reject) => {
          const video = dvrVideoElement.value!;
          const timeoutId = setTimeout(() => {
            video.removeEventListener('canplay', onCanPlay);
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', onError);
            // Try to proceed anyway if metadata loaded
            if (video.readyState >= 1) {
              resolve();
            } else {
              reject(new Error('Video load timeout'));
            }
          }, 10000);
          
          const onCanPlay = () => {
            clearTimeout(timeoutId);
            video.removeEventListener('canplay', onCanPlay);
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', onError);
            resolve();
          };
          const onLoadedMetadata = () => {
            // Video metadata loaded - we might be able to start playing
            console.log('[LiveViewer] DVR metadata loaded, duration:', video.duration);
          };
          const onError = (e: Event) => {
            clearTimeout(timeoutId);
            video.removeEventListener('canplay', onCanPlay);
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', onError);
            const videoEl = e.target as HTMLVideoElement;
            console.error('[LiveViewer] Video error:', videoEl.error);
            reject(new Error('Video failed to load: ' + (videoEl.error?.message || 'unknown')));
          };
          video.addEventListener('canplay', onCanPlay);
          video.addEventListener('loadedmetadata', onLoadedMetadata);
          video.addEventListener('error', onError);
          // Trigger load
          video.load();
        });
        
        // Cleanup old URL after new one is ready
        if (oldBlobUrl) {
          URL.revokeObjectURL(oldBlobUrl);
        }
      }
      
      // Check if aborted
      if (abortSignal.aborted) {
        return;
      }
      
      // Seek to the target position
      console.log(`[LiveViewer] Seeking to ${absoluteSeekTime}s, video duration: ${dvrVideoElement.value.duration}`);
      dvrVideoElement.value.currentTime = absoluteSeekTime;
      dvrVideoElement.value.playbackRate = state.value.playbackSpeed;
      
      // Apply audio settings before AND after play to ensure they take effect
      applyAudioSettings();
      
      await dvrVideoElement.value.play();
      
      // Re-apply after play() in case browser reset them
      applyAudioSettings();
      
      state.value.isPlaying = true;
      state.value.isBuffering = false;
    } catch (error: any) {
      // Ignore abort errors
      if (error?.name === 'AbortError' || abortSignal.aborted) {
        console.log('[LiveViewer] Seek was cancelled');
        return;
      }
      console.error('[LiveViewer] Failed to play segment:', error);
      state.value.isBuffering = false;
    } finally {
      isSeekInProgress = false;
    }
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
    behindLiveSeconds,
    behindLiveFormatted,
    canSeekBackward,
    canSeekForward,
    availableClipDuration,
    availableDvrDuration,
    
    // Video elements
    videoElement,
    dvrVideoElement,
    
    // Connection
    connect,
    disconnect,
    
    // Element setup
    setVideoElement,
    setDvrVideoElement,
    
    // Playback controls
    play,
    pause,
    togglePlayPause,
    setVolume,
    setMuted,
    toggleMute,
    setPlaybackSpeed,
    cyclePlaybackSpeed,
    SUPPORTED_PLAYBACK_SPEEDS,
    
    // Seeking
    seek,
    seekRelative,
    seekForward,
    seekBackward,
    goToLive,
    
    // Utility
    updateAvailableSegments,
  };
}


