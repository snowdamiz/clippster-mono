/**
 * DVR Recording using browser MediaRecorder with Web Audio API mixing.
 * 
 * This approach uses the browser's hardware-accelerated encoding (VP8/VP9)
 * which eliminates the real-time encoding pressure that caused buffering issues
 * with the Node.js HLS recorder approach.
 * 
 * For multi-participant streams (guests on stage), all audio tracks are mixed
 * using Web Audio API before being fed to MediaRecorder.
 */

import { ref, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteParticipant,
  VideoQuality,
  type VideoTrack,
  type AudioTrack,
} from 'livekit-client';

// DVR chunk info
export interface DvrChunk {
  index: number;
  path: string;
  duration: number;
  startTime: number;
  endTime: number;
  suspect?: boolean; // Chunk was recorded during track mute - may be corrupt
}

// Callback for when a chunk is ready (used by auto-detect to process segments)
// Can be async to support segment building operations
export type OnChunkReadyCallback = (chunk: DvrChunk, mintId: string, streamerId: string, sessionId: string) => void | Promise<void>;

// Result from starting a DVR session with HLS conversion
export interface DvrSessionResult {
  sessionId: string;
  outputDir: string; // HLS output directory for playback
}

// DVR session state
export interface DvrSession {
  mintId: string;
  streamerId: string;
  displayName: string;
  room: Room;
  mediaRecorder: MediaRecorder | null;
  mediaStream: MediaStream | null;
  hiddenVideoElement: HTMLVideoElement | null; // Hidden element to keep video track active
  hiddenAudioElement: HTMLAudioElement | null; // Hidden element to keep audio track active (muted)
  canvasElement: HTMLCanvasElement | null; // Canvas for capturing frames
  canvasAnimationId: number | null; // Animation frame ID for canvas drawing
  audioContext: AudioContext | null; // For capturing audio
  chunks: DvrChunk[];
  totalDuration: number;
  startedAt: number;
  isRecording: boolean;
  streamEnded: boolean;
  chunkIndex: number;
  // Optional callback for auto-detect mode
  onChunkReady?: OnChunkReadyCallback;
  sessionId?: string; // Session ID for auto-detect mode
  // HLS conversion mode - converts DVR chunks to HLS segments in real-time
  hlsOutputDir?: string; // If set, chunks are converted to HLS segments
  hlsConversionEnabled?: boolean;
}

// PumpFun API endpoints
const PUMPFUN_LIVESTREAM_API = 'https://livestream-api.pump.fun';
const DVR_CHUNK_DURATION_SECONDS = 4;

// Singleton map - sessions persist across component lifecycle
const activeDvrSessions = ref<Map<string, DvrSession>>(new Map());

// Helper to check live status
async function checkLiveStatus(
  mintId: string
): Promise<{ isLive: boolean; token?: string; serverUrl?: string }> {
  try {
    const response = await invoke<string>('check_pumpfun_livestream', { mintId });
    if (!response) {
      return { isLive: false };
    }
    const data = JSON.parse(response);
    return {
      isLive: Boolean(data?.isLive),
    };
  } catch (error) {
    console.warn('[DvrRecording] Failed to check live status', error);
    return { isLive: false };
  }
}

// Helper to join livestream and get token
// Default fallback URL
const PUMPFUN_LIVEKIT_URL = 'wss://pump-prod-tg2x8veh.livekit.cloud';

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
          console.log('[DvrRecording] Got preferred region:', regionUrl);
          return regionUrl;
        }
      }
    }
  } catch (error) {
    console.warn('[DvrRecording] Failed to get preferred region', error);
  }
  return PUMPFUN_LIVEKIT_URL;
}

async function joinLivestream(mintId: string): Promise<{ token: string; serverUrl: string }> {
  try {
    const response = await invoke<string>('join_pumpfun_livestream', { mintId });
    if (!response) {
      throw new Error('Empty response from join API');
    }
    const data = JSON.parse(response);

    let serverUrl = data.serverUrl || data.url || data.wsUrl;

    // If no server URL in response, get preferred region
    if (!serverUrl) {
      serverUrl = await getPreferredRegion(data.token);
    }

    // Ensure wss:// protocol
    if (serverUrl.startsWith('https://')) {
      serverUrl = serverUrl.replace('https://', 'wss://');
    } else if (!serverUrl.startsWith('wss://') && !serverUrl.startsWith('ws://')) {
      serverUrl = 'wss://' + serverUrl;
    }

    console.log('[DvrRecording] Using server URL:', serverUrl);

    return {
      token: data.token,
      serverUrl,
    };
  } catch (error) {
    console.error('[DvrRecording] Join livestream error:', error);
    throw new Error(`Failed to join livestream: ${error}`);
  }
}

// Result from setting up capture
interface CaptureSetup {
  mediaStream: MediaStream;
  videoElement: HTMLVideoElement;
  audioElement: HTMLAudioElement | null; // Separate audio element for track consumption
  canvasElement: HTMLCanvasElement | null; // null when using direct capture
  animationId: number;
  audioContext: AudioContext | null;
}

// Wait for video and audio tracks from room and create a MediaStream with mixed audio
// MULTI-PARTICIPANT APPROACH: 
// - Find main broadcaster's video track
// - Collect ALL audio tracks from all participants
// - Mix audio using Web Audio API
// - Create MediaStream with video + mixed audio for MediaRecorder
function waitForTracks(room: Room): Promise<CaptureSetup> {
  // Helper: log current track inventory for diagnostics
  const logTrackInventory = () => {
    console.log('[DvrRecording] === Track inventory dump ===');
    room.remoteParticipants.forEach((participant) => {
      const pId = participant.identity;
      const hasVideo = Array.from(participant.trackPublications.values()).some(
        (p) => p.kind === Track.Kind.Video && p.isSubscribed && p.track
      );
      const hasAudio = Array.from(participant.trackPublications.values()).some(
        (p) => p.kind === Track.Kind.Audio && p.isSubscribed && p.track
      );
      console.log(
        `[DvrRecording] participant=${pId} hasVideo=${hasVideo} hasAudio=${hasAudio} isViewer=${pId.includes('-viewer-')}`
      );
      participant.trackPublications.forEach((pub) => {
        const sid = (pub as any).sid ?? (pub as any).trackSid ?? 'unknown';
        const t = pub.track as RemoteTrack | undefined;
        const mst = (t as any)?.mediaStreamTrack as MediaStreamTrack | undefined;
        console.log(
          `  -> kind=${pub.kind} pubSid=${sid} subscribed=${pub.isSubscribed} ` +
            `track=${!!t} mst=${!!mst} readyState=${mst?.readyState ?? 'n/a'} enabled=${mst?.enabled ?? 'n/a'} muted=${mst?.muted ?? 'n/a'}`
        );
      });
    });
    console.log('[DvrRecording] === End inventory ===');
  };

  // Find the main broadcaster (has video track, prefer -ingress suffix)
  const findMainBroadcaster = (): RemoteParticipant | null => {
    const participants = Array.from(room.remoteParticipants.values());

    // Filter to participants with video (main broadcaster has video)
    const videoCandidates = participants.filter((p) => {
      if (p.identity.includes('-viewer-')) return false;
      const pubs = Array.from(p.trackPublications.values());
      return pubs.some((pub) => pub.kind === Track.Kind.Video && pub.isSubscribed && pub.track);
    });

    if (videoCandidates.length === 0) return null;

    // Prefer participant with -ingress suffix (this is the actual stream source)
    const ingressParticipant = videoCandidates.find((p) => p.identity.includes('-ingress'));
    if (ingressParticipant) {
      console.log('[DvrRecording] Found ingress broadcaster:', ingressParticipant.identity);
      return ingressParticipant;
    }

    // Otherwise use first candidate with video
    console.log('[DvrRecording] Using broadcaster:', videoCandidates[0].identity);
    return videoCandidates[0];
  };

  // Collect ALL audio tracks from all participants (for mixing)
  const collectAllAudioTracks = (): { track: MediaStreamTrack; identity: string }[] => {
    const audioTracks: { track: MediaStreamTrack; identity: string }[] = [];
    
    room.remoteParticipants.forEach((participant) => {
      participant.trackPublications.forEach((pub) => {
        if (pub.kind === Track.Kind.Audio && pub.isSubscribed && pub.track) {
          const audioTrack = pub.track as AudioTrack;
          const mst = audioTrack.mediaStreamTrack;
          if (mst && mst.readyState === 'live') {
            audioTracks.push({ track: mst, identity: participant.identity });
            console.log(`[DvrRecording] Collected audio track from: ${participant.identity}`);
          }
        }
      });
    });
    
    return audioTracks;
  };

  return new Promise((resolve, reject) => {
    let timeout: number | null = null;
    let inventoryInterval: number | null = null;
    let settled = false;
    let checkInterval: number | null = null;

    const cleanup = () => {
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      if (inventoryInterval) {
        clearInterval(inventoryInterval);
        inventoryInterval = null;
      }
      if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }
    };

    const resolveOnce = (result: CaptureSetup) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    // Setup capture with multi-participant audio mixing
    // - Uses main broadcaster's video
    // - Mixes ALL audio tracks from all participants using Web Audio API
    const setupMultiParticipantCapture = async (broadcaster: RemoteParticipant) => {
      console.log('[DvrRecording] Setting up MULTI-PARTICIPANT capture');
      console.log('[DvrRecording] Main broadcaster:', broadcaster.identity);
      logTrackInventory();

      // Get video track from main broadcaster
      const pubs = Array.from(broadcaster.trackPublications.values());
      const videoPub = pubs.find((p) => p.kind === Track.Kind.Video && p.isSubscribed && p.track) as RemoteTrackPublication | undefined;

      if (!videoPub?.track) {
        console.error('[DvrRecording] Missing video track from broadcaster');
        return false;
      }

      const videoTrack = videoPub.track as VideoTrack;
      const videoMST = videoTrack.mediaStreamTrack;

      if (!videoMST) {
        console.error('[DvrRecording] Missing video MediaStreamTrack');
        return false;
      }

      console.log(`[DvrRecording] Video MST: enabled=${videoMST.enabled}, readyState=${videoMST.readyState}, muted=${videoMST.muted}`);

      // Request HIGH video quality
      try {
        videoPub.setVideoQuality(VideoQuality.HIGH);
        console.log('[DvrRecording] Requested HIGH video quality');
      } catch (e) {
        console.log('[DvrRecording] Could not set video quality:', e);
      }

      // Collect ALL audio tracks from all participants
      const allAudioTracks = collectAllAudioTracks();
      console.log(`[DvrRecording] Collected ${allAudioTracks.length} audio tracks for mixing`);

      if (allAudioTracks.length === 0) {
        console.error('[DvrRecording] No audio tracks found');
        return false;
      }

      // Create AudioContext for mixing
      const audioContext = new AudioContext({ sampleRate: 48000 });
      
      // CRITICAL: Resume the AudioContext - it starts in 'suspended' state by default
      // Without this, no audio samples flow through the mixer!
      if (audioContext.state === 'suspended') {
        console.log('[DvrRecording] AudioContext is suspended, resuming...');
        await audioContext.resume();
        console.log('[DvrRecording] AudioContext resumed, state:', audioContext.state);
      }
      
      // Create a destination node that outputs to a MediaStream
      const mixerDestination = audioContext.createMediaStreamDestination();
      
      // CRITICAL: Create hidden audio elements to "consume" each audio track
      // WebRTC audio tracks don't produce samples until they're attached to an element
      const hiddenAudioElements: HTMLAudioElement[] = [];
      for (const { track, identity } of allAudioTracks) {
        try {
          const audioEl = document.createElement('audio');
          audioEl.id = 'dvr-audio-' + Math.random().toString(36).substr(2, 9);
          audioEl.muted = true; // Muted so we don't hear double audio
          audioEl.autoplay = true;
          audioEl.srcObject = new MediaStream([track]);
          audioEl.style.position = 'fixed';
          audioEl.style.opacity = '0';
          audioEl.style.pointerEvents = 'none';
          document.body.appendChild(audioEl);
          
          // Start playback to activate the track
          audioEl.play().catch((e) => {
            console.warn(`[DvrRecording] Audio element play failed for ${identity}:`, e);
          });
          
          hiddenAudioElements.push(audioEl);
          console.log(`[DvrRecording] Created audio consumer element for: ${identity}`);
        } catch (e) {
          console.warn(`[DvrRecording] Failed to create audio element for ${identity}:`, e);
        }
      }
      
      // Small delay to let audio elements activate the tracks
      await new Promise((r) => setTimeout(r, 100));
      
      // Connect all audio tracks to the mixer
      const audioSources: MediaStreamAudioSourceNode[] = [];
      for (const { track, identity } of allAudioTracks) {
        try {
          const sourceStream = new MediaStream([track]);
          const source = audioContext.createMediaStreamSource(sourceStream);
          source.connect(mixerDestination);
          audioSources.push(source);
          console.log(`[DvrRecording] Mixed audio from: ${identity}`);
        } catch (e) {
          console.warn(`[DvrRecording] Failed to mix audio from ${identity}:`, e);
        }
      }

      // Get the mixed audio track
      const mixedAudioTrack = mixerDestination.stream.getAudioTracks()[0];
      if (!mixedAudioTrack) {
        console.error('[DvrRecording] Failed to create mixed audio track');
        await audioContext.close();
        return false;
      }

      console.log(`[DvrRecording] Created mixed audio track: enabled=${mixedAudioTrack.enabled}, readyState=${mixedAudioTrack.readyState}`);

      // Create video element to consume the track (signals SFU we're watching)
      const videoElement = document.createElement('video');
      videoElement.id = 'dvr-video-' + Math.random().toString(36).substr(2, 9);
      videoElement.muted = true;
      videoElement.playsInline = true;
      videoElement.autoplay = true;
      videoElement.style.position = 'fixed';
      videoElement.style.width = '160px';
      videoElement.style.height = '90px';
      videoElement.style.bottom = '0px';
      videoElement.style.right = '0px';
      videoElement.style.opacity = '0.01';
      videoElement.style.pointerEvents = 'none';
      videoElement.style.zIndex = '1';
      document.body.appendChild(videoElement);
      videoTrack.attach(videoElement);

      // Start playback
      try {
        await videoElement.play();
        console.log('[DvrRecording] Video element playing');
      } catch (e) {
        console.log('[DvrRecording] Video play error (continuing):', e);
      }

      // Wait for video dimensions
      let attempts = 0;
      while (videoElement.videoWidth === 0 && attempts < 50) {
        await new Promise((r) => setTimeout(r, 100));
        attempts++;
      }
      console.log(`[DvrRecording] Video dimensions: ${videoElement.videoWidth}x${videoElement.videoHeight}`);

      // Create MediaStream with video + mixed audio
      const recordingStream = new MediaStream([videoMST, mixedAudioTrack]);
      console.log(`[DvrRecording] Created recording MediaStream with ${recordingStream.getTracks().length} tracks (video + ${allAudioTracks.length} mixed audio sources)`);
      recordingStream.getTracks().forEach((t) => {
        console.log(`[DvrRecording] Track: ${t.kind}, id=${t.id}, enabled=${t.enabled}, readyState=${t.readyState}`);
      });

      // Periodic quality request to prevent SFU from downgrading
      const qualityInterval = window.setInterval(() => {
        try {
          videoPub.setVideoQuality(VideoQuality.HIGH);
        } catch (e) {}
      }, 5000);
      (videoElement as any).__qualityInterval = qualityInterval;
      
      // Store audio sources and hidden elements for cleanup
      (videoElement as any).__audioSources = audioSources;
      (videoElement as any).__hiddenAudioElements = hiddenAudioElements;

      resolveOnce({
        mediaStream: recordingStream,
        videoElement,
        audioElement: null, // No separate audio element needed - we mix in AudioContext
        canvasElement: null,
        animationId: 0,
        audioContext, // Pass AudioContext for proper cleanup
      });
      return true;
    };

    // Check for broadcaster and setup multi-participant capture
    const trySetupCapture = async () => {
      if (settled) return;

      const broadcaster = findMainBroadcaster();
      if (broadcaster) {
        const success = await setupMultiParticipantCapture(broadcaster);
        if (!success) {
          console.warn('[DvrRecording] Multi-participant capture setup failed, will retry...');
        }
      }
    };

    // When new tracks arrive, check if we can setup capture
    const onTrackSubscribed = (
      _track: RemoteTrack,
      _publication: RemoteTrackPublication,
      participant: RemoteParticipant
    ) => {
      console.log('[DvrRecording] Track subscribed from:', participant.identity);
      if (!participant.identity.includes('-viewer-')) {
        trySetupCapture();
      }
    };

    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);

    // Log inventory immediately and periodically
    logTrackInventory();
    inventoryInterval = window.setInterval(logTrackInventory, 5000);

    // Check immediately and periodically for publisher
    trySetupCapture();
    checkInterval = window.setInterval(trySetupCapture, 1000);

    // Timeout after 30 seconds
    timeout = window.setTimeout(() => {
      if (settled) return;
      console.error('[DvrRecording] Timeout waiting for broadcaster with video track');
      logTrackInventory();
      rejectOnce(new Error('Timeout waiting for publisher tracks'));
    }, 30000);
  });
}

// Get supported MIME type for MediaRecorder
// Prefer VP8 over VP9 as it's more reliable with canvas capture
function getSupportedMimeType(): string {
  const types = [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8',
    'video/webm;codecs=vp9',
    'video/webm',
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      console.log('[DvrRecording] Using MIME type:', type);
      return type;
    }
  }

  console.warn('[DvrRecording] No preferred MIME type supported, using default');
  return 'video/webm';
}

export function useDvrRecording() {
  // Computed helpers
  const isDvrActive = (mintId: string) => computed(() => activeDvrSessions.value.has(mintId));

  const getDvrSessionState = (mintId: string) =>
    computed(() => activeDvrSessions.value.get(mintId));

  /**
   * Start a background DVR session for a streamer.
   * Called by monitoring when streamer goes live.
   * Persists until streamer goes offline.
   * 
   * @param options.sessionId - If provided, enables auto-detect mode with segment callbacks
   * @param options.onChunkReady - Callback fired when each chunk is saved (for auto-detect)
   * @param options.hlsOutputDir - If provided, enables HLS conversion mode
   */
  async function startDvrSession(
    mintId: string,
    streamerId: string,
    displayName: string,
    options?: {
      sessionId?: string;
      onChunkReady?: OnChunkReadyCallback;
      hlsOutputDir?: string; // Enable HLS conversion mode
    }
  ): Promise<void> {
    // Check if already recording
    if (activeDvrSessions.value.has(mintId)) {
      console.log('[DvrRecording] DVR session already active for:', mintId);
      return;
    }

    console.log('[DvrRecording] Starting DVR session for:', mintId, displayName);

    try {
      // CRITICAL: Clean up any old DVR chunks from previous recordings
      // This prevents stale/corrupt chunks from being mixed into new segments
      try {
        await invoke('cleanup_dvr_chunks', { mintId });
        console.log('[DvrRecording] Cleaned up old DVR chunks for:', mintId);
      } catch (cleanupErr) {
        // Ignore cleanup errors - directory might not exist yet
        console.log('[DvrRecording] No old chunks to clean up for:', mintId);
      }

      // Check if stream is live
      const liveStatus = await checkLiveStatus(mintId);
      if (!liveStatus.isLive) {
        console.log('[DvrRecording] Stream not live, skipping DVR start');
        return;
      }

      // Get join token
      const { token, serverUrl } = await joinLivestream(mintId);

      // Create dedicated background LiveKit connection
      // IMPORTANT: Disable adaptiveStream and dynacast to prevent track muting
      // These optimizations pause tracks when not visibly consumed
      const room = new Room({
        adaptiveStream: false, // Disable adaptive streaming - we need continuous data
        dynacast: false, // Disable dynamic broadcast - we need all data
        videoCaptureDefaults: {
          resolution: { width: 1280, height: 720 },
        },
      });

      // Set up room event handlers for debugging
      room.on(RoomEvent.Disconnected, () => {
        console.log('[DvrRecording] Room disconnected for:', mintId);
        const session = activeDvrSessions.value.get(mintId);
        if (session) {
          session.streamEnded = true;
          session.isRecording = false;
        }
      });

      room.on(RoomEvent.Reconnecting, () => {
        console.log('[DvrRecording] Room reconnecting for:', mintId);
      });

      room.on(RoomEvent.Reconnected, () => {
        console.log('[DvrRecording] Room reconnected for:', mintId);
      });

      // Listen for track mute/unmute events at the room level
      room.on(RoomEvent.TrackMuted, (publication, participant) => {
        console.warn(
          '[DvrRecording] Track muted:',
          publication.trackSid,
          'participant:',
          participant.identity
        );
      });

      room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
        console.log(
          '[DvrRecording] Track unmuted:',
          publication.trackSid,
          'participant:',
          participant.identity
        );
      });

      room.on(RoomEvent.TrackStreamStateChanged, (publication, state, participant) => {
        console.log(
          '[DvrRecording] Track stream state changed:',
          publication.trackSid,
          'state:',
          state,
          'participant:',
          participant.identity
        );
      });

      // Connect to room
      console.log('[DvrRecording] Connecting to LiveKit room:', serverUrl);
      await room.connect(serverUrl, token, { autoSubscribe: true });
      console.log('[DvrRecording] Connected to room for DVR');

      // Create initial session state
      const session: DvrSession = {
        mintId,
        streamerId,
        displayName,
        room,
        mediaRecorder: null,
        mediaStream: null,
        hiddenVideoElement: null,
        hiddenAudioElement: null,
        canvasElement: null,
        canvasAnimationId: null,
        audioContext: null,
        chunks: [],
        totalDuration: 0,
        startedAt: Date.now(),
        isRecording: false,
        streamEnded: false,
        chunkIndex: 0,
        // Auto-detect mode options
        sessionId: options?.sessionId,
        onChunkReady: options?.onChunkReady,
        // HLS conversion mode
        hlsOutputDir: options?.hlsOutputDir,
        hlsConversionEnabled: !!options?.hlsOutputDir,
      };

      // Add to sessions map
      const newMap = new Map(activeDvrSessions.value);
      newMap.set(mintId, session);
      activeDvrSessions.value = newMap;

      // Wait for tracks and start recording with canvas-based capture
      try {
        const captureSetup = await waitForTracks(room);
        session.mediaStream = captureSetup.mediaStream;
        session.hiddenVideoElement = captureSetup.videoElement;
        session.hiddenAudioElement = captureSetup.audioElement;
        session.canvasElement = captureSetup.canvasElement;
        session.canvasAnimationId = captureSetup.animationId;
        session.audioContext = captureSetup.audioContext;

        // Log MediaStream state for debugging
        console.log(
          '[DvrRecording] MediaStream ready, tracks:',
          captureSetup.mediaStream.getTracks().length
        );
        captureSetup.mediaStream.getTracks().forEach((track) => {
          console.log(
            `[DvrRecording] Track: ${track.kind}, enabled: ${track.enabled}, readyState: ${track.readyState}, muted: ${track.muted}`
          );
        });

        // Wait a bit for the stream to stabilize before starting MediaRecorder
        // This helps ensure the encoder receives proper video frames
        console.log('[DvrRecording] Waiting for stream to stabilize...');
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Start MediaRecorder
        await startMediaRecorder(mintId, session, captureSetup.mediaStream);
      } catch (trackError) {
        console.error('[DvrRecording] Failed to get tracks:', trackError);
        // Clean up on failure
        await room.disconnect();
        const cleanMap = new Map(activeDvrSessions.value);
        cleanMap.delete(mintId);
        activeDvrSessions.value = cleanMap;
        throw trackError;
      }
    } catch (error) {
      console.error('[DvrRecording] Failed to start DVR session:', error);
      throw error;
    }
  }

  /**
   * Start MediaRecorder for a session
   */
  async function startMediaRecorder(
    mintId: string,
    session: DvrSession,
    mediaStream: MediaStream
  ): Promise<void> {
    const mimeType = getSupportedMimeType();

    // Minimum chunk size to consider valid (very small chunks likely indicate corrupt/empty data)
    // A 4-second chunk with video should be at least 50KB even at low quality
    const MIN_VALID_CHUNK_SIZE = 50000; // 50KB minimum

    // Track mute state to mark chunks as potentially corrupt
    let videoTrackMuted = false;
    let lastMuteTime = 0;
    let mutedDuringChunk = false;

    // Get the video track from the stream to monitor its mute state
    const videoTrack = mediaStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrackMuted = videoTrack.muted;

      // Monitor mute events
      videoTrack.onmute = () => {
        console.warn('[DvrRecording] Video track muted during recording - chunks may be corrupt');
        videoTrackMuted = true;
        mutedDuringChunk = true;
        lastMuteTime = Date.now();
      };

      videoTrack.onunmute = () => {
        console.log('[DvrRecording] Video track unmuted');
        videoTrackMuted = false;
        // If we were muted for a long time, the current chunk is likely corrupt
        if (Date.now() - lastMuteTime > 1000) {
          console.log(
            '[DvrRecording] Was muted for >1s, marking current chunk as potentially corrupt'
          );
        }
      };
    }

    // Try to force high-quality audio capture (stereo, 48k, ≥192 kbps)
    const audioTrack = mediaStream.getAudioTracks()[0];
    if (audioTrack && typeof audioTrack.applyConstraints === 'function') {
      try {
        await audioTrack.applyConstraints({
          channelCount: 2,
          sampleRate: 48000,
        } as MediaTrackConstraints);
        console.log('[DvrRecording] Applied audio constraints: 48k stereo');
      } catch (err) {
        console.warn('[DvrRecording] Failed to apply audio constraints', err);
      }
    }

    const recorder = new MediaRecorder(mediaStream, {
      mimeType,
      videoBitsPerSecond: 5000000, // bump video a bit to keep room for audio
      audioBitsPerSecond: 192000, // target 192 kbps Opus
    });

    // Live audio metering (RMS) to confirm we’re actually capturing non-silent audio
    let audioMeterInterval: number | null = null;
    if (audioTrack) {
      try {
        const audioContext =
          session.audioContext ||
          new AudioContext({
            sampleRate: 48000,
          });
        session.audioContext = audioContext;
        
        // Ensure AudioContext is running for metering
        if (audioContext.state === 'suspended') {
          audioContext.resume();
        }
        
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;
        const sourceStream = new MediaStream([audioTrack]);
        const source = audioContext.createMediaStreamSource(sourceStream);
        source.connect(analyser);

        const data = new Float32Array(analyser.fftSize);
        audioMeterInterval = window.setInterval(() => {
          analyser.getFloatTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = data[i];
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          const db = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
          console.log(
            `[DvrRecording] Audio RMS (track ${audioTrack.label || 'remote'}): ${db.toFixed(1)} dB`
          );
        }, 5000);
      } catch (err) {
        console.warn('[DvrRecording] Audio metering setup failed', err);
      }
    }

    session.mediaRecorder = recorder;

    // Serialize chunk processing so indices cannot collide and files cannot be overwritten.
    let saveChain: Promise<void> = Promise.resolve();
    // Keep a local chunk index to ensure monotonicity regardless of session state updates
    let localChunkIndex = session.chunkIndex;
    // Track when we last received a valid chunk (for smart force flush)
    let lastValidChunkAt = Date.now();
    // Track consecutive bad chunks for recovery
    let consecutiveBadChunks = 0;
    const MAX_CONSECUTIVE_BAD_CHUNKS = 3;
    
    // Detailed timing tracking for gap detection
    let lastChunkReceivedAt = Date.now();
    let chunkTimingLog: { index: number; receivedAt: number; deltaMs: number }[] = [];

    recorder.ondataavailable = (event) => {
      const now = Date.now();
      const deltaMs = now - lastChunkReceivedAt;
      const expectedDeltaMs = DVR_CHUNK_DURATION_SECONDS * 1000;
      const driftMs = deltaMs - expectedDeltaMs;
      
      const chunkSize = event.data.size;
      const wasMutedDuringChunk = mutedDuringChunk;
      mutedDuringChunk = false; // Reset for next chunk

      // Log timing info
      chunkTimingLog.push({ index: localChunkIndex, receivedAt: now, deltaMs });
      if (chunkTimingLog.length > 20) chunkTimingLog.shift(); // Keep last 20
      
      // Warn if chunk arrived significantly late (>500ms drift)
      if (Math.abs(driftMs) > 500) {
        console.warn(
          `[DvrRecording] ⚠️ TIMING DRIFT: Chunk ${localChunkIndex} arrived ${driftMs > 0 ? 'LATE' : 'EARLY'} by ${Math.abs(driftMs)}ms (expected ${expectedDeltaMs}ms, got ${deltaMs}ms)`
        );
      }
      
      lastChunkReceivedAt = now;

      console.log(
        `[DvrRecording] ondataavailable fired, chunk ${localChunkIndex}, size: ${chunkSize} bytes, delta: ${deltaMs}ms, drift: ${driftMs > 0 ? '+' : ''}${driftMs}ms, mutedDuringChunk: ${wasMutedDuringChunk}`
      );

      // Determine if this chunk is likely corrupt
      const isEmpty = chunkSize === 0;
      const isTooSmall = chunkSize > 0 && chunkSize < MIN_VALID_CHUNK_SIZE;
      const isLikelyCorrupt = isEmpty || isTooSmall || wasMutedDuringChunk;

      if (isEmpty) {
        console.log('[DvrRecording] Empty chunk received, skipping');
        consecutiveBadChunks++;
      } else if (isTooSmall) {
        console.warn(
          `[DvrRecording] Chunk too small (${chunkSize} bytes < ${MIN_VALID_CHUNK_SIZE}), likely corrupt - skipping`
        );
        consecutiveBadChunks++;
      } else if (wasMutedDuringChunk) {
        console.warn(
          `[DvrRecording] Chunk recorded during muted period (${chunkSize} bytes), marking as suspect`
        );
        // We'll still save it but mark it as potentially corrupt
      }

      // If we get too many consecutive bad chunks, attempt recovery
      if (consecutiveBadChunks >= MAX_CONSECUTIVE_BAD_CHUNKS) {
        console.warn('[DvrRecording] Too many bad chunks, attempting recorder restart...');
        consecutiveBadChunks = 0;

        const currentSession = activeDvrSessions.value.get(mintId) as DvrSession | undefined;
        if (currentSession && currentSession.mediaRecorder?.state === 'recording') {
          // Stop and restart to try to recover
          restartMediaRecorder(mintId, currentSession, mimeType);
        }
        return;
      }

      // Skip empty chunks entirely
      if (isEmpty) {
        return;
      }

      // Skip very small (corrupt) chunks - they will cause playback issues
      if (isTooSmall) {
        // Advance chunk index to maintain timeline
        localChunkIndex++;
        console.log(`[DvrRecording] Skipped corrupt chunk, advancing index to ${localChunkIndex}`);
        return;
      }

      // Reset bad chunk counter for valid chunks
      if (!isLikelyCorrupt) {
        consecutiveBadChunks = 0;
      }
      lastValidChunkAt = Date.now();

      saveChain = saveChain
        .then(async () => {
          const currentSession = activeDvrSessions.value.get(mintId);
          if (!currentSession) {
            console.warn('[DvrRecording] Session not found for chunk save');
            return;
          }

          // Use local index to guarantee uniqueness and order
          const chunkIndex = localChunkIndex;
          localChunkIndex++;

          // Update session state
          currentSession.chunkIndex = localChunkIndex;

          // Convert blob to array buffer
          const arrayBuffer = await event.data.arrayBuffer();
          const data = Array.from(new Uint8Array(arrayBuffer));

          console.log(
            `[DvrRecording] Saving chunk ${chunkIndex} (${data.length} bytes)${wasMutedDuringChunk ? ' [SUSPECT]' : ''}...`
          );

          // Save chunk via Tauri
          const chunkPath = await invoke<string>('save_dvr_chunk', {
            mintId,
            chunkIndex,
            data,
          });

          // Calculate timing deterministically from index
          const duration = DVR_CHUNK_DURATION_SECONDS;
          const startTime = chunkIndex * duration;

          const chunk: DvrChunk = {
            index: chunkIndex,
            path: chunkPath,
            duration,
            startTime,
            endTime: startTime + duration,
            // Mark suspect chunks so playback can handle them
            suspect: wasMutedDuringChunk,
          };

          currentSession.chunks.push(chunk);
          currentSession.chunks.sort((a, b) => a.index - b.index);
          currentSession.totalDuration = Math.max(currentSession.totalDuration, chunk.endTime);

          // Trigger reactivity update
          const newMap = new Map(activeDvrSessions.value);
          newMap.set(mintId, currentSession);
          activeDvrSessions.value = newMap;

          console.log(
            `[DvrRecording] Chunk ${chunk.index} saved for ${mintId}, total duration: ${currentSession.totalDuration}s, path: ${chunkPath}${chunk.suspect ? ' [SUSPECT]' : ''}`
          );

          // Convert to HLS segment if HLS conversion mode is enabled
          if (currentSession.hlsConversionEnabled && currentSession.hlsOutputDir) {
            try {
              console.log(`[DvrRecording] Converting chunk ${chunkIndex} to HLS segment...`);
              await invoke('convert_dvr_chunk_to_hls', {
                mintId,
                chunkIndex,
                hlsOutputDir: currentSession.hlsOutputDir,
              });
              console.log(`[DvrRecording] HLS segment ${chunkIndex} created successfully`);
            } catch (hlsError) {
              console.error(`[DvrRecording] Failed to convert chunk ${chunkIndex} to HLS:`, hlsError);
              // Continue anyway - DVR chunks are still saved
            }
          }

          // Call onChunkReady callback if in auto-detect mode
          if (currentSession.onChunkReady && currentSession.sessionId) {
            console.log(`[DvrRecording] Calling onChunkReady for auto-detect, chunk ${chunk.index}`);
            currentSession.onChunkReady(
              chunk,
              currentSession.mintId,
              currentSession.streamerId,
              currentSession.sessionId
            );
          }
        })
        .catch((error) => {
          console.error('[DvrRecording] Failed to save chunk:', error);
          // Don't re-throw, so subsequent chunks can still be processed
        });
    };

    recorder.onerror = (event) => {
      console.error('[DvrRecording] MediaRecorder error:', event);
    };

    recorder.onstop = () => {
      console.log('[DvrRecording] MediaRecorder stopped for:', mintId);
      const currentSession = activeDvrSessions.value.get(mintId);
      if (currentSession) {
        currentSession.isRecording = false;
      }
    };

    // Start recording with 4-second chunks
    recorder.start(DVR_CHUNK_DURATION_SECONDS * 1000);
    session.isRecording = true;

    console.log('[DvrRecording] MediaRecorder started for:', mintId);
    console.log('[DvrRecording] MediaRecorder state:', recorder.state);
    console.log('[DvrRecording] MediaStream active:', mediaStream.active);

    // Smart force flush - only flush if we haven't received a valid chunk in too long
    const FORCE_FLUSH_THRESHOLD_MS = DVR_CHUNK_DURATION_SECONDS * 1000 * 2.5; // 2.5x chunk duration (10 seconds)
    const forceFlushInterval = setInterval(() => {
      const currentSession = activeDvrSessions.value.get(mintId);
      if (!currentSession || !currentSession.isRecording || !currentSession.mediaRecorder) {
        clearInterval(forceFlushInterval);
        return;
      }

      // Only force flush if we haven't received a valid chunk in a while
      const timeSinceLastChunk = Date.now() - lastValidChunkAt;
      if (timeSinceLastChunk >= FORCE_FLUSH_THRESHOLD_MS) {
        if (currentSession.mediaRecorder.state === 'recording') {
          console.log(
            '[DvrRecording] Force flushing - no valid chunk received in',
            timeSinceLastChunk,
            'ms'
          );
          try {
            currentSession.mediaRecorder.requestData();
          } catch (e) {
            // Ignore errors - requestData might not be supported in all cases
          }
        }
      }
    }, DVR_CHUNK_DURATION_SECONDS * 1000);

    // Debug: log MediaRecorder status periodically
    const statusInterval = setInterval(() => {
      const currentSession = activeDvrSessions.value.get(mintId);
      if (!currentSession || !currentSession.isRecording) {
        clearInterval(statusInterval);
        clearInterval(forceFlushInterval);
        return;
      }

      console.log(
        `[DvrRecording] Status for ${mintId}: recorder=${recorder.state}, stream.active=${mediaStream.active}, chunks=${currentSession.chunks.length}, duration=${currentSession.totalDuration}s, videoMuted=${videoTrackMuted}`
      );

      // Log track states
      mediaStream.getTracks().forEach((track) => {
        console.log(
          `[DvrRecording] Track ${track.kind}: enabled=${track.enabled}, readyState=${track.readyState}, muted=${track.muted}`
        );
      });
    }, 10000);
  }

  /**
   * Restart MediaRecorder to recover from bad state
   */
  function restartMediaRecorder(mintId: string, session: DvrSession, mimeType: string): void {
    if (!session.mediaStream?.active) {
      console.log('[DvrRecording] Cannot restart - stream not active');
      return;
    }

    try {
      // Stop current recorder if recording
      if (session.mediaRecorder?.state === 'recording') {
        session.mediaRecorder.stop();
      }

      // Create new recorder after a brief delay
      setTimeout(() => {
        const currentSession = activeDvrSessions.value.get(mintId) as DvrSession | undefined;
        if (!currentSession || !currentSession.mediaStream?.active) {
          return;
        }

        console.log('[DvrRecording] Creating new MediaRecorder...');

        // Start a fresh MediaRecorder
        startMediaRecorder(mintId, currentSession, currentSession.mediaStream)
          .then(() => {
            console.log('[DvrRecording] MediaRecorder restarted successfully');
          })
          .catch((err) => {
            console.error('[DvrRecording] Failed to restart MediaRecorder:', err);
          });
      }, 500);
    } catch (e) {
      console.error('[DvrRecording] Error during recorder restart:', e);
    }
  }

  /**
   * Stop DVR session and cleanup.
   * Called when streamer goes OFFLINE (not when dialog closes).
   */
  async function stopDvrSession(mintId: string): Promise<void> {
    const session = activeDvrSessions.value.get(mintId);
    if (!session) {
      console.log('[DvrRecording] No DVR session to stop for:', mintId);
      return;
    }

    console.log('[DvrRecording] Stopping DVR session for:', mintId);

    try {
      // Stop MediaRecorder
      if (session.mediaRecorder && session.mediaRecorder.state !== 'inactive') {
        session.mediaRecorder.stop();
      }

      // Stop canvas animation frame/interval
      if (session.canvasAnimationId) {
        // Try both clearInterval and cancelAnimationFrame since we use both approaches
        clearInterval(session.canvasAnimationId);
        cancelAnimationFrame(session.canvasAnimationId);
      }

      // Clean up canvas element
      if (session.canvasElement) {
        session.canvasElement.remove();
      }

      // Clean up audio context
      if (session.audioContext) {
        try {
          await session.audioContext.close();
        } catch (e) {
          // Ignore errors closing audio context
        }
      }

      // Clean up hidden video element
      if (session.hiddenVideoElement) {
        // Clear quality request interval if it exists
        const qualityInterval = (session.hiddenVideoElement as any).__qualityInterval;
        if (qualityInterval) {
          clearInterval(qualityInterval);
        }
        
        // Clean up hidden audio consumer elements (for multi-participant audio mixing)
        const hiddenAudioElements = (session.hiddenVideoElement as any).__hiddenAudioElements as HTMLAudioElement[] | undefined;
        if (hiddenAudioElements) {
          for (const audioEl of hiddenAudioElements) {
            try {
              audioEl.pause();
              audioEl.srcObject = null;
              audioEl.remove();
            } catch (e) {
              // Ignore cleanup errors
            }
          }
        }
        
        session.hiddenVideoElement.pause();
        session.hiddenVideoElement.srcObject = null;
        session.hiddenVideoElement.remove();
      }

      // Clean up hidden audio element (legacy single element)
      if (session.hiddenAudioElement) {
        session.hiddenAudioElement.pause();
        session.hiddenAudioElement.srcObject = null;
        session.hiddenAudioElement.remove();
      }

      // Disconnect from room
      if (session.room) {
        await session.room.disconnect();
      }

      // Cleanup DVR chunks
      await invoke('cleanup_dvr_chunks', { mintId });
    } catch (error) {
      console.error('[DvrRecording] Error stopping DVR session:', error);
    } finally {
      // Remove from sessions map
      const newMap = new Map(activeDvrSessions.value);
      newMap.delete(mintId);
      activeDvrSessions.value = newMap;

      console.log('[DvrRecording] DVR session stopped and cleaned up for:', mintId);
    }
  }

  /**
   * Get DVR session for a streamer (if active).
   * Used by viewer to access DVR chunks.
   */
  function getDvrSession(mintId: string): DvrSession | null {
    return (activeDvrSessions.value.get(mintId) as DvrSession | undefined) || null;
  }

  /**
   * Get chunk for a specific time position
   */
  function getChunkForTime(mintId: string, seconds: number): DvrChunk | null {
    const session = activeDvrSessions.value.get(mintId);
    if (!session) return null;

    // Find chunk that contains this time
    for (const chunk of session.chunks) {
      if (seconds >= chunk.startTime && seconds < chunk.endTime) {
        return chunk;
      }
    }

    // If beyond all chunks, return last chunk
    if (session.chunks.length > 0 && seconds >= session.chunks[session.chunks.length - 1].endTime) {
      return session.chunks[session.chunks.length - 1];
    }

    return null;
  }

  /**
   * Get chunk by index
   */
  function getChunkByIndex(mintId: string, index: number): DvrChunk | null {
    const session = activeDvrSessions.value.get(mintId);
    if (!session) return null;
    return session.chunks[index] || null;
  }

  /**
   * Get total recorded duration
   */
  function getTotalDuration(mintId: string): number {
    return activeDvrSessions.value.get(mintId)?.totalDuration || 0;
  }

  /**
   * Get all chunks for a session
   */
  function getChunks(mintId: string): DvrChunk[] {
    return activeDvrSessions.value.get(mintId)?.chunks || [];
  }

  /**
   * Check if DVR is active for a mint
   */
  function isDvrSessionActive(mintId: string): boolean {
    return activeDvrSessions.value.has(mintId);
  }

  /**
   * Check if stream has ended for a DVR session
   */
  function hasStreamEnded(mintId: string): boolean {
    return activeDvrSessions.value.get(mintId)?.streamEnded || false;
  }

  /**
   * Get all active DVR sessions
   */
  function getAllActiveSessions(): Map<string, DvrSession> {
    return activeDvrSessions.value as Map<string, DvrSession>;
  }

  /**
   * Cleanup all DVR sessions (called on app close)
   */
  async function cleanupAllSessions(): Promise<void> {
    const mints = Array.from(activeDvrSessions.value.keys());
    for (const mintId of mints) {
      await stopDvrSession(mintId);
    }
  }

  return {
    // State
    activeDvrSessions,

    // Computed helpers
    isDvrActive,
    getDvrSessionState,

    // Actions
    startDvrSession,
    stopDvrSession,
    cleanupAllSessions,

    // Getters
    getDvrSession,
    getChunkForTime,
    getChunkByIndex,
    getTotalDuration,
    getChunks,
    isDvrSessionActive,
    hasStreamEnded,
    getAllActiveSessions,
  };
}
