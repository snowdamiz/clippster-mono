import { ref, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteParticipant,
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
}

// DVR session state
export interface DvrSession {
  mintId: string;
  streamerId: string;
  displayName: string;
  room: Room;
  mediaRecorder: MediaRecorder | null;
  mediaStream: MediaStream | null;
  hiddenVideoElement: HTMLVideoElement | null; // Hidden element to keep tracks active
  canvasElement: HTMLCanvasElement | null; // Canvas for capturing frames
  canvasAnimationId: number | null; // Animation frame ID for canvas drawing
  audioContext: AudioContext | null; // For capturing audio
  chunks: DvrChunk[];
  totalDuration: number;
  startedAt: number;
  isRecording: boolean;
  streamEnded: boolean;
  chunkIndex: number;
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
async function joinLivestream(mintId: string): Promise<{ token: string; serverUrl: string }> {
  try {
    const response = await invoke<string>('join_pumpfun_livestream', { mintId });
    if (!response) {
      throw new Error('Empty response from join API');
    }
    const data = JSON.parse(response);

    let serverUrl =
      data.serverUrl || data.url || data.wsUrl || 'wss://pump-prod-tg2x8veh.livekit.cloud';

    // Ensure wss:// protocol
    if (serverUrl.startsWith('https://')) {
      serverUrl = serverUrl.replace('https://', 'wss://');
    } else if (!serverUrl.startsWith('wss://') && !serverUrl.startsWith('ws://')) {
      serverUrl = 'wss://' + serverUrl;
    }

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
  canvasElement: HTMLCanvasElement;
  animationId: number;
  audioContext: AudioContext | null;
}

// Wait for video and audio tracks from room and create a Canvas-based capture
// This approach draws video frames to a canvas and captures from there,
// which is more reliable than trying to use LiveKit tracks directly with MediaRecorder
function waitForTracks(room: Room): Promise<CaptureSetup> {
  return new Promise((resolve, reject) => {
    let videoTrackRef: VideoTrack | null = null;
    let audioTrackRef: AudioTrack | null = null;
    let hasVideo = false;
    let hasAudio = false;
    let timeout: number | null = null;
    let startingCapture = false;
    let settled = false;

    const cleanup = () => {
      room.off(RoomEvent.TrackSubscribed, handleTrack);
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
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

    const checkComplete = () => {
      if (startingCapture || settled) return;
      console.log('[DvrRecording] checkComplete called:', {
        hasVideo,
        hasAudio,
        hasVideoRef: !!videoTrackRef,
        hasAudioRef: !!audioTrackRef,
      });

      if (hasVideo && hasAudio && videoTrackRef && audioTrackRef) {
        startingCapture = true;
        console.log('[DvrRecording] All tracks ready, starting capture setup');
        cleanup();

        // Create video element for playback (used for canvas capture only, NOT for user audio)
        const videoElement = document.createElement('video');
        videoElement.muted = true; // Mute to allow autoplay and prevent audio output
        videoElement.volume = 0; // Ensure volume is 0 as backup
        videoElement.playsInline = true;
        videoElement.autoplay = true;
        videoElement.crossOrigin = 'anonymous';
        // Make it visible but transparent - browsers throttle off-screen/hidden videos
        videoElement.style.position = 'fixed';
        videoElement.style.width = '1px';
        videoElement.style.height = '1px';
        videoElement.style.top = '0';
        videoElement.style.left = '0';
        videoElement.style.opacity = '0.01'; // Nearly invisible but still rendered
        videoElement.style.pointerEvents = 'none';
        videoElement.style.zIndex = '-9999';
        document.body.appendChild(videoElement);

        // Attach LiveKit tracks
        // NOTE: We only attach video track to the element for display
        // Audio track will be captured directly via mediaStreamTrack for recording
        videoTrackRef.attach(videoElement);
        // Don't attach audio to the hidden element - we'll get it directly from the track
        // This prevents the audio from playing to the user
        // audioTrackRef.attach(videoElement);

        // Start playing
        videoElement
          .play()
          .then(() => {
            console.log('[DvrRecording] Video playing, setting up canvas capture');

            // Wait for video to have dimensions
            const waitForDimensions = () => {
              if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                setupCanvasCapture(videoElement, audioTrackRef!, resolveOnce);
              } else {
                console.log('[DvrRecording] Waiting for video dimensions...');
                setTimeout(waitForDimensions, 100);
              }
            };

            // Give it a moment for the first frame
            setTimeout(waitForDimensions, 500);
          })
          .catch((err) => {
            console.error('[DvrRecording] Autoplay failed:', err);
            // Try to set up anyway
            setTimeout(() => {
              setupCanvasCapture(videoElement, audioTrackRef!, resolveOnce);
            }, 1000);
          });
      }
    };

    function setupCanvasCapture(
      videoElement: HTMLVideoElement,
      audioTrack: AudioTrack,
      resolveCapture: (result: CaptureSetup) => void
    ) {
      // Create canvas matching video dimensions (or default if not available)
      const width = videoElement.videoWidth || 640;
      const height = videoElement.videoHeight || 360;

      console.log(`[DvrRecording] Setting up canvas capture: ${width}x${height}`);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      // Make visible but transparent - browsers may throttle hidden canvases
      canvas.style.position = 'fixed';
      canvas.style.width = '1px';
      canvas.style.height = '1px';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.opacity = '0.01';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '-9999';
      document.body.appendChild(canvas);

      const ctx = canvas.getContext('2d')!;

      // Draw video frames to canvas continuously
      let animationId = 0;
      let frameCount = 0;
      let lastLogTime = Date.now();
      let lastDrawTime = 0;
      const targetFrameMs = 1000 / 30;

      const drawFrame = () => {
        const nowPerf = performance.now();
        if (nowPerf - lastDrawTime >= targetFrameMs) {
          lastDrawTime = nowPerf;
          if (videoElement.readyState >= 2) {
            // HAVE_CURRENT_DATA or better
            ctx.drawImage(videoElement, 0, 0, width, height);
            frameCount++;
          }
        }

        // Log frame rate every 5 seconds
        const now = Date.now();
        if (now - lastLogTime >= 5000) {
          console.log(
            `[DvrRecording] Canvas drawing: ${frameCount} frames in 5s (${(frameCount / 5).toFixed(1)} fps), video readyState: ${videoElement.readyState}`
          );
          frameCount = 0;
          lastLogTime = now;
        }

        animationId = requestAnimationFrame(drawFrame);
      };
      animationId = requestAnimationFrame(drawFrame);

      // Capture stream from canvas (video only)
      const canvasStream = canvas.captureStream(30); // 30 FPS

      console.log('[DvrRecording] Canvas stream created, tracks:', canvasStream.getTracks().length);

      // Now add audio track
      // Get audio from the LiveKit track
      let audioContext: AudioContext | null = null;
      const audioMST = audioTrack.mediaStreamTrack;

      if (audioMST) {
        // Create a new MediaStream with both canvas video and LiveKit audio
        const combinedStream = new MediaStream();

        // Add canvas video track
        canvasStream.getVideoTracks().forEach((track) => {
          console.log(
            `[DvrRecording] Adding canvas video track: enabled=${track.enabled}, readyState=${track.readyState}`
          );
          combinedStream.addTrack(track);
        });

        // Add audio track directly (no need to go through AudioContext for recording)
        console.log(
          `[DvrRecording] Adding audio track: enabled=${audioMST.enabled}, readyState=${audioMST.readyState}, muted=${audioMST.muted}`
        );
        combinedStream.addTrack(audioMST);

        console.log(
          '[DvrRecording] Combined stream ready:',
          combinedStream.getTracks().length,
          'tracks'
        );
        combinedStream.getTracks().forEach((t) => {
          console.log(
            `[DvrRecording] Combined track: ${t.kind}, enabled=${t.enabled}, readyState=${t.readyState}, muted=${t.muted}`
          );
        });

        resolveCapture({
          mediaStream: combinedStream,
          videoElement,
          canvasElement: canvas,
          animationId,
          audioContext,
        });
      } else {
        console.warn('[DvrRecording] No audio track available, proceeding with video only');
        resolveCapture({
          mediaStream: canvasStream,
          videoElement,
          canvasElement: canvas,
          animationId,
          audioContext: null,
        });
      }
    }

    const handleTrack = (
      track: RemoteTrack,
      publication: RemoteTrackPublication,
      participant: RemoteParticipant
    ) => {
      console.log(
        '[DvrRecording] Track received:',
        track.kind,
        'from participant:',
        participant.identity
      );

      // Skip viewer tracks
      if (participant.identity.includes('-viewer-')) {
        console.log('[DvrRecording] Skipping viewer track from:', participant.identity);
        return;
      }

      if (track.kind === Track.Kind.Video && !hasVideo) {
        videoTrackRef = track as VideoTrack;
        hasVideo = true;
        console.log('[DvrRecording] Video track captured from:', participant.identity);
      } else if (track.kind === Track.Kind.Audio && !hasAudio) {
        audioTrackRef = track as AudioTrack;
        hasAudio = true;
        console.log('[DvrRecording] Audio track captured from:', participant.identity);
      }

      checkComplete();
    };

    // Check existing tracks first - prioritize non-viewer participants
    const participants = Array.from(room.remoteParticipants.values());
    participants.sort((a, b) => {
      const aIsViewer = a.identity.includes('-viewer-');
      const bIsViewer = b.identity.includes('-viewer-');
      if (aIsViewer && !bIsViewer) return 1;
      if (!aIsViewer && bIsViewer) return -1;
      return 0;
    });

    for (const participant of participants) {
      participant.trackPublications.forEach((publication) => {
        if (publication.track && publication.isSubscribed) {
          handleTrack(
            publication.track as RemoteTrack,
            publication as RemoteTrackPublication,
            participant
          );
        }
      });
    }

    // Listen for new tracks
    room.on(RoomEvent.TrackSubscribed, handleTrack);

    // Check if already complete
    checkComplete();

    // Timeout after 30 seconds
    timeout = window.setTimeout(() => {
      if (startingCapture || settled) return;
      room.off(RoomEvent.TrackSubscribed, handleTrack);

      if (hasVideo || hasAudio) {
        console.warn(
          '[DvrRecording] Timeout waiting for all tracks, proceeding with available tracks'
        );
        console.warn('[DvrRecording] hasVideo:', hasVideo, 'hasAudio:', hasAudio);
        startingCapture = true;

        const videoElement = document.createElement('video');
        videoElement.muted = true;
        videoElement.volume = 0; // Ensure no audio output
        videoElement.playsInline = true;
        videoElement.autoplay = true;
        videoElement.crossOrigin = 'anonymous';
        // Make visible but transparent - browsers throttle hidden videos
        videoElement.style.position = 'fixed';
        videoElement.style.width = '1px';
        videoElement.style.height = '1px';
        videoElement.style.top = '0';
        videoElement.style.left = '0';
        videoElement.style.opacity = '0.01';
        videoElement.style.pointerEvents = 'none';
        videoElement.style.zIndex = '-9999';
        document.body.appendChild(videoElement);

        // Only attach video track - don't attach audio to prevent playback
        if (videoTrackRef) {
          console.log('[DvrRecording] Attaching video track to capture element');
          videoTrackRef.attach(videoElement);
        }

        // Wait for video to actually have data before proceeding
        const waitForVideoData = () => {
          let checkCount = 0;
          const maxChecks = 50; // 10 seconds max (50 * 200ms)

          const checkVideo = () => {
            checkCount++;
            console.log('[DvrRecording] Checking video state (attempt ' + checkCount + '):', {
              readyState: videoElement.readyState,
              videoWidth: videoElement.videoWidth,
              videoHeight: videoElement.videoHeight,
              paused: videoElement.paused,
              ended: videoElement.ended,
              networkState: videoElement.networkState,
            });

            // readyState >= 2 means HAVE_CURRENT_DATA
            if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
              console.log('[DvrRecording] Video has data, setting up canvas capture');
              if (videoTrackRef && audioTrackRef) {
                setupCanvasCapture(videoElement, audioTrackRef, resolveOnce);
              } else if (videoTrackRef) {
                // Fallback with video track only
                console.warn('[DvrRecording] No separate audio track, using video track only');
                const canvas = document.createElement('canvas');
                canvas.width = videoElement.videoWidth || 640;
                canvas.height = videoElement.videoHeight || 360;
                canvas.style.position = 'fixed';
                canvas.style.width = '1px';
                canvas.style.height = '1px';
                canvas.style.top = '0';
                canvas.style.left = '0';
                canvas.style.opacity = '0.01';
                canvas.style.pointerEvents = 'none';
                canvas.style.zIndex = '-9999';
                document.body.appendChild(canvas);

                const ctx = canvas.getContext('2d')!;
                let animationId = 0;
                const drawFrame = () => {
                  if (videoElement.readyState >= 2) {
                    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                  }
                  animationId = requestAnimationFrame(drawFrame);
                };
                animationId = requestAnimationFrame(drawFrame);

                const canvasStream = canvas.captureStream(30);
                resolveOnce({
                  mediaStream: canvasStream,
                  videoElement,
                  canvasElement: canvas,
                  animationId,
                  audioContext: null,
                });
              } else {
                rejectOnce(new Error('No video track available'));
              }
            } else if (checkCount >= maxChecks) {
              // Timeout - proceed anyway with what we have
              console.error('[DvrRecording] Video never got data, proceeding anyway');
              if (videoTrackRef && audioTrackRef) {
                setupCanvasCapture(videoElement, audioTrackRef, resolveOnce);
              } else {
                rejectOnce(new Error('Video never got data'));
              }
            } else {
              // Keep waiting
              setTimeout(checkVideo, 200);
            }
          };

          // Start playing first
          videoElement
            .play()
            .then(() => {
              console.log('[DvrRecording] Video play started in timeout handler');
              checkVideo();
            })
            .catch((err) => {
              console.error('[DvrRecording] Video play failed in timeout handler:', err);
              // Try checking anyway
              checkVideo();
            });
        };

        // Give the track a moment to attach
        setTimeout(waitForVideoData, 500);
      } else {
        rejectOnce(new Error('Timeout waiting for media tracks'));
      }
    }, 30000);
  });
}

// Get supported MIME type for MediaRecorder
function getSupportedMimeType(): string {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
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
   */
  async function startDvrSession(
    mintId: string,
    streamerId: string,
    displayName: string
  ): Promise<void> {
    // Check if already recording
    if (activeDvrSessions.value.has(mintId)) {
      console.log('[DvrRecording] DVR session already active for:', mintId);
      return;
    }

    console.log('[DvrRecording] Starting DVR session for:', mintId, displayName);

    try {
      // Check if stream is live
      const liveStatus = await checkLiveStatus(mintId);
      if (!liveStatus.isLive) {
        console.log('[DvrRecording] Stream not live, skipping DVR start');
        return;
      }

      // Get join token
      const { token, serverUrl } = await joinLivestream(mintId);

      // Create dedicated background LiveKit connection
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      // Set up disconnect handler
      room.on(RoomEvent.Disconnected, () => {
        console.log('[DvrRecording] Room disconnected for:', mintId);
        const session = activeDvrSessions.value.get(mintId);
        if (session) {
          session.streamEnded = true;
          session.isRecording = false;
        }
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
        canvasElement: null,
        canvasAnimationId: null,
        audioContext: null,
        chunks: [],
        totalDuration: 0,
        startedAt: Date.now(),
        isRecording: false,
        streamEnded: false,
        chunkIndex: 0,
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

    const recorder = new MediaRecorder(mediaStream, {
      mimeType,
      videoBitsPerSecond: 4000000, // 4 Mbps
      audioBitsPerSecond: 128000, // 128 kbps
    });

    session.mediaRecorder = recorder;

    // Serialize chunk processing so indices cannot collide and files cannot be overwritten.
    let saveChain: Promise<void> = Promise.resolve();
    // Keep a local chunk index to ensure monotonicity regardless of session state updates
    let localChunkIndex = session.chunkIndex;

    recorder.ondataavailable = (event) => {
      console.log(`[DvrRecording] ondataavailable fired, size: ${event.data.size} bytes`);

      if (event.data.size === 0) {
        console.log('[DvrRecording] Empty chunk received, skipping');
        return;
      }

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

          console.log(`[DvrRecording] Saving chunk ${chunkIndex} (${data.length} bytes)...`);

          // Save chunk via Tauri
          const chunkPath = await invoke<string>('save_dvr_chunk', {
            mintId,
            chunkIndex,
            data,
          });

          // Calculate timing deterministically from index
          // NOTE: If chunks vary in size/duration (like the 19MB one), this timestamp logic desyncs from reality.
          // Ideally we should use wall-clock time difference, but for now fixed duration is expected.
          // We can at least clamp the duration if the file size is tiny, but duration is time-based.
          const duration = DVR_CHUNK_DURATION_SECONDS;
          const startTime = chunkIndex * duration;

          const chunk: DvrChunk = {
            index: chunkIndex,
            path: chunkPath,
            duration,
            startTime,
            endTime: startTime + duration,
          };

          currentSession.chunks.push(chunk);
          currentSession.chunks.sort((a, b) => a.index - b.index);
          currentSession.totalDuration = Math.max(currentSession.totalDuration, chunk.endTime);

          // Trigger reactivity update
          const newMap = new Map(activeDvrSessions.value);
          newMap.set(mintId, currentSession);
          activeDvrSessions.value = newMap;

          console.log(
            `[DvrRecording] Chunk ${chunk.index} saved for ${mintId}, total duration: ${currentSession.totalDuration}s, path: ${chunkPath}`
          );
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

    // Debug: log MediaRecorder status periodically
    const statusInterval = setInterval(() => {
      const currentSession = activeDvrSessions.value.get(mintId);
      if (!currentSession || !currentSession.isRecording) {
        clearInterval(statusInterval);
        return;
      }

      console.log(
        `[DvrRecording] Status for ${mintId}: recorder=${recorder.state}, stream.active=${mediaStream.active}, chunks=${currentSession.chunks.length}, duration=${currentSession.totalDuration}s`
      );

      // Log track states
      mediaStream.getTracks().forEach((track) => {
        console.log(
          `[DvrRecording] Track ${track.kind}: enabled=${track.enabled}, readyState=${track.readyState}, muted=${track.muted}`
        );
      });
    }, 10000); // Log every 10 seconds
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

      // Stop canvas animation frame
      if (session.canvasAnimationId) {
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
        session.hiddenVideoElement.pause();
        session.hiddenVideoElement.srcObject = null;
        session.hiddenVideoElement.remove();
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
