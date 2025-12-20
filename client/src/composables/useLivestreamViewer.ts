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
import { useTempLivestreamRecording, type TempSegmentInfo } from './useTempLivestreamRecording';

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
  
  // DVR Timeline
  recordingStartTime: number | null; // Unix timestamp when recording started
  liveEdgeTime: number; // Current live edge in seconds from stream start
  playbackPosition: number; // Current playback position in seconds from stream start
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
  const { activeSessions, monitoredStreamers, startMonitoring, stopMonitoring, tempRecordingSessions } = useLivestreamMonitoring();
  
  // Get the temp recording composable
  const tempRecording = useTempLivestreamRecording();
  
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
  const canSeekBackward = computed(() => state.value.playbackPosition > 0);
  const canSeekForward = computed(() => !state.value.isAtLiveEdge);
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
      
      // Start auto-recording if enabled
      if (autoStartRecording) {
        await ensureRecordingStarted(streamerId, mintId, displayName, profileImageUrl);
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
  
  // Ensure recording is started for clipping/DVR capability
  // This now uses TEMP recording by default (no persistent project created)
  async function ensureRecordingStarted(
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
    
    // Check if already has temp recording from monitoring
    const tempSession = tempRecordingSessions.value.get(streamerId);
    if (tempSession) {
      state.value.tempSessionId = tempSession.tempSessionId;
      state.value.isTempRecording = true;
      state.value.projectId = null; // No project for temp recording
      console.log('[LiveViewer] Using existing temp recording session:', tempSession.tempSessionId);
      return;
    }
    
    // Start temp recording for DVR (NOT persistent recording)
    // This allows users to watch and clip without creating a project
    try {
      const tempSessionId = await tempRecording.startTempRecording(mintId, 3);
      state.value.tempSessionId = tempSessionId;
      state.value.isTempRecording = true;
      state.value.projectId = null;
      console.log('[LiveViewer] Started temp recording for DVR:', tempSessionId);
    } catch (error) {
      console.warn('[LiveViewer] Failed to start temp recording:', error);
      // Even if temp recording fails, we can still watch live (just no DVR)
    }
  }
  
  // Live edge update timer
  function startLiveEdgeUpdates() {
    if (liveEdgeUpdateInterval) {
      clearInterval(liveEdgeUpdateInterval);
    }
    
    liveEdgeUpdateInterval = window.setInterval(() => {
      if (state.value.recordingStartTime) {
        const now = Math.floor(Date.now() / 1000);
        state.value.liveEdgeTime = now - state.value.recordingStartTime;
        
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
    // For temp recordings, get segments from the temp recording composable
    if (state.value.isTempRecording && state.value.mintId) {
      const tempSegments = tempRecording.getSegments(state.value.mintId);
      if (tempSegments.length > 0) {
        // Convert TempSegmentInfo to SegmentInfo (they're the same structure)
        state.value.availableSegments = tempSegments.map(seg => ({
          segmentNumber: seg.segmentNumber,
          filePath: seg.filePath,
          startTime: seg.startTime,
          duration: seg.duration,
          endTime: seg.endTime,
        }));
        state.value.totalRecordedDuration = tempRecording.getTotalDuration(state.value.mintId);
      }
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
    
    // Listen for temp recording segments (for watch-only DVR)
    const tempUnlisten = await listen<{
      mintId: string;
      tempSessionId: string;
      segment: number;
      path: string;
      duration: number;
    }>('temp-segment-ready', (event) => {
      if (event.payload.mintId === state.value.mintId && state.value.isTempRecording) {
        // Update temp session ID if not set
        if (!state.value.tempSessionId) {
          state.value.tempSessionId = event.payload.tempSessionId;
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
        
        console.log(`[LiveViewer] Temp segment ${event.payload.segment} ready, total duration: ${state.value.totalRecordedDuration}s`);
      }
    });
    
    // Listen for temp stream ended (for watch-only DVR)
    const tempStreamEndedUnlisten = await listen<{
      mintId: string;
      tempSessionId: string;
    }>('temp-stream-ended', (event) => {
      if (event.payload.mintId === state.value.mintId && state.value.isTempRecording) {
        console.log('[LiveViewer] Temp stream ended, stream is no longer live');
        // The stream has ended - we can still use DVR but no more new segments will arrive
        // Connection state change will be handled by LiveKit room events
      }
    });
    
    unlistenFunctions.push(unlisten, tempUnlisten, tempStreamEndedUnlisten);
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
      // Update playback position based on current segment
      const currentSegment = getCurrentDvrSegment();
      if (currentSegment) {
        state.value.playbackPosition = currentSegment.startTime + dvrVideoElement.value.currentTime;
      }
    }
  }
  
  function handleDvrEnded() {
    if (state.value.playbackMode === 'dvr') {
      // Try to play next segment or go to live
      const nextSegment = getNextDvrSegment();
      if (nextSegment) {
        playSegment(nextSegment);
      } else {
        // No more segments, go to live
        goToLive();
      }
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
    state.value.volume = Math.max(0, Math.min(1, volume));
    saveVolumePreference(state.value.volume);
    applyAudioSettings();
  }
  
  function setMuted(muted: boolean) {
    state.value.isMuted = muted;
    saveMutedPreference(muted);
    applyAudioSettings();
  }
  
  function toggleMute() {
    setMuted(!state.value.isMuted);
  }
  
  function applyAudioSettings() {
    if (videoElement.value) {
      videoElement.value.volume = state.value.volume;
      videoElement.value.muted = state.value.isMuted;
    }
    if (dvrVideoElement.value) {
      dvrVideoElement.value.volume = state.value.volume;
      dvrVideoElement.value.muted = state.value.isMuted;
    }
  }
  
  // Playback speed (DVR only)
  function setPlaybackSpeed(speed: number) {
    if (state.value.playbackMode === 'dvr') {
      state.value.playbackSpeed = speed;
      if (dvrVideoElement.value) {
        dvrVideoElement.value.playbackRate = speed;
      }
    }
  }
  
  // Seeking
  async function seek(positionSeconds: number) {
    const targetPosition = Math.max(0, Math.min(positionSeconds, state.value.liveEdgeTime));
    
    // Check if seeking to live edge
    if (targetPosition >= state.value.liveEdgeTime - 5) {
      await goToLive();
      return;
    }
    
    // Switch to DVR mode
    await switchToDvrMode(targetPosition);
  }
  
  async function seekRelative(deltaSeconds: number) {
    await seek(state.value.playbackPosition + deltaSeconds);
  }
  
  async function goToLive() {
    console.log('[LiveViewer] Going to live');
    
    state.value.isAtLiveEdge = true;
    state.value.playbackMode = 'live';
    state.value.playbackPosition = state.value.liveEdgeTime;
    state.value.playbackSpeed = 1;
    
    // Stop DVR playback
    if (dvrVideoElement.value) {
      dvrVideoElement.value.pause();
      dvrVideoElement.value.src = '';
    }
    
    // Attach live tracks
    if (videoElement.value && liveVideoTrack.value) {
      liveVideoTrack.value.attach(videoElement.value);
      if (liveAudioTrack.value) {
        liveAudioTrack.value.attach(videoElement.value);
      }
      applyAudioSettings();
      state.value.isPlaying = true;
    }
  }
  
  async function switchToDvrMode(targetPosition: number) {
    console.log('[LiveViewer] Switching to DVR mode at position:', targetPosition);
    
    state.value.isAtLiveEdge = false;
    state.value.playbackMode = 'dvr';
    state.value.playbackPosition = targetPosition;
    state.value.isBuffering = true;
    
    // Detach live tracks
    if (liveVideoTrack.value && videoElement.value) {
      liveVideoTrack.value.detach(videoElement.value);
    }
    if (liveAudioTrack.value && videoElement.value) {
      liveAudioTrack.value.detach(videoElement.value);
    }
    
    // Find the segment containing the target position
    const targetSegment = state.value.availableSegments.find(
      seg => targetPosition >= seg.startTime && targetPosition < seg.endTime
    );
    
    if (targetSegment) {
      await playSegment(targetSegment, targetPosition - targetSegment.startTime);
    } else {
      console.warn('[LiveViewer] No segment found for position:', targetPosition);
      state.value.isBuffering = false;
    }
  }
  
  async function playSegment(segment: SegmentInfo, seekTime: number = 0) {
    if (!dvrVideoElement.value) {
      console.warn('[LiveViewer] No DVR video element available');
      return;
    }
    
    try {
      // Get video URL from local server
      const port = await invoke<number>('get_video_server_port');
      const encodedPath = btoa(unescape(encodeURIComponent(segment.filePath)));
      const videoUrl = `http://localhost:${port}/video/${encodedPath}`;
      
      dvrVideoElement.value.src = videoUrl;
      dvrVideoElement.value.currentTime = seekTime;
      dvrVideoElement.value.playbackRate = state.value.playbackSpeed;
      applyAudioSettings();
      
      await dvrVideoElement.value.play();
      state.value.isPlaying = true;
      state.value.isBuffering = false;
    } catch (error) {
      console.error('[LiveViewer] Failed to play segment:', error);
      state.value.isBuffering = false;
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
    
    // Seeking
    seek,
    seekRelative,
    goToLive,
    
    // Utility
    updateAvailableSegments,
  };
}

