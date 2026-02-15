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
import { getUserAssignedCreatorProfiles } from '@/services/organizationProfilesApi';
import type {
  LiveStatus,
  LiveSession,
  SegmentEventPayload,
  SupportedLivestreamPlatform,
} from '@/types/livestream';
import { useLivestreamMonitoring } from './useLivestreamMonitoring';
import { useHlsPlayback } from './useHlsPlayback';
import {
  checkKickLivestream,
  startKickRecording,
  stopKickRecording,
  extractChannelSlug,
} from '@/services/kick';
import {
  checkTwitchLivestream,
  startTwitchRecording,
  stopTwitchRecording,
  extractChannelName as extractTwitchChannelName,
  getTwitchSessionOutputDir,
} from '@/services/twitch';

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
export type PlaybackMode = 'webrtc' | 'hls' | 'iframe';

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
  platform: SupportedLivestreamPlatform;
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

  // Kick embed (iframe-based playback due to origin restrictions)
  kickEmbedUrl: string | null;
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
    getKickDvrSession,
    getTwitchDvrSession,
    addKickDvrSession,
    addTwitchDvrSession,
    removeKickDvrSession,
    removeTwitchDvrSession,
  } = useLivestreamMonitoring();

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
    platform: 'PumpFun',
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
    kickEmbedUrl: null,
  });

  // Track if HLS is ready for playback (has at least one segment)
  const isHlsReady = ref(false);
  let lastDurationUpdate = 0;
  let lastDurationValue = 0;
  let displayDuration = 0; // Smoothed duration to avoid UI jumps when new segments arrive
  let lastDisplayUpdate = Date.now();
  const DURATION_SMOOTH_RATE = 1.0; // seconds of display growth per real second

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

  // Segment stall detection for Kick HLS
  let lastSegmentCount = 0;
  let lastSegmentTime = Date.now();
  let isRestartingRecorder = false;
  let recorderRestartCount = 0;
  const MAX_RECORDER_RESTARTS = 3; // Stop trying after 3 failed restarts
  const SEGMENT_STALL_THRESHOLD = 30000; // 30 seconds without new segments = stalled
  let streamHasEnded = false; // Flag to indicate stream has ended

  // Update timers
  let liveEdgeUpdateInterval: number | null = null;
  let segmentPollInterval: number | null = null;
  let playbackSyncInterval: number | null = null;
  let segmentUpdateDebounceTimer: number | null = null;

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
    console.log('[LiveViewer] loadCreatorProfile called for mintId:', mintId);
    try {
      let profile = await getCreatorProfileByPlatformId('pumpfun', mintId);
      console.log(
        '[LiveViewer] Profile lookup result:',
        profile ? `Found: ${profile.name}` : 'Not found'
      );

      // Fallback: some stream IDs include a trailing "pump" suffix; try without it
      if (!profile && mintId.toLowerCase().endsWith('pump')) {
        const trimmedMint = mintId.slice(0, -4);
        console.log('[LiveViewer] Retry profile lookup without pump suffix:', trimmedMint);
        profile = await getCreatorProfileByPlatformId('pumpfun', trimmedMint);
        console.log(
          '[LiveViewer] Fallback lookup result:',
          profile ? `Found: ${profile.name}` : 'Not found'
        );
      }

      // Last-resort: check org-assigned creator profiles (server-side) for the current user
      if (!profile) {
        try {
          const assigned = await getUserAssignedCreatorProfiles();
          if (assigned.success && assigned.profiles?.length) {
            const normalize = (val: string | null | undefined) => val?.trim().toLowerCase() || '';
            const stripPump = (val: string) =>
              val.toLowerCase().endsWith('pump') ? val.slice(0, -4) : val;
            const candidates = Array.from(
              new Set([normalize(mintId), normalize(stripPump(mintId))])
            ).filter(Boolean);

            const orgMatch = assigned.profiles.find((p) =>
              p.platform_links?.some((link) => {
                const linkNorm = normalize(link.platform_id);
                const linkNormStripped = normalize(stripPump(link.platform_id));
                return (
                  candidates.includes(linkNorm) ||
                  candidates.includes(linkNormStripped) ||
                  linkNorm === candidates[0] ||
                  linkNormStripped === candidates[0]
                );
              })
            );

            if (orgMatch) {
              console.log('[LiveViewer] Found org-assigned creator profile:', orgMatch.name);

              // Adapt org profile shape to local expectations and prefix org watermark IDs
              const settingsObj = orgMatch.watermark_settings || null;
              const perRatioRaw =
                settingsObj && typeof settingsObj === 'object'
                  ? (settingsObj as Record<string, any>)
                  : null;

              // Prefix all per-ratio watermarkIds with org-asset-
              let perRatio: Record<string, any> | null = null;
              if (perRatioRaw) {
                perRatio = {};
                for (const [ratio, cfg] of Object.entries(perRatioRaw)) {
                  if (cfg && typeof cfg === 'object') {
                    const ratioCfg = cfg as { watermarkId?: number | string; position?: any };
                    perRatio[ratio] = {
                      ...ratioCfg,
                      watermarkId:
                        ratioCfg.watermarkId != null ? `org-asset-${ratioCfg.watermarkId}` : null,
                    };
                  } else {
                    perRatio[ratio] = cfg;
                  }
                }
              }

              const ratio16 = perRatio?.['16:9'];
              const ratioWatermarkId =
                ratio16?.watermarkId != null ? String(ratio16.watermarkId) : null;

              profile = {
                // Minimal fields needed downstream
                id: String(orgMatch.id),
                name: orgMatch.name,
                description: orgMatch.description || null,
                profile_image_path: null,
                intro_id: null,
                outro_id: null,
                watermark_id:
                  ratioWatermarkId ||
                  (orgMatch.watermark_id != null ? `org-asset-${orgMatch.watermark_id}` : null),
                watermark_settings: perRatio ? JSON.stringify(perRatio) : null,
                user_id: null,
                created_at: Date.now(),
                updated_at: Date.now(),
                platform_links:
                  orgMatch.platform_links?.map((l) => ({
                    ...l,
                    id: String(l.id ?? l.platform_id ?? Math.random()),
                    creator_profile_id: String(orgMatch.id),
                    platform_id: l.platform_id,
                    platform: l.platform as any,
                    display_name: l.display_name || null,
                    profile_image_url: l.profile_image_url || null,
                    is_primary: l.is_primary ?? false,
                    created_at: Date.now(),
                    updated_at: Date.now(),
                  })) || [],
              } as unknown as CreatorProfileWithLinks;
            }
          }
        } catch (err) {
          console.warn('[LiveViewer] Failed to query org-assigned profiles', err);
        }
      }

      if (profile) {
        state.value.creatorProfile = profile;

        console.log('[LiveViewer] Profile watermark data:', {
          watermark_id: profile.watermark_id,
          watermark_settings: profile.watermark_settings,
        });

        // Parse watermark settings - stored per-aspect-ratio
        if (profile.watermark_settings) {
          try {
            const perRatioSettings = JSON.parse(profile.watermark_settings);
            console.log('[LiveViewer] Parsed per-ratio settings:', perRatioSettings);

            // Get 16:9 settings for livestream display
            const settings16x9 = perRatioSettings?.['16:9'];
            console.log('[LiveViewer] 16:9 settings:', settings16x9);

            if (settings16x9) {
              // Use the watermarkId from the 16:9 settings, falling back to top-level watermark_id
              state.value.watermarkId = settings16x9.watermarkId || profile.watermark_id;

              // Flatten the position settings for the viewer component
              // The viewer expects { position: { x, y }, scale, opacity }
              // Support isFullFrameOverlay either at the ratio level or nested in position
              const isFullFrameOverlay =
                settings16x9.isFullFrameOverlay ??
                settings16x9.position?.isFullFrameOverlay ??
                false;

              if (settings16x9.position) {
                state.value.watermarkSettings = {
                  position: {
                    x: settings16x9.position.x ?? 50,
                    y: settings16x9.position.y ?? 50,
                  },
                  scale: settings16x9.position.scale ?? 20,
                  opacity: settings16x9.position.opacity ?? 80,
                  isFullFrameOverlay,
                };
              } else {
                // No position settings, use defaults
                state.value.watermarkSettings = {
                  position: { x: 12, y: 92 },
                  scale: 20,
                  opacity: 80,
                  isFullFrameOverlay: false,
                };
              }
            } else {
              // No 16:9 settings - watermark disabled for this aspect ratio
              console.log('[LiveViewer] No 16:9 settings found, watermark disabled');
              state.value.watermarkId = null;
              state.value.watermarkSettings = null;
            }
          } catch (parseError) {
            console.warn('[LiveViewer] Failed to parse watermark_settings:', parseError);
            state.value.watermarkId = profile.watermark_id;
            state.value.watermarkSettings = profile.watermark_id
              ? {
                  position: { x: 12, y: 92 },
                  scale: 20,
                  opacity: 80,
                }
              : null;
          }
        } else {
          // No watermark_settings at all, use top-level watermark_id
          console.log(
            '[LiveViewer] No watermark_settings, using top-level watermark_id:',
            profile.watermark_id
          );
          state.value.watermarkId = profile.watermark_id;
          state.value.watermarkSettings = profile.watermark_id
            ? {
                position: { x: 12, y: 92 },
                scale: 20,
                opacity: 80,
              }
            : null;
        }

        console.log('[LiveViewer] Final watermark state:', {
          watermarkId: state.value.watermarkId,
          watermarkSettings: state.value.watermarkSettings,
        });
      } else {
        console.log('[LiveViewer] No creator profile found for this stream');
      }
    } catch (error) {
      console.warn('[LiveViewer] Failed to load creator profile', error);
    }
  }

  // Connect to Kick livestream using yt-dlp recording (bypasses origin restrictions)
  // Kick's CDN validates JWT tokens server-side, so we use yt-dlp to capture to local HLS
  async function connectToKick(
    channelInput: string,
    streamerId: string,
    displayName: string,
    profileImageUrl?: string
  ) {
    try {
      // Extract channel slug from URL if needed (e.g., "https://kick.com/jerzynft" -> "jerzynft")
      const channelSlug = extractChannelSlug(channelInput) || channelInput;
      console.log('[LiveViewer] Connecting to Kick channel:', channelSlug);

      // Check if stream is live and get stream info
      const kickStatus = await checkKickLivestream(channelSlug);

      if (!kickStatus.isLive) {
        state.value.connectionState = 'failed';
        state.value.connectionError = 'Stream is not live';
        return;
      }

      state.value.viewerCount = kickStatus.viewerCount || 0;
      state.value.recordingStartTime = kickStatus.startedAt
        ? new Date(kickStatus.startedAt).getTime()
        : Date.now();

      // Check if there's an existing recording for this streamer
      // Priority: 1) Kick DVR session, 2) Persistent recording from monitoring, 3) Start new
      const existingDvrSession = getKickDvrSession(streamerId);
      const existingPersistentSession = activeSessions.value.get(streamerId);
      let outputDir: string;
      let sessionId: string;

      if (existingDvrSession) {
        // Use existing DVR session - allows seeking back to beginning of stream
        console.log('[LiveViewer] Found existing Kick DVR session:', existingDvrSession.sessionId);
        outputDir = existingDvrSession.outputDir;
        sessionId = existingDvrSession.sessionId;
        state.value.tempSessionId = sessionId;
        state.value.isTempRecording = false; // Not a temp recording - it's a DVR session
      } else if (existingPersistentSession && existingPersistentSession.platform === 'Kick') {
        // Use existing persistent recording from monitoring system
        console.log('[LiveViewer] Found existing Kick persistent session:', existingPersistentSession.sessionId);
        sessionId = existingPersistentSession.sessionId;
        state.value.tempSessionId = sessionId;
        state.value.sessionId = existingPersistentSession.sessionId;
        state.value.projectId = existingPersistentSession.projectId;
        state.value.isTempRecording = false;
        outputDir = await invoke<string>('get_kick_session_output_dir', { sessionId });
      } else {
        // No existing session - start a new temp recording
        sessionId = `kick-view-${channelSlug}-${Date.now()}`;
        state.value.tempSessionId = sessionId;
        state.value.isTempRecording = true;

        console.log('[LiveViewer] Starting new Kick recording:', channelSlug);

        // Start yt-dlp recording - this creates local HLS files we can play
        try {
          await startKickRecording(channelSlug, streamerId, sessionId, 1);
        } catch (recordingError) {
          console.error('[LiveViewer] Failed to start Kick recording:', recordingError);
          state.value.connectionState = 'failed';
          state.value.connectionError = 'Failed to start stream capture';
          return;
        }

        // Get the output directory for HLS playback
        outputDir = await invoke<string>('get_kick_session_output_dir', { sessionId });

        // Track this temp recording so it can be reused if user closes and reopens
        addKickDvrSession(streamerId, channelSlug, sessionId, outputDir);
        console.log('[LiveViewer] Tracked temp Kick DVR session for reuse:', sessionId);
      }

      console.log('[LiveViewer] Kick HLS output dir:', outputDir);

      // Initialize HLS playback with the local recording output
      if (hlsVideoElement.value) {
        state.value.dvrStartTime = Date.now();
        state.value.kickEmbedUrl = null;

        // Store the output dir for HLS playback
        hlsOutputDir.value = outputDir;

        // Use the HLS playback composable for local Kick stream
        // This will poll for the playlist to become available
        await hlsPlayback.initialize(hlsVideoElement.value, outputDir);

        state.value.connectionState = 'connected';
        state.value.isBuffering = false;
        state.value.playbackMode = 'hls';
        isHlsReady.value = true;
        reconnectAttempts = 0;

        // Reset segment stall detection
        lastSegmentCount = 0;
        lastSegmentTime = Date.now();
        isRestartingRecorder = false;

        // Start live edge updates for Kick
        startLiveEdgeUpdates();

        // Start segment polling for clipping functionality
        startSegmentPolling();

        // Start playback sync to keep UI in sync with HLS state
        startPlaybackSync();

        // Auto-play
        hlsPlayback.play();
        state.value.isPlaying = true;

        console.log(
          '[LiveViewer] Connected to Kick stream via yt-dlp',
          existingDvrSession ? '(using existing DVR)' : '(new recording)'
        );
      } else {
        throw new Error('HLS video element not available');
      }
    } catch (error) {
      console.error('[LiveViewer] Failed to connect to Kick:', error);
      state.value.connectionState = 'failed';
      state.value.connectionError = error instanceof Error ? error.message : 'Connection failed';

      // Clean up recording if it was started (only for temp recordings)
      if (state.value.tempSessionId && state.value.isTempRecording) {
        try {
          const cleanupSlug = extractChannelSlug(channelInput) || channelInput;
          await stopKickRecording(cleanupSlug);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  // Connect to Twitch livestream using yt-dlp recording (same approach as Kick)
  async function connectToTwitch(
    channelInput: string,
    streamerId: string,
    displayName: string,
    profileImageUrl?: string
  ) {
    try {
      // Extract channel name from URL if needed (e.g., "https://twitch.tv/summit1g" -> "summit1g")
      const channelName = extractTwitchChannelName(channelInput) || channelInput.toLowerCase().trim();
      console.log('[LiveViewer] Connecting to Twitch channel:', channelName);

      // Check if stream is live using Twitch GQL API
      const twitchStatus = await checkTwitchLivestream(channelName);

      if (!twitchStatus.isLive) {
        state.value.connectionState = 'failed';
        state.value.connectionError = 'Stream is not live';
        return;
      }

      state.value.viewerCount = twitchStatus.viewerCount || 0;
      state.value.recordingStartTime = twitchStatus.startedAt
        ? new Date(twitchStatus.startedAt).getTime()
        : Date.now();

      // Check if there's an existing recording for this streamer
      // Priority: 1) Twitch DVR session, 2) Persistent recording from monitoring, 3) Start new
      const existingDvrSession = getTwitchDvrSession(streamerId);
      const existingPersistentSession = activeSessions.value.get(streamerId);
      let outputDir: string;
      let sessionId: string;

      if (existingDvrSession) {
        // Use existing DVR session - allows seeking back to beginning of stream
        console.log('[LiveViewer] Found existing Twitch DVR session:', existingDvrSession.sessionId);
        outputDir = existingDvrSession.outputDir;
        sessionId = existingDvrSession.sessionId;
        state.value.tempSessionId = sessionId;
        state.value.isTempRecording = false; // Not a temp recording - it's a DVR session
      } else if (existingPersistentSession && existingPersistentSession.platform === 'Twitch') {
        // Use existing persistent recording from monitoring system
        console.log('[LiveViewer] Found existing Twitch persistent session:', existingPersistentSession.sessionId);
        sessionId = existingPersistentSession.sessionId;
        state.value.tempSessionId = sessionId;
        state.value.sessionId = existingPersistentSession.sessionId;
        state.value.projectId = existingPersistentSession.projectId;
        state.value.isTempRecording = false;
        outputDir = await getTwitchSessionOutputDir(sessionId);
      } else {
        // No existing session - start a new temp recording
        sessionId = `twitch-view-${channelName}-${Date.now()}`;
        state.value.tempSessionId = sessionId;
        state.value.isTempRecording = true;

        console.log('[LiveViewer] Starting new Twitch recording:', channelName);

        // Start yt-dlp recording - this creates local HLS files we can play
        try {
          await startTwitchRecording(channelName, streamerId, sessionId, 1);
        } catch (recordingError) {
          console.error('[LiveViewer] Failed to start Twitch recording:', recordingError);
          state.value.connectionState = 'failed';
          state.value.connectionError = 'Failed to start stream capture';
          return;
        }

        // Get the output directory for HLS playback
        outputDir = await getTwitchSessionOutputDir(sessionId);

        // Track this temp recording so it can be reused if user closes and reopens
        addTwitchDvrSession(streamerId, channelName, sessionId, outputDir);
        console.log('[LiveViewer] Tracked temp Twitch DVR session for reuse:', sessionId);
      }

      console.log('[LiveViewer] Twitch HLS output dir:', outputDir);

      // Initialize HLS playback with the local recording output
      if (hlsVideoElement.value) {
        state.value.dvrStartTime = Date.now();
        state.value.kickEmbedUrl = null;

        // Store the output dir for HLS playback
        hlsOutputDir.value = outputDir;

        // Use the HLS playback composable for local Twitch stream
        // This will poll for the playlist to become available
        await hlsPlayback.initialize(hlsVideoElement.value, outputDir);

        state.value.connectionState = 'connected';
        state.value.isBuffering = false;
        state.value.playbackMode = 'hls';
        isHlsReady.value = true;
        reconnectAttempts = 0;

        // Reset segment stall detection
        lastSegmentCount = 0;
        lastSegmentTime = Date.now();
        isRestartingRecorder = false;

        // Start live edge updates for Twitch
        startLiveEdgeUpdates();

        // Start segment polling for clipping functionality
        startSegmentPolling();

        // Start playback sync to keep UI in sync with HLS state
        startPlaybackSync();

        // Auto-play
        hlsPlayback.play();
        state.value.isPlaying = true;

        console.log(
          '[LiveViewer] Connected to Twitch stream via yt-dlp',
          existingDvrSession ? '(using existing DVR)' : '(new recording)'
        );
      } else {
        throw new Error('HLS video element not available');
      }
    } catch (error) {
      console.error('[LiveViewer] Failed to connect to Twitch:', error);
      state.value.connectionState = 'failed';
      state.value.connectionError = error instanceof Error ? error.message : 'Connection failed';

      // Clean up recording if it was started
      if (state.value.tempSessionId && state.value.isTempRecording) {
        try {
          const cleanupName = extractTwitchChannelName(channelInput) || channelInput.toLowerCase().trim();
          await stopTwitchRecording(cleanupName);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  // Connect to livestream
  async function connect(
    mintId: string,
    streamerId: string,
    displayName: string,
    profileImageUrl?: string,
    autoStartRecording: boolean = true,
    platform: SupportedLivestreamPlatform = 'PumpFun'
  ) {
    if (!mintId) {
      console.error('[LiveViewer] No mintId provided!');
      state.value.connectionState = 'failed';
      state.value.connectionError = 'No stream ID provided';
      return;
    }

    if (state.value.connectionState === 'connecting') {
      return;
    }

    // Reset intentional disconnect flag when starting a new connection
    isIntentionalDisconnect = false;

    // Don't reset connection state if HLS is already active (reconnect is just for WebRTC)
    const hlsAlreadyActive = isHlsActive();
    if (!hlsAlreadyActive) {
      state.value.connectionState = 'connecting';
      state.value.isBuffering = true;
    }
    state.value.connectionError = null;
    state.value.mintId = mintId;
    state.value.streamerId = streamerId;
    state.value.displayName = displayName;
    state.value.profileImageUrl = profileImageUrl || null;
    state.value.platform = platform;

    // Route to platform-specific connection
    if (platform === 'Kick') {
      await connectToKick(mintId, streamerId, displayName, profileImageUrl);
      return;
    }

    if (platform === 'Twitch') {
      await connectToTwitch(mintId, streamerId, displayName, profileImageUrl);
      return;
    }

    // PumpFun connection (default)
    try {
      // Check if stream is live
      const liveStatus = await fetchLiveStatus(mintId);

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
      const joinData = await joinLivestream(mintId);
      const token = joinData.token;

      if (!token) {
        throw new Error('Failed to obtain LiveKit token');
      }

      // Get preferred region
      let livekitUrl = joinData.serverUrl || joinData.url || joinData.wsUrl;

      if (!livekitUrl) {
        livekitUrl = await getPreferredRegion(token);
      }

      // Ensure we're using wss:// protocol for WebSocket connection
      if (livekitUrl && livekitUrl.startsWith('https://')) {
        livekitUrl = livekitUrl.replace('https://', 'wss://');
      } else if (
        livekitUrl &&
        !livekitUrl.startsWith('wss://') &&
        !livekitUrl.startsWith('ws://')
      ) {
        livekitUrl = 'wss://' + livekitUrl;
      }

      // Start HLS recording FIRST - this is the primary playback method
      // Do this before WebRTC so playback works even if WebRTC fails
      if (autoStartRecording) {
        await ensureHlsRecordingAvailable(streamerId, mintId, displayName, profileImageUrl);
      }

      state.value.connectionState = 'connected';
      reconnectAttempts = 0;

      // Create and connect to LiveKit room (for WebRTC viewer tracking - optional)
      // WebRTC connection failure should NOT block HLS playback
      try {
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
        await room.connect(livekitUrl, token, { autoSubscribe: true });

        // Attach any existing tracks (streamer may already be publishing)
        attachExistingTracks();

        // Video tracks sometimes arrive after initial connection - retry check after delay
        if (!remoteVideoTrack) {
          setTimeout(() => {
            if (!remoteVideoTrack && room?.state === 'connected') {
              attachExistingTracks();
            }
          }, 2000);
        }
      } catch (webrtcError) {
        // WebRTC failed but HLS recording is already started - continue with HLS-only mode
        console.warn('[LiveViewer] WebRTC connection failed, continuing with HLS-only:', webrtcError);
        room = null;
      }

      // Start live edge update timer
      startLiveEdgeUpdates();

      // Start segment polling for HLS
      startSegmentPolling();

      // Immediately fetch segments (don't wait for poll interval)
      await updateHlsSegments();

      // Listen for segment events
      await setupSegmentEventListeners();

      // Start playback sync interval
      startPlaybackSync();

      // Note: HLS playback initialization is handled by the hlsOutputDir watcher
    } catch (error) {
      console.error('[LiveViewer] Connection failed:', error);
      state.value.connectionState = 'failed';
      state.value.isBuffering = false;

      // Provide more detailed error messages
      let errorMessage = 'Connection failed';
      if (error instanceof Error) {
        errorMessage = error.message;
        if (error.message.includes('CORS') || error.message.includes('cors')) {
          errorMessage = 'Connection blocked by browser security (CORS)';
        } else if (error.message.includes('network') || error.message.includes('Network')) {
          errorMessage = 'Network error - check your internet connection';
        } else if (error.message.includes('token') || error.message.includes('Token')) {
          errorMessage = 'Authentication failed - invalid stream token';
        }
      }
      state.value.connectionError = errorMessage;

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
    room.on(RoomEvent.TrackPublished, (publication) => {
      // If track isn't subscribed yet and we need it, subscribe manually
      if (!publication.isSubscribed && publication.kind === Track.Kind.Video && !remoteVideoTrack) {
        publication.setSubscribed(true);
      }
    });

    // Connection events
    room.on(RoomEvent.Disconnected, handleDisconnected);
    room.on(RoomEvent.Reconnecting, handleReconnecting);
    room.on(RoomEvent.Reconnected, handleReconnected);
    room.on(RoomEvent.ParticipantConnected, (participant) => {
      updateViewerCount();

      // Check if the participant has tracks we need
      participant.trackPublications.forEach((publication) => {
        if (
          publication.kind === Track.Kind.Video &&
          !publication.isSubscribed &&
          !remoteVideoTrack
        ) {
          publication.setSubscribed(true);
        }
      });
    });
    room.on(RoomEvent.ParticipantDisconnected, () => {
      updateViewerCount();
    });
    room.on(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);
    room.on(RoomEvent.ConnectionQualityChanged, handleConnectionQualityChanged);
  }

  // Handle track subscription for WebRTC playback
  function handleTrackSubscribed(
    track: RemoteTrack,
    _publication: RemoteTrackPublication,
    _participant: RemoteParticipant
  ) {
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
    _publication: RemoteTrackPublication,
    _participant: RemoteParticipant
  ) {
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
        } else if (publication.kind === Track.Kind.Video && !publication.isSubscribed) {
          publication.setSubscribed(true);
        }
      });
    });
  }

  // NOTE: WebRTC video track is received but NOT displayed to user
  // We use HLS-only playback for consistent timeline/seek behavior
  function attachVideoTrack() {
    if (!remoteVideoTrack) return;

    // Get video quality info from track settings
    const settings = remoteVideoTrack.mediaStreamTrack?.getSettings();
    if (settings?.width && settings?.height) {
      state.value.streamQuality = `${settings.width}x${settings.height}`;
    }
  }

  // NOTE: WebRTC audio track is received but NOT played directly to user
  // Audio comes through HLS playback for consistent DVR experience
  function attachAudioTrack() {
    if (!remoteAudioTrack) return;
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
  async function switchToWebRTC() {
    await seekToLiveEdgeHls();
  }

  // Ensure HLS is initialized and playing
  async function ensureHlsPlaying(seekPosition?: number) {
    // Initialize HLS if not already done
    if (hlsVideoElement.value && hlsOutputDir.value && !hlsPlayback.state.value.isInitialized) {
      await hlsPlayback.initialize(hlsVideoElement.value, hlsOutputDir.value);
    }

    // Refresh playlist and seek if position provided
    if (seekPosition !== undefined) {
      hlsPlayback.refreshPlaylist(seekPosition);
    }

    // Play HLS
    await hlsPlayback.play();
  }

  // Seek to the live edge of HLS (end of recorded content)
  async function seekToLiveEdgeHls() {
    if (!hlsPlayback.state.value.isInitialized) return;

    const duration = hlsPlayback.state.value.duration;
    if (duration > 0) {
      const liveEdgePosition = Math.max(0, duration - 1);
      hlsPlayback.refreshPlaylist(liveEdgePosition);
      await hlsPlayback.seek(liveEdgePosition);
      state.value.isAtLiveEdge = true;
    }
  }

  // Switch to HLS playback mode (this is now the only mode)
  async function switchToHLS(seekPosition?: number) {
    state.value.playbackMode = 'hls';
    await ensureHlsPlaying(seekPosition);
  }

  // Check if HLS playback is active or has segments being produced.
  // When true, WebRTC state changes should NOT disrupt the UI.
  function isHlsActive(): boolean {
    return (
      hlsOutputDir.value !== null &&
      (hlsPlayback.state.value.isInitialized ||
        state.value.availableSegments.length > 0 ||
        state.value.totalRecordedDuration > 0)
    );
  }

  function handleDisconnected() {
    // If HLS is active, don't disrupt the UI — just silently try to reconnect WebRTC
    // WebRTC is only for viewer count on PumpFun; HLS is the primary playback method
    if (isHlsActive()) {
      console.log('[LiveViewer] WebRTC disconnected but HLS is active, silently reconnecting for viewer count');
      if (
        !isIntentionalDisconnect &&
        state.value.mintId &&
        reconnectAttempts < MAX_RECONNECT_ATTEMPTS
      ) {
        scheduleWebRTCReconnect();
      }
      return;
    }

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
    // Don't show reconnecting overlay if HLS is active
    if (isHlsActive()) return;
    state.value.connectionState = 'reconnecting';
  }

  function handleReconnected() {
    state.value.connectionState = 'connected';
    reconnectAttempts = 0;
  }

  function handleConnectionStateChanged(connectionState: ConnectionState) {
    // Don't let WebRTC state changes disrupt UI when HLS is active
    if (isHlsActive() && connectionState !== ConnectionState.Connected) return;

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

    reconnectTimeout = window.setTimeout(() => {
      connect(mintId, streamerId, displayName, profileImageUrl, false);
    }, delay);
  }

  // Silently reconnect WebRTC only (for viewer count) without disrupting HLS playback
  function scheduleWebRTCReconnect() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }

    reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);

    reconnectTimeout = window.setTimeout(async () => {
      if (!state.value.mintId || isIntentionalDisconnect) return;

      try {
        // Only reconnect the WebRTC room, don't restart the full connection flow
        const joinData = await joinLivestream(state.value.mintId);
        const token = joinData.token;
        if (!token) return;

        let livekitUrl = joinData.serverUrl || joinData.url || joinData.wsUrl;
        if (livekitUrl && livekitUrl.startsWith('https://')) {
          livekitUrl = livekitUrl.replace('https://', 'wss://');
        } else if (livekitUrl && !livekitUrl.startsWith('wss://') && !livekitUrl.startsWith('ws://')) {
          livekitUrl = 'wss://' + livekitUrl;
        }

        if (room) {
          try { await room.disconnect(); } catch { /* ignore */ }
        }

        room = new Room({ adaptiveStream: true, dynacast: true });
        setupRoomEventHandlers(room);
        await room.connect(livekitUrl || '', token, { autoSubscribe: true });
        reconnectAttempts = 0;
        console.log('[LiveViewer] WebRTC silently reconnected for viewer count');
      } catch (e) {
        console.warn('[LiveViewer] WebRTC silent reconnect failed:', e);
        // Try again if still within limits
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          scheduleWebRTCReconnect();
        }
      }
    }, delay);
  }

  // Ensure HLS recording is available for playback and clipping
  async function ensureHlsRecordingAvailable(
    streamerId: string,
    mintId: string,
    displayName: string,
    _profileImageUrl?: string
  ) {
    // Check if already has a persistent recording session
    const session = activeSessions.value.get(streamerId);
    if (session) {
      state.value.sessionId = session.sessionId;
      state.value.projectId = session.projectId;
      state.value.isTempRecording = false;

      // Try to get the output directory for HLS playback
      // Note: Auto-detect for PumpFun now uses DVR recording, so HLS output dir may not exist
      try {
        const outputDir = await invoke<string>('get_recording_output_dir', {
          sessionId: session.sessionId,
        });
        hlsOutputDir.value = outputDir;
        return; // HLS recording exists, we're done
      } catch (e) {
        console.warn(
          '[LiveViewer] Could not get recording output dir, starting HLS recording for playback:',
          e
        );
        // Fall through to start HLS recording for playback
      }
    }

    // Start HLS recording via Tauri (Node.js recorder) for video playback
    // This is needed even if auto-detect is using DVR, because the video player needs HLS
    try {
      const result = await invoke<{ sessionId: string; outputDir: string }>('start_hls_recording', {
        mintId,
        streamerId,
        displayName,
        resumeDir: null, // New session, not resuming
      });

      // Only update sessionId if we don't already have one from auto-detect
      if (!state.value.sessionId) {
        state.value.sessionId = result.sessionId;
      }
      state.value.isTempRecording = !session; // Temp if no auto-detect session
      if (!session) {
        state.value.projectId = null;
      }
      hlsOutputDir.value = result.outputDir;
      state.value.dvrStartTime = Date.now();
    } catch (error) {
      console.warn('[LiveViewer] Failed to start HLS recording:', error);
      state.value.connectionError = 'Failed to start recording';
    }
  }

  // Track if HLS is already initializing to prevent duplicate calls
  let isHlsInitializing = false;

  // Initialize HLS playback (for DVR mode - uses separate video element)
  // Gates on playlist + first segment readiness to avoid 404 loops
  async function initializeHlsPlayback() {
    // Use hlsVideoElement if available, otherwise fall back to main videoElement
    const hlsElement = hlsVideoElement.value || videoElement.value;

    console.log('[LiveViewer] initializeHlsPlayback called', {
      hasElement: !!hlsElement,
      hasOutputDir: !!hlsOutputDir.value,
      isInitializing: isHlsInitializing,
      isInitialized: hlsPlayback.state.value.isInitialized,
      playbackMode: state.value.playbackMode,
    });

    if (!hlsElement || !hlsOutputDir.value) return;

    // Prevent duplicate initialization
    if (isHlsInitializing || hlsPlayback.state.value.isInitialized) return;

    isHlsInitializing = true;

    // Apply audio settings before initializing
    hlsPlayback.setVolume(state.value.volume);
    hlsPlayback.setMuted(state.value.isMuted);

    try {
      // Gate initialization on playlist + first segment readiness to avoid 404 loops
      console.log('[LiveViewer] Waiting for playlist ready...');
      const ready = await hlsPlayback.waitForPlaylistReady(hlsOutputDir.value);
      console.log('[LiveViewer] Playlist ready result:', ready);
      
      if (!ready) {
        console.warn('[LiveViewer] Playlist/segments not ready, skipping HLS init');
        // Don't set error - recording may still be starting
        return;
      }

      console.log('[LiveViewer] Initializing HLS playback...');
      const success = await hlsPlayback.initialize(hlsElement, hlsOutputDir.value);
      console.log('[LiveViewer] HLS initialization result:', success);

      if (success) {
        // For PumpFun (and all platforms now), always use HLS playback
        // WebRTC is only used for viewer count tracking, not video playback
        console.log('[LiveViewer] HLS mode, starting playback...');
        
        try {
          await hlsPlayback.play();
          state.value.isPlaying = true;
          state.value.isBuffering = false;
          console.log('[LiveViewer] HLS playback started successfully');
        } catch (playError) {
          console.error('[LiveViewer] Failed to start HLS playback:', playError);
          // Try again after a short delay (autoplay policy workaround)
          setTimeout(async () => {
            try {
              await hlsPlayback.play();
              state.value.isPlaying = true;
              state.value.isBuffering = false;
              console.log('[LiveViewer] HLS playback started on retry');
            } catch (retryError) {
              console.error('[LiveViewer] Retry failed:', retryError);
            }
          }, 500);
        }
      } else {
        console.warn('[LiveViewer] HLS initialization failed');
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
    if (!hlsOutputDir.value) {
      console.debug('[LiveViewer] updateHlsSegments: No hlsOutputDir set');
      return;
    }

    try {
      // Get segment info from the HLS playlist
      const segments = await invoke<SegmentInfo[]>('get_hls_segments', {
        outputDir: hlsOutputDir.value,
      });

      if (segments && segments.length > 0) {
        const previousCount = state.value.availableSegments.length;
        state.value.availableSegments = segments;
        state.value.totalRecordedDuration = segments[segments.length - 1].endTime;

        // Track segment progress for stall detection
        if (segments.length > lastSegmentCount) {
          lastSegmentCount = segments.length;
          lastSegmentTime = Date.now();
          
          // Reset restart counter when segments are flowing - recording is working
          if (recorderRestartCount > 0) {
            console.log('[LiveViewer] Segments flowing again, resetting restart counter');
            recorderRestartCount = 0;
          }

          // Log segment update only when count changes
          if (segments.length !== previousCount) {
            // Check for gaps in segment numbers
            const segmentNumbers = segments.map(s => s.segmentNumber);
            const gaps: number[] = [];
            for (let i = 1; i < segmentNumbers.length; i++) {
              const expected = segmentNumbers[i - 1] + 1;
              if (segmentNumbers[i] !== expected) {
                // Add all missing segment numbers
                for (let missing = expected; missing < segmentNumbers[i]; missing++) {
                  gaps.push(missing);
                }
              }
            }
            
            if (gaps.length > 0) {
              console.warn(`[LiveViewer] ⚠️ SEGMENT GAPS detected! Missing segment numbers: ${gaps.join(', ')}`);
            }
            
            console.log(
              '[LiveViewer] Segments updated:',
              segments.length,
              'Duration:',
              segments[segments.length - 1].endTime.toFixed(1) + 's',
              gaps.length > 0 ? `| GAPS: ${gaps.length}` : ''
            );
          }
        } else {
          // Check for segment stall - no new segments for too long
          const timeSinceLastSegment = Date.now() - lastSegmentTime;
          if (
            timeSinceLastSegment > SEGMENT_STALL_THRESHOLD &&
            !isRestartingRecorder &&
            !isIntentionalDisconnect
          ) {
            console.warn(
              `[LiveViewer] No new segments for ${(timeSinceLastSegment / 1000).toFixed(0)}s, checking stream status...`
            );
            checkAndRestartRecorderIfNeeded();
          }
        }
      } else {
        console.debug('[LiveViewer] No segments returned from get_hls_segments');
      }
    } catch (error) {
      // Silently fail - segments may not be ready yet
      console.debug('[LiveViewer] Could not get HLS segments:', error);
    }
  }

  // Check if stream is still live and restart recorder if needed
  async function checkAndRestartRecorderIfNeeded() {
    if (isRestartingRecorder || isIntentionalDisconnect) return;

    const mintId = state.value.mintId;
    const streamerId = state.value.streamerId;
    const platform = state.value.platform;

    if (!mintId || !streamerId) {
      console.warn('[LiveViewer] Cannot restart recorder: missing mintId or streamerId');
      return;
    }

    // Don't attempt restart if stream has already ended
    if (streamHasEnded) {
      console.log('[LiveViewer] Stream has ended, skipping restart check');
      return;
    }
    
    // Check if we've exceeded max restart attempts
    if (recorderRestartCount >= MAX_RECORDER_RESTARTS) {
      console.error(
        `[LiveViewer] Max recorder restarts (${MAX_RECORDER_RESTARTS}) exceeded. Checking if stream ended...`
      );
      // Don't set error yet - let the stream status check determine if it ended
      return;
    }

    recorderRestartCount++;
    console.log(`[LiveViewer] Recorder restart attempt ${recorderRestartCount}/${MAX_RECORDER_RESTARTS}`);
    
    isRestartingRecorder = true;

    try {
      // Check if stream is still live based on platform
      let isLive = false;

      if (platform === 'Kick') {
        const kickStatus = await checkKickLivestream(mintId);
        isLive = kickStatus.isLive;
      } else if (platform === 'Twitch') {
        const twitchStatus = await checkTwitchLivestream(mintId);
        isLive = twitchStatus.isLive;
      } else {
        // PumpFun - use the existing fetchLiveStatus function
        const pumpFunStatus = await fetchLiveStatus(mintId);
        isLive = pumpFunStatus.isLive;
      }

      if (isLive) {
        console.log(
          '[LiveViewer] Stream is still live but segments stalled, restarting recorder...'
        );
        state.value.isBuffering = true;

        if (platform === 'Kick' || platform === 'Twitch') {
          // Kick/Twitch restart logic (both use yt-dlp + FFmpeg HLS)
          try {
            if (platform === 'Kick') {
              await stopKickRecording(mintId);
            } else {
              await stopTwitchRecording(mintId);
            }
          } catch (stopError) {
            console.warn(`[LiveViewer] Error stopping old ${platform} recording:`, stopError);
          }

          await new Promise((resolve) => setTimeout(resolve, 1000));

          const newSessionId = platform === 'Kick'
            ? `kick-view-${mintId}-${Date.now()}`
            : `twitch-view-${mintId}-${Date.now()}`;
          state.value.tempSessionId = newSessionId;

          try {
            if (platform === 'Kick') {
              await startKickRecording(mintId, streamerId, newSessionId, 1);
            } else {
              await startTwitchRecording(mintId, streamerId, newSessionId, 1);
            }

            const newOutputDir = platform === 'Kick'
              ? await invoke<string>('get_kick_session_output_dir', { sessionId: newSessionId })
              : await getTwitchSessionOutputDir(newSessionId);
            console.log(`[LiveViewer] ${platform} recorder restarted, new output dir:`, newOutputDir);

            lastSegmentCount = 0;
            lastSegmentTime = Date.now();
            hlsOutputDir.value = newOutputDir;

            if (hlsVideoElement.value) {
              await hlsPlayback.initialize(hlsVideoElement.value, newOutputDir);
              hlsPlayback.play();
              state.value.isBuffering = false;
              console.log(`[LiveViewer] Playback reinitialized after ${platform} recorder restart`);
            }
          } catch (restartError) {
            console.error(`[LiveViewer] Failed to restart ${platform} recording:`, restartError);
            state.value.connectionError = 'Recording stopped and failed to restart';
          }
        } else {
          // PumpFun-specific restart logic
          // Save the current output directory so we can resume in the same location
          const currentOutputDir = hlsOutputDir.value;
          
          try {
            await invoke('stop_hls_recording', { mintId });
          } catch (stopError) {
            console.warn('[LiveViewer] Error stopping old PumpFun recording:', stopError);
          }

          await new Promise((resolve) => setTimeout(resolve, 1000));

          try {
            // Resume in the same directory to preserve DVR content
            const result = await invoke<{ sessionId: string; outputDir: string }>(
              'start_hls_recording',
              {
                mintId,
                streamerId,
                displayName: state.value.displayName || 'Unknown',
                resumeDir: currentOutputDir, // Resume in same directory to preserve DVR
              }
            );

            console.log(
              '[LiveViewer] PumpFun recorder resumed in existing dir:',
              result.outputDir
            );

            state.value.sessionId = result.sessionId;
            state.value.isTempRecording = true;
            // Don't reset segment count - we're resuming, not starting fresh
            lastSegmentTime = Date.now();
            hlsOutputDir.value = result.outputDir;

            // CRITICAL FIX: Do NOT reinitialize HLS playback when recorder restarts in same directory
            // HLS.js will automatically pick up new segments from the playlist as they're added
            // Reinitializing causes the player to reload the playlist and jump backwards, creating a buffer loop
            // The HLS player is already watching the playlist file and will detect new segments automatically
            console.log('[LiveViewer] PumpFun recorder restarted - HLS playback continues without reinitialization');
            
            // Just ensure playback is still active
            if (hlsVideoElement.value && hlsPlayback.state.value.isInitialized) {
              // Refresh the playlist to pick up any new segments immediately
              hlsPlayback.refreshPlaylist();
              // Resume playback if it was paused
              if (!hlsPlayback.state.value.isPlaying) {
                hlsPlayback.play();
              }
              state.value.isBuffering = false;
            }
          } catch (restartError) {
            console.error('[LiveViewer] Failed to restart PumpFun recording:', restartError);
            state.value.connectionError = 'Recording stopped and failed to restart';
          }
        }
      } else {
        console.log('[LiveViewer] Stream is no longer live');
        streamHasEnded = true;
        state.value.connectionState = 'disconnected';
        state.value.connectionError = 'Stream ended';
        
        // Stop segment polling since stream has ended
        if (segmentPollInterval) {
          clearInterval(segmentPollInterval);
          segmentPollInterval = null;
          console.log('[LiveViewer] Stopped segment polling - stream ended');
        }
        
        // Notify HLS playback that stream has ended so it stops seeking back
        hlsPlayback.setStreamEnded(true);
      }
    } catch (checkError) {
      console.error('[LiveViewer] Failed to check stream status:', checkError);
    } finally {
      isRestartingRecorder = false;
    }
  }

  // Live edge update timer
  function startLiveEdgeUpdates() {
    if (liveEdgeUpdateInterval) {
      clearInterval(liveEdgeUpdateInterval);
    }

    liveEdgeUpdateInterval = window.setInterval(() => {
      // NOTE: In HLS-only mode, the actual timeline comes from HLS duration
      // This interval now only serves as a fallback while HLS is loading
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

      // Clamp UI playback position to displayed duration to avoid end-jumps when new segments append
      const safeDuration = Math.max(displayDuration, 0.001);

      // Don't overwrite playback position while actively seeking - let the seek target stick
      if (!isSeekingActive) {
        const clampedPosition = Math.min(ps.currentTime, Math.max(0, safeDuration - 0.25));
        state.value.playbackPosition = clampedPosition;
      }

      // Clamp buffered ranges to displayed duration to keep the bar stable
      state.value.bufferedRanges = ps.bufferedRanges.map((r) => ({
        start: Math.max(0, Math.min(r.start, safeDuration)),
        end: Math.max(0, Math.min(r.end, safeDuration)),
      }));

      // Latency is the delay from real-time (HLS segments are ~5s behind WebRTC)
      state.value.latencyMs = 5000 + ps.latency * 1000;

      // Timeline always reflects actual HLS content duration
      const actualHlsDuration = ps.duration > 0 ? ps.duration : 0;
      const nowTs = Date.now();
      const dtSeconds = Math.max(0, (nowTs - lastDisplayUpdate) / 1000);
      lastDisplayUpdate = nowTs;

      // Smoothly advance displayed duration to avoid playhead jump when new segments are appended
      // BUT if we're far behind actual (e.g., reconnecting), snap immediately to avoid slow catch-up
      const durationGap = actualHlsDuration - displayDuration;
      if (durationGap > 10) {
        // We're more than 10 seconds behind - snap to actual (reconnecting scenario)
        displayDuration = actualHlsDuration;
      } else if (actualHlsDuration >= displayDuration) {
        // Normal case - grow smoothly to avoid jumps when new segments append
        const growth = dtSeconds * DURATION_SMOOTH_RATE;
        displayDuration = Math.min(actualHlsDuration, displayDuration + growth);
      } else {
        // If actual shrinks (shouldn't), snap down
        displayDuration = actualHlsDuration;
      }

      // Start playback only after we have a safer initial buffer (>= 12s)
      const MIN_BUFFER_DURATION = 12;

      if (actualHlsDuration >= MIN_BUFFER_DURATION) {
        // HLS has enough content for smooth playback
        state.value.liveEdgeTime = displayDuration;
        state.value.totalRecordedDuration = displayDuration;

        // Mark HLS as ready once we have enough buffer
        if (!isHlsReady.value) {
          isHlsReady.value = true;
          state.value.isBuffering = false;
          hlsPlayback.play();
        }

        // Don't override isAtLiveEdge while actively seeking
        if (!isSeekingActive) {
          // Check if at live edge (within 2 seconds of end)
          state.value.isAtLiveEdge = ps.isAtLiveEdge || ps.currentTime >= ps.duration - 2;
        }
      } else if (actualHlsDuration > 0) {
        // HLS has some content but not enough for smooth playback
        state.value.liveEdgeTime = displayDuration;
        state.value.totalRecordedDuration = displayDuration;
        state.value.isBuffering = true;

        // Keep paused while buffering up the initial window to avoid start-stop
        if (!isHlsReady.value && state.value.isPlaying) {
          hlsPlayback.pause();
          state.value.isPlaying = false;
        }

        // Check for stuck buffering (if duration doesn't increase for > 10s)
        const now = Date.now();
        if (!lastDurationUpdate) {
          lastDurationUpdate = now;
          lastDurationValue = actualHlsDuration;
        } else if (actualHlsDuration > lastDurationValue) {
          lastDurationUpdate = now;
          lastDurationValue = actualHlsDuration;
        } else if (now - lastDurationUpdate > 10000) {
          hlsPlayback.refreshPlaylist(state.value.playbackPosition);
          lastDurationUpdate = now;
        }
      } else if (state.value.dvrStartTime) {
        // HLS not ready yet - show buffering state
        state.value.liveEdgeTime = displayDuration;
        state.value.totalRecordedDuration = displayDuration;
        state.value.isAtLiveEdge = true;
        state.value.isBuffering = true;
      }

      // Sync error state
      if (ps.error && !state.value.connectionError) {
        state.value.connectionError = ps.error;
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
    }, 2000);

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
    // Listen for persistent recording segments (Kick)
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

    // Listen for HLS segment events (PumpFun) - real-time updates
    const hlsSegmentUnlisten = await listen<{
      streamerId: string;
      sessionId: string;
      mintId: string;
      segment: number;
      path: string;
      duration: number;
    }>('hls-segment-ready', (event) => {
      // For PumpFun streams, match against mintId (not streamerId which is a UUID)
      if (event.payload.mintId === state.value.mintId) {
        console.log('[LiveViewer] HLS segment ready (real-time):', event.payload.segment);
        
        // Directly add the segment from the event payload instead of scanning filesystem
        const newSegment: SegmentInfo = {
          segmentNumber: event.payload.segment,
          filePath: event.payload.path,
          startTime: state.value.totalRecordedDuration,
          duration: event.payload.duration,
          endTime: state.value.totalRecordedDuration + event.payload.duration,
        };
        
        // Check if segment already exists to avoid duplicates
        const exists = state.value.availableSegments.some(s => s.segmentNumber === event.payload.segment);
        if (!exists) {
          state.value.availableSegments = [...state.value.availableSegments, newSegment];
          state.value.totalRecordedDuration += event.payload.duration;
          
          // CRITICAL: Update lastSegmentTime to prevent false stall detection
          // Without this, the system thinks segments have stalled even though they're arriving continuously
          lastSegmentTime = Date.now();
          
          // Reset restart counter since segments are flowing
          if (recorderRestartCount > 0) {
            console.log('[LiveViewer] Segments flowing again, resetting restart counter');
            recorderRestartCount = 0;
          }
          
          console.log('[LiveViewer] Segment added (real-time):', event.payload.segment, 'Total:', state.value.availableSegments.length);
        }
      }
    });

    // Listen for recorder exit - attempt to restart if stream is still live (Kick and Twitch)
    // Note: PumpFun recorder exit is handled via segment stall detection
    const recorderExitUnlisten = await listen<{
      streamerId: string;
      sessionId: string;
      channelSlug?: string;
      channelName?: string;
      code: number | null;
    }>('recorder-exit', async (event) => {
      const { streamerId } = event.payload;
      // Kick uses channelSlug, Twitch uses channelName
      const channel = event.payload.channelSlug || event.payload.channelName;

      // Only handle if this is our current stream and it's a Kick or Twitch stream
      if (
        streamerId !== state.value.streamerId ||
        isIntentionalDisconnect ||
        (state.value.platform !== 'Kick' && state.value.platform !== 'Twitch')
      ) {
        return;
      }

      const platform = state.value.platform;
      console.log(
        `[LiveViewer] ${platform} recorder exited unexpectedly, checking if stream is still live...`
      );

      // Check if stream is still live
      try {
        let isLive = false;
        if (platform === 'Kick') {
          const kickStatus = await checkKickLivestream(channel!);
          isLive = kickStatus.isLive;
        } else {
          const twitchStatus = await checkTwitchLivestream(channel!);
          isLive = twitchStatus.isLive;
        }

        if (isLive) {
          console.log(`[LiveViewer] ${platform} stream is still live, attempting to restart recording...`);
          state.value.isBuffering = true;

          // Restart the recording with a new session
          const newSessionId = platform === 'Kick'
            ? `kick-view-${channel}-${Date.now()}`
            : `twitch-view-${channel}-${Date.now()}`;
          state.value.tempSessionId = newSessionId;

          try {
            if (platform === 'Kick') {
              await startKickRecording(channel!, streamerId, newSessionId, 1);
            } else {
              await startTwitchRecording(channel!, streamerId, newSessionId, 1);
            }

            // Get the new output directory
            const newOutputDir = platform === 'Kick'
              ? await invoke<string>('get_kick_session_output_dir', { sessionId: newSessionId })
              : await getTwitchSessionOutputDir(newSessionId);

            console.log(`[LiveViewer] ${platform} recording restarted, new output dir:`, newOutputDir);

            // Update the HLS output dir - this will trigger the watcher to reinitialize playback
            hlsOutputDir.value = newOutputDir;

            // Reset segment stall detection
            lastSegmentCount = 0;
            lastSegmentTime = Date.now();

            // Reinitialize HLS playback with the new recording
            if (hlsVideoElement.value) {
              await hlsPlayback.initialize(hlsVideoElement.value, newOutputDir);
              hlsPlayback.play();
              state.value.isBuffering = false;
              console.log(`[LiveViewer] Playback reinitialized after ${platform} recorder restart`);
            }
          } catch (restartError) {
            console.error(`[LiveViewer] Failed to restart ${platform} recording:`, restartError);
            state.value.connectionError = 'Recording stopped and failed to restart';
          }
        } else {
          console.log('[LiveViewer] Stream is no longer live');
          streamHasEnded = true;
          state.value.connectionState = 'disconnected';
          state.value.connectionError = 'Stream ended';
          hlsPlayback.setStreamEnded(true);
        }
      } catch (checkError) {
        console.error('[LiveViewer] Failed to check stream status:', checkError);
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

    unlistenFunctions.push(unlisten, hlsSegmentUnlisten, recorderExitUnlisten, cleanupHlsInterval as any);
  }

  // Disconnect from livestream
  async function disconnect() {
    // Prevent multiple disconnects
    if (isIntentionalDisconnect) return;

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

    if (segmentUpdateDebounceTimer) {
      clearTimeout(segmentUpdateDebounceTimer);
      segmentUpdateDebounceTimer = null;
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

    // Clean up HLS playback
    await hlsPlayback.cleanup();

    // DON'T stop recordings on disconnect - keep them running for DVR functionality
    // Recordings will continue in background and can be resumed when user reopens stream
    // Only stop recordings when user explicitly stops monitoring or app closes

    // Reset HLS output directory
    hlsOutputDir.value = null;

    // Clear video element refs before room disconnect
    videoElement.value = null;
    hlsVideoElement.value = null;

    // Disconnect room
    if (room) {
      try {
        await room.disconnect(true);
      } catch (e) {
        console.warn('[LiveViewer] Error disconnecting room:', e);
      }
      room = null;
    }

    // Reset state
    state.value.connectionState = 'disconnected';
    state.value.isPlaying = false;
    state.value.playbackMode = 'hls';
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

    // Reset HLS ready state and seeking flag
    isHlsReady.value = false;
    isSeekingActive = false;
  }

  // Set video element reference (legacy - not used in HLS-only mode)
  function setVideoElement(element: HTMLVideoElement | null) {
    videoElement.value = element;
  }

  // Set HLS video element reference (for DVR playback)
  // Note: Don't auto-initialize HLS here - let the hlsOutputDir watcher handle it
  // after connect() starts the recording and sets a fresh hlsOutputDir
  function setHlsVideoElement(element: HTMLVideoElement | null) {
    hlsVideoElement.value = element;
  }

  // Playback controls
  async function play() {
    if (state.value.playbackMode === 'webrtc') {
      if (videoElement.value) {
        try {
          await videoElement.value.play();
        } catch (e) {
          // Ignore play errors
        }
      }

      if (standaloneAudioElement && standaloneAudioElement.paused) {
        try {
          await standaloneAudioElement.play();
        } catch (e) {
          // Ignore play errors
        }
      }

      state.value.isPlaying = true;
    } else {
      // HLS mode (including Kick streams)
      await hlsPlayback.play();
      state.value.isPlaying = true;
    }
  }

  function pause() {
    if (state.value.playbackMode === 'webrtc') {
      if (videoElement.value) {
        videoElement.value.pause();
      }

      if (standaloneAudioElement) {
        standaloneAudioElement.pause();
      }

      state.value.isPlaying = false;
    } else {
      // HLS mode (including Kick streams)
      hlsPlayback.pause();
      state.value.isPlaying = false;
    }
  }

  function togglePlayPause() {
    if (state.value.isPlaying) {
      pause();
    } else {
      play();
    }
  }

  // Track when we're actively seeking to prevent sync interval from overwriting position
  let isSeekingActive = false;

  // Seek to a specific time (always uses HLS)
  async function seek(time: number) {
    const hlsDuration = hlsPlayback.state.value.duration;

    if (!hlsPlayback.state.value.isInitialized) return;

    // Check if seeking to near the live edge (within 2 seconds of end)
    const isSeekingToLiveEdge = hlsDuration > 0 && time >= hlsDuration - 2;

    if (isSeekingToLiveEdge) {
      await seekToLive();
    } else {
      // Clamp to valid range
      const clampedTime = Math.max(0, Math.min(time, hlsDuration > 0 ? hlsDuration - 0.5 : time));

      // Set seeking flag to prevent sync interval from overwriting position
      isSeekingActive = true;

      // Immediately update UI state to reflect seek target
      state.value.playbackPosition = clampedTime;
      state.value.isAtLiveEdge = false;

      await ensureHlsPlaying();
      await hlsPlayback.seek(clampedTime);

      // Keep the seek flag active briefly to let the video element catch up
      setTimeout(() => {
        isSeekingActive = false;
      }, 500);
    }
  }

  // Seek to live edge - position a few segments behind the actual end for buffer
  async function seekToLive() {
    if (!hlsPlayback.state.value.isInitialized) return;

    // Position at 2 segments (8s) from end for optimal live viewing
    const duration = hlsPlayback.state.value.duration;
    const livePosition = Math.max(0, duration - 8);

    // Set seeking flag to prevent sync interval from overwriting position
    isSeekingActive = true;

    // Immediately update UI state
    state.value.playbackPosition = livePosition;
    state.value.isAtLiveEdge = true;

    await hlsPlayback.seek(livePosition);

    // Keep the seek flag active briefly to let the video element catch up
    setTimeout(() => {
      isSeekingActive = false;
    }, 500);
  }

  // Volume controls (HLS-only mode - audio comes from HLS)
  function setVolume(volume: number) {
    state.value.volume = Math.max(0, Math.min(1, volume));
    saveVolumePreference(state.value.volume);
    hlsPlayback.setVolume(state.value.volume);
  }

  function setMuted(muted: boolean) {
    state.value.isMuted = muted;
    saveMutedPreference(muted);
    hlsPlayback.setMuted(muted);
  }

  function toggleMute() {
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
      // Use hlsVideoElement (preferred) or videoElement as fallback
      const hlsElement = hlsVideoElement.value || videoElement.value;
      if (
        outputDir &&
        outputDir !== oldOutputDir &&
        hlsElement &&
        state.value.connectionState === 'connected' &&
        !hlsPlayback.state.value.isInitialized
      ) {
        // Small delay to let FFmpeg start creating files
        await new Promise((r) => setTimeout(r, 500));
        await initializeHlsPlayback();
      }
    }
  );

  // Watch for HLS video element to be set (may happen after hlsOutputDir is ready)
  watch(
    () => hlsVideoElement.value,
    async (element) => {
      if (
        element &&
        hlsOutputDir.value &&
        state.value.connectionState === 'connected' &&
        !hlsPlayback.state.value.isInitialized
      ) {
        // Small delay to let FFmpeg start creating files
        await new Promise((r) => setTimeout(r, 500));
        await initializeHlsPlayback();
      }
    }
  );

  // Watch for segments to become available - retry HLS init if it failed earlier
  // This handles the case where waitForPlaylistReady timed out but segments are now available
  watch(
    () => state.value.availableSegments.length,
    async (segmentCount) => {
      // Only retry if we have segments, HLS isn't initialized, and we're not currently initializing
      if (
        segmentCount >= 2 &&
        hlsOutputDir.value &&
        (hlsVideoElement.value || videoElement.value) &&
        state.value.connectionState === 'connected' &&
        !hlsPlayback.state.value.isInitialized &&
        !isHlsInitializing
      ) {
        console.log('[LiveViewer] Segments available, retrying HLS initialization');
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

    // HLS output directory (for PIP window)
    hlsOutputDir,

    // Debug: expose HLS playback state for diagnostics overlay
    hlsPlaybackState: hlsPlayback.state,
  };
}
