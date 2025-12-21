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
  recordingStartTime: number | null; // Unix timestamp in ms when stream originally started
  dvrStartTime: number | null; // Unix timestamp in ms when DVR recording started
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
  const trace = (...args: unknown[]) => console.log('[LiveViewer][Trace]', ...args);
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
    playbackMode: 'hls', // Always use HLS for consistent timeline/seek behavior
    bufferedRanges: [],
    sessionId: null,
    projectId: null,
    isTempRecording: false,
    tempSessionId: null,
    creatorProfile: null,
    watermarkId: null,
    watermarkSettings: null,
  });

  // Track if HLS is ready for playback (has at least one segment)
  const isHlsReady = ref(false);
  let lastDurationUpdate = 0;
  let lastDurationValue = 0;

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
  let standaloneAudioElement: HTMLAudioElement | null = null; // For audio-only streams
  let audioAlreadyAttached = false; // Prevent multiple audio attachments

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
      // Store recording start time in milliseconds for consistency with Date.now()
      state.value.recordingStartTime = liveStatus.streamStartTimestamp || Date.now();

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

      // Log all participants and their tracks immediately after connection
      console.log('[LiveViewer] Remote participants:', room.remoteParticipants.size);
      room.remoteParticipants.forEach((participant, sid) => {
        console.log(`[LiveViewer] Participant ${participant.identity} (${sid}):`);
        console.log(`  - Track publications: ${participant.trackPublications.size}`);
        participant.trackPublications.forEach((pub, trackSid) => {
          console.log(
            `    - Track ${trackSid}: kind=${pub.kind}, source=${pub.source}, subscribed=${pub.isSubscribed}, track=${!!pub.track}, simulcasted=${pub.simulcasted}`
          );
        });
      });

      // Attach any existing tracks (streamer may already be publishing)
      attachExistingTracks();

      state.value.connectionState = 'connected';
      reconnectAttempts = 0;

      // Video tracks sometimes arrive after initial connection - retry check after delay
      // This handles cases where video track publishes slightly after audio
      if (!remoteVideoTrack) {
        console.log('[LiveViewer] No video track yet, will retry in 2 seconds...');
        setTimeout(() => {
          if (!remoteVideoTrack && room?.state === 'connected') {
            console.log('[LiveViewer] Retrying video track attachment...');
            attachExistingTracks();

            // If still no video, log detailed participant info for debugging
            if (!remoteVideoTrack) {
              console.log('[LiveViewer] Still no video track. Checking all participants:');
              room?.remoteParticipants.forEach((participant) => {
                console.log(`[LiveViewer] Participant ${participant.identity}:`);
                participant.trackPublications.forEach((pub) => {
                  console.log(
                    `  - Track ${pub.trackSid}: kind=${pub.kind}, source=${pub.source}, subscribed=${pub.isSubscribed}, hasTrack=${!!pub.track}`
                  );
                });
              });
            }
          }
        }, 2000);
      }

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

      // Note: HLS playback initialization is handled by the hlsOutputDir watcher
      // This ensures proper sequencing after the recording output dir is set
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

    // Track published - video might arrive after audio, need to handle this
    room.on(RoomEvent.TrackPublished, (publication, participant) => {
      console.log(
        '[LiveViewer] Track published:',
        publication.kind,
        'source:',
        publication.source,
        'from:',
        participant.identity,
        'subscribed:',
        publication.isSubscribed
      );

      // If track isn't subscribed yet and we need it, subscribe manually
      // This handles cases where auto-subscribe didn't work
      if (!publication.isSubscribed && publication.kind === Track.Kind.Video && !remoteVideoTrack) {
        console.log('[LiveViewer] Video track published but not subscribed, subscribing manually...');
        publication.setSubscribed(true);
      }
    });

    // Connection events
    room.on(RoomEvent.Disconnected, handleDisconnected);
    room.on(RoomEvent.Reconnecting, handleReconnecting);
    room.on(RoomEvent.Reconnected, handleReconnected);
    room.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log('[LiveViewer] Participant connected:', participant.identity);
      updateViewerCount();

      // Check if the participant has tracks we need
      participant.trackPublications.forEach((publication) => {
        console.log(
          '[LiveViewer] Participant track:',
          publication.kind,
          'subscribed:',
          publication.isSubscribed
        );
        if (publication.kind === Track.Kind.Video && !publication.isSubscribed && !remoteVideoTrack) {
          console.log('[LiveViewer] Found unsubscribed video track, subscribing...');
          publication.setSubscribed(true);
        }
      });
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

    console.log('[LiveViewer] Checking existing tracks, participants:', room.remoteParticipants.size);

    room.remoteParticipants.forEach((participant) => {
      console.log(
        '[LiveViewer] Participant:',
        participant.identity,
        'tracks:',
        participant.trackPublications.size
      );

      participant.trackPublications.forEach((publication) => {
        console.log(
          '[LiveViewer] Track publication:',
          publication.kind,
          'source:',
          publication.source,
          'subscribed:',
          publication.isSubscribed,
          'hasTrack:',
          !!publication.track
        );

        if (publication.track && publication.isSubscribed) {
          if (publication.track.kind === Track.Kind.Video) {
            console.log('[LiveViewer] Found subscribed video track, attaching...');
            remoteVideoTrack = publication.track as RemoteVideoTrack;
            attachVideoTrack();
          } else if (publication.track.kind === Track.Kind.Audio) {
            console.log('[LiveViewer] Found subscribed audio track, attaching...');
            remoteAudioTrack = publication.track as RemoteAudioTrack;
            attachAudioTrack();
          }
        } else if (publication.kind === Track.Kind.Video && !publication.isSubscribed) {
          // Video track exists but not subscribed - subscribe to it
          console.log('[LiveViewer] Found unsubscribed video track, subscribing...');
          publication.setSubscribed(true);
        }
      });
    });
  }

  // NOTE: WebRTC video track is received but NOT displayed to user
  // We use HLS-only playback for consistent timeline/seek behavior
  // This function just stores the track reference for the recorder
  function attachVideoTrack() {
    if (!remoteVideoTrack) {
      console.log('[LiveViewer] No video track received');
      return;
    }

    console.log('[LiveViewer] WebRTC video track received (HLS-only mode - not displaying WebRTC)');

    // Get video quality info from track settings
    const settings = remoteVideoTrack.mediaStreamTrack?.getSettings();
    if (settings?.width && settings?.height) {
      state.value.streamQuality = `${settings.width}x${settings.height}`;
    }
    
    // NOTE: We intentionally do NOT attach the track to the video element
    // User will see the HLS playback instead, which provides consistent DVR experience
  }

  // NOTE: WebRTC audio track is received but NOT played directly to user
  // Audio comes through HLS playback for consistent DVR experience
  // This function just stores the track reference for the recorder
  function attachAudioTrack() {
    if (!remoteAudioTrack) {
      console.log('[LiveViewer] No audio track received');
      return;
    }

    console.log('[LiveViewer] WebRTC audio track received (HLS-only mode - audio via HLS)');
    
    // NOTE: We intentionally do NOT attach the audio track
    // Audio will come through HLS playback for consistent DVR experience
    audioAlreadyAttached = true;
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
    standaloneAudioElement = null;
    audioAlreadyAttached = false;
  }

  // NOTE: switchToWebRTC is deprecated - we always use HLS for playback
  // This function now just seeks to the live edge of HLS
  async function switchToWebRTC() {
    console.log('[LiveViewer] switchToWebRTC() called - seeking to HLS live edge instead');
    await seekToLiveEdgeHls();
  }

  // Ensure HLS is initialized and playing
  async function ensureHlsPlaying(seekPosition?: number) {
    // Initialize HLS if not already done
    if (hlsVideoElement.value && hlsOutputDir.value && !hlsPlayback.state.value.isInitialized) {
      console.log('[LiveViewer] Initializing HLS playback...');
      await hlsPlayback.initialize(hlsVideoElement.value, hlsOutputDir.value);
    }

    // Refresh playlist and seek if position provided
    if (seekPosition !== undefined) {
      console.log('[LiveViewer] Seeking HLS to position:', seekPosition);
      hlsPlayback.refreshPlaylist(seekPosition);
    }

    // Play HLS
    await hlsPlayback.play();
  }

  // Seek to the live edge of HLS (end of recorded content)
  async function seekToLiveEdgeHls() {
    if (!hlsPlayback.state.value.isInitialized) {
      console.log('[LiveViewer] HLS not ready yet for live edge seek');
      return;
    }

    const duration = hlsPlayback.state.value.duration;
    if (duration > 0) {
      // Seek to near the end (leave 1 second buffer)
      const liveEdgePosition = Math.max(0, duration - 1);
      console.log('[LiveViewer] Seeking to HLS live edge:', liveEdgePosition);
      
      hlsPlayback.refreshPlaylist(liveEdgePosition);
      await hlsPlayback.seek(liveEdgePosition);
      
      state.value.isAtLiveEdge = true;
    }
  }

  // Switch to HLS playback mode (this is now the only mode)
  async function switchToHLS(seekPosition?: number) {
    console.log('[LiveViewer] switchToHLS() called, seekPosition:', seekPosition);
    state.value.playbackMode = 'hls';
    
    await ensureHlsPlaying(seekPosition);
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
    console.log('[LiveViewer] Initializing HLS playback (DVR)...');

    // Apply audio settings before initializing
    hlsPlayback.setVolume(state.value.volume);
    hlsPlayback.setMuted(state.value.isMuted);

    try {
      const success = await hlsPlayback.initialize(hlsElement, hlsOutputDir.value);

      if (success) {
        console.log('[LiveViewer] HLS/DVR playback ready');
        // Don't start playing - we're in WebRTC mode by default
        // HLS will start when user seeks backwards
        if (state.value.playbackMode === 'webrtc') {
          hlsPlayback.pause(); // Ensure HLS is paused while WebRTC is active
        }
      } else {
        // HLS is a backup feature - only warn, don't set error state
        // WebRTC provides live playback, HLS provides DVR/seeking
        console.warn('[LiveViewer] HLS/DVR not available - live playback still works via WebRTC');
        // Only set error if explicitly in HLS mode AND WebRTC isn't working
        if (state.value.playbackMode === 'hls' && !remoteVideoTrack) {
          state.value.connectionError =
            hlsPlayback.state.value.error || 'DVR playback not available';
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
      // Use dvrStartTime (when HLS recording started) for timeline
      // This represents what the user can actually seek within
      const referenceTime = state.value.dvrStartTime;

      // NOTE: In HLS-only mode, the actual timeline comes from HLS duration
      // This interval now only serves as a fallback while HLS is loading
      if (!isHlsReady.value && referenceTime) {
        const now = Date.now();
        const estimatedDuration = Math.floor((now - referenceTime) / 1000);
        // Show estimated loading time in console for debugging
        if (estimatedDuration > 0 && estimatedDuration % 5 === 0) {
          console.log('[LiveViewer] Waiting for HLS... estimated time:', estimatedDuration, 's');
        }
        trace('liveEdgeUpdate', { referenceTime, estimatedDuration });
      }
    }, 1000);
  }

  // Sync playback state from HLS (always HLS-only mode now)
  function startPlaybackSync() {
    if (playbackSyncInterval) {
      clearInterval(playbackSyncInterval);
    }

    playbackSyncInterval = window.setInterval(() => {
      // Always sync from HLS playback
      const ps = hlsPlayback.state.value;
      state.value.isPlaying = ps.isPlaying;
      state.value.isBuffering = ps.isBuffering || !isHlsReady.value;
      state.value.playbackPosition = ps.currentTime;
      state.value.bufferedRanges = ps.bufferedRanges;
      
      // Latency is the delay from real-time (HLS segments are ~5s behind WebRTC)
      // Show as ~5 seconds plus any hls.js buffering latency
      state.value.latencyMs = 5000 + (ps.latency * 1000);

      // Timeline always reflects actual HLS content duration
      const actualHlsDuration = ps.duration > 0 ? ps.duration : 0;
      
      // Start playback as soon as we have at least 2 segments (8s)
      // This prevents the "deadlock" where we wait for more duration, 
      // but hls.js stops polling because it's paused.
      const MIN_BUFFER_DURATION = 8; 
      
      if (actualHlsDuration >= MIN_BUFFER_DURATION) {
        // HLS has enough content for smooth playback
        state.value.liveEdgeTime = actualHlsDuration;
        state.value.totalRecordedDuration = actualHlsDuration;
        
        // Mark HLS as ready once we have enough buffer
        if (!isHlsReady.value) {
          isHlsReady.value = true;
          console.log('[LiveViewer] HLS is ready with duration:', actualHlsDuration);
          
          // Start playback
          hlsPlayback.play();
        }
        
        // Check if at live edge (within 2 seconds of end)
        state.value.isAtLiveEdge = ps.isAtLiveEdge || (ps.currentTime >= ps.duration - 2);
      } else if (actualHlsDuration > 0) {
        // HLS has some content but not enough for smooth playback
        // We still consider this "buffering" state for UI, but we SHOULD ensure hls.js is active
        state.value.liveEdgeTime = actualHlsDuration;
        state.value.totalRecordedDuration = actualHlsDuration;
        state.value.isBuffering = true;
        console.log(`[LiveViewer] Buffering... ${actualHlsDuration.toFixed(1)}s / ${MIN_BUFFER_DURATION}s`);
        
        // CRITICAL FIX: If we have ANY content, start playing (muted/hidden) to force hls.js to poll playlist
        // otherwise it might stop polling and we get stuck at 4s duration forever
        if (!isHlsReady.value && !state.value.isPlaying) {
           console.log('[LiveViewer] Force starting playback to keep playlist polling active');
           hlsPlayback.play();
        }

        // Check for stuck buffering (if duration doesn't increase for > 10s)
        const now = Date.now();
        if (!lastDurationUpdate) {
          lastDurationUpdate = now;
          lastDurationValue = actualHlsDuration;
        } else if (actualHlsDuration > lastDurationValue) {
          // Duration increased, reset stuck timer
          lastDurationUpdate = now;
          lastDurationValue = actualHlsDuration;
        } else if (now - lastDurationUpdate > 10000) {
          // Stuck at same duration for > 10s while buffering
          console.warn('[LiveViewer] Buffering stuck, forcing playlist refresh...');
          hlsPlayback.refreshPlaylist(state.value.playbackPosition);
          lastDurationUpdate = now; // Reset timer to avoid spamming refresh
        }
      } else if (state.value.dvrStartTime) {
        // HLS not ready yet - show buffering state
        state.value.liveEdgeTime = 0;
        state.value.totalRecordedDuration = 0;
        state.value.isAtLiveEdge = true;
        state.value.isBuffering = true;
      }

      // Sync error state
      if (ps.error && !state.value.connectionError) {
        state.value.connectionError = ps.error;
      }

      trace('playbackSync', {
        position: ps.currentTime,
        duration: ps.duration,
        liveEdge: state.value.liveEdgeTime,
        totalRecorded: state.value.totalRecordedDuration,
        isPlaying: state.value.isPlaying,
        isBuffering: state.value.isBuffering,
        isAtLiveEdge: state.value.isAtLiveEdge,
        latencyMs: state.value.latencyMs,
        bufferedRanges: ps.bufferedRanges,
      });
    }, 100);
  }

  // Segment polling for HLS
  function startSegmentPolling() {
    if (segmentPollInterval) {
      clearInterval(segmentPollInterval);
    }

    // Poll to update available segments info (for clipping)
    segmentPollInterval = window.setInterval(async () => {
      trace('segmentPoll tick');
      await updateAvailableSegments();
    }, 2000); // HLS handles its own playlist updates, poll less frequently

    // Initial poll
    updateAvailableSegments();
  }

  async function updateAvailableSegments() {
    // For HLS recordings, update from the recording directory
    if (hlsOutputDir.value) {
      trace('updateAvailableSegments (temp recording) start', { hlsOutputDir: hlsOutputDir.value });
      await updateHlsSegments();
      trace('updateAvailableSegments (temp recording) done', {
        segments: state.value.availableSegments.length,
        totalRecordedDuration: state.value.totalRecordedDuration,
      });
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
    state.value.playbackMode = 'hls'; // Always HLS mode
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
    
    // Reset HLS ready state
    isHlsReady.value = false;

    // NOTE: Do NOT reset isIntentionalDisconnect here - async events may still fire
    // after disconnect completes. We reset it in connect() instead.

    console.log('[LiveViewer] Disconnect complete');
  }

  // Set video element reference (legacy - not used in HLS-only mode)
  function setVideoElement(element: HTMLVideoElement | null) {
    console.log('[LiveViewer] setVideoElement called, element:', !!element);
    videoElement.value = element;
    // NOTE: In HLS-only mode, we don't attach WebRTC tracks to video element
    // Video comes from HLS playback via hlsVideoElement
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
      // WebRTC is always "playing" when connected
      // Try to play both video element and standalone audio element
      if (videoElement.value) {
        try {
          await videoElement.value.play();
        } catch (e) {
          console.warn('[LiveViewer] WebRTC video play failed:', e);
        }
      }

      // Also try standalone audio element for audio-only streams
      if (standaloneAudioElement && standaloneAudioElement.paused) {
        try {
          await standaloneAudioElement.play();
          console.log('[LiveViewer] Standalone audio playback started');
        } catch (e) {
          console.warn('[LiveViewer] Standalone audio play failed:', e);
        }
      }

      state.value.isPlaying = true;
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
      }

      // Also pause standalone audio element
      if (standaloneAudioElement) {
        standaloneAudioElement.pause();
      }

      state.value.isPlaying = false;
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

  // Seek to a specific time (always uses HLS)
  async function seek(time: number) {
    const hlsDuration = hlsPlayback.state.value.duration;
    console.log('[LiveViewer] seek() called:', time, 'hlsDuration:', hlsDuration);
    trace('seek called', { requested: time, hlsDuration, isInitialized: hlsPlayback.state.value.isInitialized });

    if (!hlsPlayback.state.value.isInitialized) {
      console.log('[LiveViewer] HLS not ready, cannot seek');
      return;
    }

    // Check if seeking to near the live edge (within 2 seconds of end)
    const isSeekingToLiveEdge = hlsDuration > 0 && time >= hlsDuration - 2;
    
    console.log('[LiveViewer] seek analysis:', { isSeekingToLiveEdge, hlsDuration, seekTime: time });
    trace('seek analysis', { isSeekingToLiveEdge, hlsDuration, seekTime: time });

    if (isSeekingToLiveEdge) {
      // Seeking to live edge - go to end of HLS
      console.log('[LiveViewer] Seeking to HLS live edge');
      await seekToLive();
    } else {
      // Seeking within available content
      // Clamp to valid range
      const clampedTime = Math.max(0, Math.min(time, hlsDuration > 0 ? hlsDuration - 0.5 : time));
      
      console.log('[LiveViewer] Seeking to position:', clampedTime);
      trace('seek clamped', { clampedTime });
      
      // Ensure HLS is playing
      await ensureHlsPlaying();
      trace('seek ensureHlsPlaying done');
      
      // Seek to position
      await hlsPlayback.seek(clampedTime);
      trace('seek completed', { target: clampedTime, current: hlsPlayback.state.value.currentTime, duration: hlsPlayback.state.value.duration });
      state.value.isAtLiveEdge = false;
    }
  }

  // Seek to live edge - position a few segments behind the actual end for buffer
  async function seekToLive() {
    console.log('[LiveViewer] seekToLive() called');
    trace('seekToLive start', { initialized: hlsPlayback.state.value.isInitialized });

    if (!hlsPlayback.state.value.isInitialized) {
      console.log('[LiveViewer] HLS not ready, cannot seek to live');
      return;
    }

    // For live streaming, "live edge" means a few segments behind the actual end
    // This ensures we have buffer ahead for smooth playback
    // Position at 2 segments (8s) from end for optimal live viewing
    const duration = hlsPlayback.state.value.duration;
    const livePosition = Math.max(0, duration - 8); // 2 segments behind
    
    console.log('[LiveViewer] Seeking to live position:', livePosition, 'duration:', duration);
    trace('seekToLive target', { livePosition, duration });
    await hlsPlayback.seek(livePosition);
    trace('seekToLive done', { current: hlsPlayback.state.value.currentTime, duration: hlsPlayback.state.value.duration });
    state.value.isAtLiveEdge = true;
  }

  // Volume controls (HLS-only mode - audio comes from HLS)
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
    // HLS-only mode - audio controlled via HLS playback
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
  // Note: initializeHlsPlayback() has guards against duplicate initialization
  watch(
    () => hlsOutputDir.value,
    async (outputDir, oldOutputDir) => {
      // Only initialize if this is a new output dir (not just reconnecting to same stream)
      if (
        outputDir &&
        outputDir !== oldOutputDir &&
        videoElement.value &&
        state.value.connectionState === 'connected' &&
        !hlsPlayback.state.value.isInitialized
      ) {
        // Small delay to let FFmpeg start creating files
        await new Promise((r) => setTimeout(r, 500));
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
