/**
 * @deprecated This composable is deprecated in favor of HLS-based recording.
 * The browser-based MediaRecorder approach has been replaced with server-side
 * Node.js recording that outputs HLS format for better reliability.
 *
 * This file is kept for reference and potential fallback scenarios.
 */

import { ref, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import {
  Room,
  RoomEvent,
  Track,
  TrackEvent,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteParticipant,
  VideoQuality,
  type VideoTrack,
  type AudioTrack,
} from 'livekit-client';

// Type extension for CanvasCaptureMediaStreamTrack which has requestFrame()
interface CanvasCaptureMediaStreamTrack extends MediaStreamTrack {
  requestFrame(): void;
}

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
export type OnChunkReadyCallback = (
  chunk: DvrChunk,
  mintId: string,
  streamerId: string,
  sessionId: string
) => void | Promise<void>;

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

// Helper to identify if a participant is the main broadcaster vs a guest
// PumpFun streams can have guests on "stage" with their own video/audio tracks
function isMainBroadcasterParticipant(identity: string, mainBroadcasterIdentity: string | null): boolean {
  if (!identity) return false;
  
  // If we already identified a main broadcaster, only they are the main broadcaster
  if (mainBroadcasterIdentity) {
    return identity === mainBroadcasterIdentity;
  }
  
  // Skip viewer and ingress tracks - these are auxiliary
  if (identity.includes('-viewer-') || identity.includes('-ingress')) {
    return false;
  }
  
  // Check for common broadcaster identity patterns
  const broadcasterPatterns = ['host', 'broadcaster', 'streamer', 'main'];
  const identityLower = identity.toLowerCase();
  if (broadcasterPatterns.some(p => identityLower.includes(p))) {
    return true;
  }
  
  // Check if identity looks like a guest (UUID pattern or numeric ID)
  const looksLikeGuest = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identity) ||
                         /^guest[-_]?\d*/i.test(identity) ||
                         /^user[-_]?\d+$/i.test(identity);
  
  if (looksLikeGuest) {
    return false;
  }
  
  // Default: assume first non-guest participant is main broadcaster
  return true;
}

// Wait for video and audio tracks from room and create a direct MediaStream capture
// This approach uses the LiveKit MediaStreamTracks directly, avoiding canvas issues
// UPDATED: Supports multiple audio tracks (main broadcaster + guests) mixed via AudioContext
function waitForTracks(room: Room): Promise<CaptureSetup> {
  return new Promise((resolve, reject) => {
    let videoTrackRef: VideoTrack | null = null;
    // Changed: Now we collect ALL audio tracks for mixing
    const audioTrackRefs: AudioTrack[] = [];
    let hasVideo = false;
    let hasAudio = false;
    let timeout: number | null = null;
    let startingCapture = false;
    let settled = false;
    let mainBroadcasterIdentity: string | null = null;

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

    const checkComplete = async () => {
      if (startingCapture || settled) return;
      console.log('[DvrRecording] checkComplete called:', {
        hasVideo,
        hasAudio,
        hasVideoRef: !!videoTrackRef,
        audioTrackCount: audioTrackRefs.length,
      });

      if (hasVideo && hasAudio && videoTrackRef && audioTrackRefs.length > 0) {
        startingCapture = true;
        console.log('[DvrRecording] All tracks ready, starting direct capture setup');
        console.log(`[DvrRecording] Mixing ${audioTrackRefs.length} audio track(s)`);
        cleanup();

        // Get the underlying MediaStreamTracks
        const videoMST = videoTrackRef.mediaStreamTrack;
        
        // Create AudioContext to mix multiple audio tracks
        const audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();
        
        // Connect all audio tracks to the mixer
        for (const audioTrack of audioTrackRefs) {
          const audioMST = audioTrack.mediaStreamTrack;
          if (audioMST) {
            const source = audioContext.createMediaStreamSource(new MediaStream([audioMST]));
            source.connect(destination);
            console.log(`[DvrRecording] Connected audio track to mixer: ${audioMST.label || audioMST.id}`);
          }
        }
        
        // Get the mixed audio track
        const mixedAudioTrack = destination.stream.getAudioTracks()[0];
        if (!mixedAudioTrack) {
          console.error('[DvrRecording] Failed to create mixed audio track');
          rejectOnce(new Error('Failed to create mixed audio track'));
          return;
        }
        
        console.log(`[DvrRecording] Mixed audio track created: enabled=${mixedAudioTrack.enabled}, readyState=${mixedAudioTrack.readyState}`);

        if (videoMST && mixedAudioTrack) {
          // ============================================================================
          // CANVAS-BASED CAPTURE (Production-ready, resilient to SFU track muting)
          // ============================================================================
          //
          // WHY CANVAS CAPTURE:
          // LiveKit's SFU can mute the raw video track at any time (server-side decision).
          // When this happens, MediaRecorder receives no frames = corrupt chunks.
          //
          // Canvas capture creates a LOCAL MediaStream by:
          // 1. Rendering video frames to a canvas at 30fps
          // 2. Capturing the canvas as a new stream
          // 3. Even if source track briefly mutes, we have the last rendered frame
          //
          // This is more resilient because we control the stream, not the SFU.
          // ============================================================================

          console.log('[DvrRecording] Using CANVAS-BASED capture for reliable recording');
          console.log(
            `[DvrRecording] Video track: enabled=${videoMST.enabled}, readyState=${videoMST.readyState}, muted=${videoMST.muted}`
          );
          console.log(
            `[DvrRecording] Mixed audio track: enabled=${mixedAudioTrack.enabled}, readyState=${mixedAudioTrack.readyState}`
          );

          // Create a VISIBLE video element - browsers throttle hidden videos
          // and LiveKit's SFU may reduce quality/pause for "invisible" consumers
          const liveKitVideoElement = document.createElement('video');
          liveKitVideoElement.id =
            'dvr-livekit-consumer-' + Math.random().toString(36).substr(2, 9);
          liveKitVideoElement.muted = true;
          liveKitVideoElement.playsInline = true;
          liveKitVideoElement.autoplay = true;
          liveKitVideoElement.crossOrigin = 'anonymous';
          // Make it VISIBLE but small - this is crucial for reliable capture
          // Completely hidden elements get throttled by browser AND SFU thinks nobody is watching
          liveKitVideoElement.style.position = 'fixed';
          liveKitVideoElement.style.width = '160px';
          liveKitVideoElement.style.height = '90px';
          liveKitVideoElement.style.bottom = '0px';
          liveKitVideoElement.style.right = '0px';
          liveKitVideoElement.style.opacity = '0.01';
          liveKitVideoElement.style.pointerEvents = 'none';
          liveKitVideoElement.style.zIndex = '1'; // Keep it in the rendering flow
          document.body.appendChild(liveKitVideoElement);

          // Attach video track via LiveKit's attach() - signals consumption to SFU
          videoTrackRef.attach(liveKitVideoElement);
          console.log('[DvrRecording] Attached video track to consumer element');

          // Continuously request HIGH quality to prevent SFU from downgrading
          let qualityRequestInterval: number | null = null;
          try {
            console.log('[DvrRecording] Checking for publication property...');
            const publication = (videoTrackRef as any).publication;
            if (publication && typeof publication.setVideoQuality === 'function') {
              // Request high quality immediately
              try {
                (publication as RemoteTrackPublication).setVideoQuality(VideoQuality.HIGH);
                console.log('[DvrRecording] Requested HIGH video quality');
              } catch (e) {
                console.log('[DvrRecording] Could not set initial video quality:', e);
              }

              // Keep requesting high quality every 5 seconds to prevent SFU from downgrading
              qualityRequestInterval = window.setInterval(() => {
                try {
                  (publication as RemoteTrackPublication).setVideoQuality(VideoQuality.HIGH);
                } catch (e) {
                  // Ignore errors
                }
              }, 5000);
            } else {
              console.log('[DvrRecording] No publication or setVideoQuality not available');
            }
          } catch (pubError) {
            console.log('[DvrRecording] Error accessing publication:', pubError);
          }

          // Hidden audio element for audio track consumption
          // Note: We don't need to attach audio tracks to elements since we're using AudioContext mixer
          const hiddenAudioElement = document.createElement('audio');
          hiddenAudioElement.id = 'dvr-audio-consumer-' + Math.random().toString(36).substr(2, 9);
          hiddenAudioElement.muted = true;
          hiddenAudioElement.volume = 0;
          hiddenAudioElement.style.position = 'fixed';
          hiddenAudioElement.style.width = '0';
          hiddenAudioElement.style.height = '0';
          hiddenAudioElement.style.opacity = '0';
          document.body.appendChild(hiddenAudioElement);
          // Attach all audio tracks to hidden elements to keep them active
          for (const audioTrack of audioTrackRefs) {
            audioTrack.attach(hiddenAudioElement);
          }

          // Start playing both elements with retry logic and timeout
          // LiveKit can interrupt play() or hang indefinitely
          const playWithTimeout = (element: HTMLVideoElement | HTMLAudioElement, timeoutMs = 3000): Promise<void> => {
            return new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error('Play timeout'));
              }, timeoutMs);
              
              element.play()
                .then(() => {
                  clearTimeout(timeout);
                  resolve();
                })
                .catch((err) => {
                  clearTimeout(timeout);
                  reject(err);
                });
            });
          };

          const playWithRetry = async (element: HTMLVideoElement | HTMLAudioElement, name: string, maxRetries = 3) => {
            console.log(`[DvrRecording] Starting ${name} play attempts...`);
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
              try {
                await playWithTimeout(element);
                console.log(`[DvrRecording] ${name} element playing`);
                return true;
              } catch (e: any) {
                console.log(`[DvrRecording] ${name} play attempt ${attempt} failed:`, e?.message || e?.name || e);
                if (attempt < maxRetries) {
                  // Wait a bit before retrying - give LiveKit time to settle
                  await new Promise(r => setTimeout(r, 200 * attempt));
                }
              }
            }
            console.warn(`[DvrRecording] ${name} play failed after ${maxRetries} attempts, continuing anyway`);
            return false;
          };

          await playWithRetry(liveKitVideoElement, 'Video');
          await playWithRetry(hiddenAudioElement, 'Audio');

          // Wait for video to have dimensions and preferably reach high resolution
          let waitAttempts = 0;
          const maxWaitAttempts = 50; // 5 seconds max
          const minDesiredWidth = 1280; // Wait for at least 720p if possible
          while (waitAttempts < maxWaitAttempts) {
            const w = liveKitVideoElement.videoWidth;
            const h = liveKitVideoElement.videoHeight;
            // Stop waiting if we have good resolution or waited long enough with any resolution
            if (w >= minDesiredWidth || (w > 0 && waitAttempts >= 20)) {
              break;
            }
            await new Promise((r) => setTimeout(r, 100));
            waitAttempts++;
          }

          let currentWidth = liveKitVideoElement.videoWidth || 1280;
          let currentHeight = liveKitVideoElement.videoHeight || 720;
          console.log(`[DvrRecording] Video dimensions: ${currentWidth}x${currentHeight}`);

          // Create canvas for capture
          const canvas = document.createElement('canvas');
          canvas.width = currentWidth;
          canvas.height = currentHeight;
          canvas.style.position = 'fixed';
          canvas.style.width = '1px';
          canvas.style.height = '1px';
          canvas.style.bottom = '0';
          canvas.style.right = '0';
          canvas.style.opacity = '0.01';
          canvas.style.pointerEvents = 'none';
          canvas.style.zIndex = '1';
          document.body.appendChild(canvas);

          const ctx = canvas.getContext('2d', {
            willReadFrequently: false,
            alpha: false, // Opaque canvas is faster
          })!;

          // Create canvas capture stream - use 0 for on-demand capture via requestFrame()
          // This gives us precise control over frame timing
          const canvasStream = canvas.captureStream(0);
          const capturedVideoTrack = canvasStream.getVideoTracks()[0] as
            | CanvasCaptureMediaStreamTrack
            | undefined;

          // Use setInterval for consistent frame timing instead of requestAnimationFrame
          // requestAnimationFrame can be throttled by the browser when tab is not focused
          let frameCount = 0;
          let lastLogTime = Date.now();
          let consecutiveMutedFrames = 0;
          let lastGoodFrame: ImageData | null = null;
          const MUTED_FRAME_THRESHOLD = 15; // ~0.5s of muted frames before using last good frame

          // Use setInterval at 30fps (33.33ms) for consistent frame capture
          const frameInterval = setInterval(() => {
            const videoReady = liveKitVideoElement.readyState >= 2;
            const videoMuted = videoMST.muted;

            // Check if video dimensions changed and resize canvas
            const newWidth = liveKitVideoElement.videoWidth;
            const newHeight = liveKitVideoElement.videoHeight;
            if (
              newWidth > 0 &&
              newHeight > 0 &&
              (newWidth !== currentWidth || newHeight !== currentHeight)
            ) {
              console.log(
                `[DvrRecording] Video dimensions changed: ${currentWidth}x${currentHeight} -> ${newWidth}x${newHeight}`
              );
              currentWidth = newWidth;
              currentHeight = newHeight;
              canvas.width = currentWidth;
              canvas.height = currentHeight;
              lastGoodFrame = null; // Invalidate old frame data
            }

            // Always draw a frame to maintain consistent timing
            if (videoReady && !videoMuted) {
              // Normal case: video is playing, draw it
              ctx.drawImage(liveKitVideoElement, 0, 0, currentWidth, currentHeight);
              frameCount++;
              consecutiveMutedFrames = 0;

              // Save this as the last good frame (every ~1 second to reduce overhead)
              if (frameCount % 30 === 0) {
                try {
                  lastGoodFrame = ctx.getImageData(0, 0, currentWidth, currentHeight);
                } catch (e) {
                  // Ignore - cross-origin issues possible
                }
              }
            } else if (videoMuted || !videoReady) {
              // Track is muted or not ready - use last good frame to maintain stream continuity
              consecutiveMutedFrames++;

              if (consecutiveMutedFrames === 1 && videoMuted) {
                console.warn('[DvrRecording] Video track muted by SFU, holding last frame');
              }

              // If we have a last good frame, redraw it to keep the stream alive
              if (lastGoodFrame) {
                ctx.putImageData(lastGoodFrame, 0, 0);
              } else {
                // No good frame yet, draw a black frame to maintain timing
                ctx.fillStyle = 'black';
                ctx.fillRect(0, 0, currentWidth, currentHeight);
              }
              frameCount++;

              // Log extended muting
              if (consecutiveMutedFrames === MUTED_FRAME_THRESHOLD) {
                console.error(
                  '[DvrRecording] Video track muted for extended period - frames may be stale'
                );
              }
            }

            // Always request frame capture to maintain consistent frame rate
            if (capturedVideoTrack && 'requestFrame' in capturedVideoTrack) {
              try {
                capturedVideoTrack.requestFrame();
              } catch (e) {}
            }

            // Periodic logging
            const nowMs = Date.now();
            if (nowMs - lastLogTime >= 10000) {
              const fps = frameCount / 10;
              console.log(
                `[DvrRecording] Canvas capture: ${frameCount} frames in 10s (${fps.toFixed(1)} fps), ` +
                  `video ready: ${liveKitVideoElement.readyState >= 2}, muted: ${videoMST.muted}, ` +
                  `dimensions: ${liveKitVideoElement.videoWidth}x${liveKitVideoElement.videoHeight}`
              );
              frameCount = 0;
              lastLogTime = nowMs;
            }
          }, 1000 / 30); // 30fps = 33.33ms interval

          // Store interval ID for cleanup (cast to number for compatibility)
          const animationId = frameInterval as unknown as number;

          // Create combined stream: canvas video + LiveKit audio
          const recordingStream = new MediaStream();
          canvasStream.getVideoTracks().forEach((track) => {
            recordingStream.addTrack(track);
            console.log(`[DvrRecording] Added canvas video track: ${track.label}`);
          });
          recordingStream.addTrack(mixedAudioTrack);
          console.log('[DvrRecording] Added mixed audio track');

          console.log(
            '[DvrRecording] Recording stream ready:',
            recordingStream.getTracks().length,
            'tracks'
          );

          // Clean up quality interval when done
          if (qualityRequestInterval) {
            // Store for cleanup - will be cleared when session stops
            (liveKitVideoElement as any).__qualityInterval = qualityRequestInterval;
          }

          resolveOnce({
            mediaStream: recordingStream,
            videoElement: liveKitVideoElement,
            audioElement: hiddenAudioElement,
            canvasElement: canvas,
            animationId,
            audioContext: null,
          });
          return;
        }

        // Fallback to canvas-based capture if direct capture fails
        console.log('[DvrRecording] Falling back to canvas-based capture');

        // Create video element for playback (used for canvas capture only, NOT for user audio)
        const videoElement = document.createElement('video');
        videoElement.muted = true; // Mute to allow autoplay and prevent audio output
        videoElement.volume = 0; // Ensure volume is 0 as backup
        videoElement.playsInline = true;
        videoElement.autoplay = true;
        videoElement.crossOrigin = 'anonymous';
        // Make it visible but small and transparent - browsers throttle hidden videos
        // Use 10x10 size to prevent throttling while staying unobtrusive
        videoElement.style.position = 'fixed';
        videoElement.style.width = '10px';
        videoElement.style.height = '10px';
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

        // Start playing
        videoElement
          .play()
          .then(() => {
            console.log('[DvrRecording] Video playing, setting up canvas capture');

            // Wait for video to have dimensions
            const waitForDimensions = () => {
              if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                setupCanvasCapture(videoElement, audioTrackRefs, resolveOnce);
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
              setupCanvasCapture(videoElement, audioTrackRefs, resolveOnce);
            }, 1000);
          });
      }
    };

    function setupCanvasCapture(
      videoElement: HTMLVideoElement,
      audioTracks: AudioTrack[],
      resolveCapture: (result: CaptureSetup) => void
    ) {
      // Create canvas matching video dimensions (or default if not available)
      const width = videoElement.videoWidth || 640;
      const height = videoElement.videoHeight || 360;

      console.log(`[DvrRecording] Setting up canvas capture: ${width}x${height}`);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      // Make visible but small and transparent - browsers may throttle hidden canvases
      // Use a larger size (10x10) to prevent throttling while staying unobtrusive
      canvas.style.position = 'fixed';
      canvas.style.width = '10px';
      canvas.style.height = '10px';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.opacity = '0.01';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '-9999';
      document.body.appendChild(canvas);

      // Use willReadFrequently for better performance with continuous drawing
      const ctx = canvas.getContext('2d', { willReadFrequently: false })!;

      // Capture stream from canvas with explicit 30 FPS
      // Note: We need to create the stream BEFORE the draw loop so we can call requestFrame()
      const canvasStream = canvas.captureStream(30);

      // Get the video track to call requestFrame() on it
      const capturedVideoTrack = canvasStream.getVideoTracks()[0] as
        | CanvasCaptureMediaStreamTrack
        | undefined;

      // Draw video frames to canvas continuously
      let animationId = 0;
      let frameCount = 0;
      let lastLogTime = Date.now();
      let lastDrawTime = 0;
      const targetFrameMs = 1000 / 30; // Target 30 fps for drawing

      const drawFrame = () => {
        const now = performance.now();

        // Throttle to ~30fps to match capture rate
        if (now - lastDrawTime >= targetFrameMs) {
          lastDrawTime = now;

          if (videoElement.readyState >= 2) {
            // HAVE_CURRENT_DATA or better
            ctx.drawImage(videoElement, 0, 0, width, height);
            frameCount++;

            // Explicitly request a frame capture if the track supports it
            if (capturedVideoTrack && 'requestFrame' in capturedVideoTrack) {
              try {
                capturedVideoTrack.requestFrame();
              } catch (e) {
                // Ignore errors - not all browsers support this
              }
            }
          }
        }

        // Log frame rate every 5 seconds
        const nowMs = Date.now();
        if (nowMs - lastLogTime >= 5000) {
          console.log(
            `[DvrRecording] Canvas drawing: ${frameCount} frames in 5s (${(frameCount / 5).toFixed(1)} fps), video readyState: ${videoElement.readyState}`
          );
          frameCount = 0;
          lastLogTime = nowMs;
        }

        animationId = requestAnimationFrame(drawFrame);
      };
      animationId = requestAnimationFrame(drawFrame);

      console.log('[DvrRecording] Canvas stream created, tracks:', canvasStream.getTracks().length);

      // Now add audio tracks - mix multiple tracks using AudioContext
      let audioContext: AudioContext | null = null;

      if (audioTracks.length > 0) {
        // Create AudioContext to mix multiple audio tracks
        audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();
        
        // Connect all audio tracks to the mixer
        for (const audioTrack of audioTracks) {
          const audioMST = audioTrack.mediaStreamTrack;
          if (audioMST) {
            const source = audioContext.createMediaStreamSource(new MediaStream([audioMST]));
            source.connect(destination);
            console.log(`[DvrRecording] Connected audio track to mixer: ${audioMST.label || audioMST.id}`);
          }
        }
        
        // Get the mixed audio track
        const mixedAudioTrack = destination.stream.getAudioTracks()[0];
        
        if (mixedAudioTrack) {
          // Create a new MediaStream with both canvas video and mixed audio
          const combinedStream = new MediaStream();

          // Add canvas video track
          canvasStream.getVideoTracks().forEach((track) => {
            console.log(
              `[DvrRecording] Adding canvas video track: enabled=${track.enabled}, readyState=${track.readyState}`
            );
            combinedStream.addTrack(track);
          });

          // Add mixed audio track
          console.log(
            `[DvrRecording] Adding mixed audio track: enabled=${mixedAudioTrack.enabled}, readyState=${mixedAudioTrack.readyState}`
          );
          combinedStream.addTrack(mixedAudioTrack);

          console.log(
            '[DvrRecording] Combined stream ready:',
            combinedStream.getTracks().length,
            'tracks'
          );

          resolveCapture({
            mediaStream: combinedStream,
            videoElement,
            audioElement: null, // Canvas capture doesn't need separate audio element
            canvasElement: canvas,
            animationId,
            audioContext,
          });
        } else {
          console.warn('[DvrRecording] Failed to create mixed audio track, proceeding with video only');
          resolveCapture({
            mediaStream: canvasStream,
            videoElement,
            audioElement: null,
            canvasElement: canvas,
            animationId,
            audioContext: null,
          });
        }
      } else {
        console.warn('[DvrRecording] No audio tracks available, proceeding with video only');
        resolveCapture({
          mediaStream: canvasStream,
          videoElement,
          audioElement: null,
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

      // Skip viewer and ingress tracks - we want the main broadcaster tracks
      // -ingress tracks are duplicates that can cause race conditions
      if (participant.identity.includes('-viewer-') || participant.identity.includes('-ingress')) {
        console.log('[DvrRecording] Skipping auxiliary track from:', participant.identity);
        return;
      }

      // Determine if this participant is the main broadcaster
      const isMainBroadcaster = isMainBroadcasterParticipant(participant.identity, mainBroadcasterIdentity);

      // VIDEO: Only capture from main broadcaster, not guests
      if (track.kind === Track.Kind.Video && !hasVideo) {
        if (isMainBroadcaster) {
          videoTrackRef = track as VideoTrack;
          hasVideo = true;
          mainBroadcasterIdentity = participant.identity;
          console.log('[DvrRecording] Video track captured from main broadcaster:', participant.identity);

          // Request high quality video to ensure we get continuous frames
          // This prevents adaptive streaming from pausing the track
          try {
            publication.setVideoQuality(VideoQuality.HIGH);
            console.log('[DvrRecording] Set video quality to HIGH');
          } catch (e) {
            console.log('[DvrRecording] Could not set video quality:', e);
          }
        } else {
          console.log('[DvrRecording] SKIPPING guest video track from:', participant.identity);
        }
      } 
      // AUDIO: Capture ALL audio tracks (main broadcaster + guests) for mixing
      else if (track.kind === Track.Kind.Audio) {
        // Check if we already have this track
        const existingTrack = audioTrackRefs.find(t => t.sid === track.sid);
        if (!existingTrack) {
          audioTrackRefs.push(track as AudioTrack);
          hasAudio = true;
          console.log(`[DvrRecording] Audio track ${audioTrackRefs.length} captured from:`, participant.identity, isMainBroadcaster ? '(main)' : '(guest)');
        }
      }

      checkComplete();
    };

    // Check existing tracks first - prioritize main broadcaster (not viewer or ingress)
    const participants = Array.from(room.remoteParticipants.values());
    participants.sort((a, b) => {
      const aIsAuxiliary = a.identity.includes('-viewer-') || a.identity.includes('-ingress');
      const bIsAuxiliary = b.identity.includes('-viewer-') || b.identity.includes('-ingress');
      if (aIsAuxiliary && !bIsAuxiliary) return 1;
      if (!aIsAuxiliary && bIsAuxiliary) return -1;
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
        // Make visible but small and transparent - browsers throttle hidden videos
        // Use 10x10 size to prevent throttling while staying unobtrusive
        videoElement.style.position = 'fixed';
        videoElement.style.width = '10px';
        videoElement.style.height = '10px';
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
              if (videoTrackRef && audioTrackRefs.length > 0) {
                setupCanvasCapture(videoElement, audioTrackRefs, resolveOnce);
              } else if (videoTrackRef) {
                // Fallback with video track only
                console.warn('[DvrRecording] No separate audio track, using video track only');
                const canvas = document.createElement('canvas');
                canvas.width = videoElement.videoWidth || 640;
                canvas.height = videoElement.videoHeight || 360;
                canvas.style.position = 'fixed';
                canvas.style.width = '10px';
                canvas.style.height = '10px';
                canvas.style.top = '0';
                canvas.style.left = '0';
                canvas.style.opacity = '0.01';
                canvas.style.pointerEvents = 'none';
                canvas.style.zIndex = '-9999';
                document.body.appendChild(canvas);

                const ctx = canvas.getContext('2d', { willReadFrequently: false })!;

                // Create capture stream with explicit framerate
                const canvasStream = canvas.captureStream(30);
                const capturedVideoTrack = canvasStream.getVideoTracks()[0] as
                  | CanvasCaptureMediaStreamTrack
                  | undefined;

                let animationId = 0;
                let lastDrawTime = 0;
                const targetFrameMs = 1000 / 30;

                const drawFrame = () => {
                  const now = performance.now();
                  if (now - lastDrawTime >= targetFrameMs) {
                    lastDrawTime = now;
                    if (videoElement.readyState >= 2) {
                      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                      if (capturedVideoTrack && 'requestFrame' in capturedVideoTrack) {
                        try {
                          capturedVideoTrack.requestFrame();
                        } catch (e) {}
                      }
                    }
                  }
                  animationId = requestAnimationFrame(drawFrame);
                };
                animationId = requestAnimationFrame(drawFrame);
                resolveOnce({
                  mediaStream: canvasStream,
                  videoElement,
                  audioElement: null,
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
              if (videoTrackRef && audioTrackRefs.length > 0) {
                setupCanvasCapture(videoElement, audioTrackRefs, resolveOnce);
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
   */
  async function startDvrSession(
    mintId: string,
    streamerId: string,
    displayName: string,
    options?: {
      sessionId?: string;
      onChunkReady?: OnChunkReadyCallback;
    }
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
    // Track when we last received a valid chunk (for smart force flush)
    let lastValidChunkAt = Date.now();
    // Track consecutive bad chunks for recovery
    let consecutiveBadChunks = 0;
    const MAX_CONSECUTIVE_BAD_CHUNKS = 3;

    recorder.ondataavailable = (event) => {
      const chunkSize = event.data.size;
      const wasMutedDuringChunk = mutedDuringChunk;
      mutedDuringChunk = false; // Reset for next chunk

      console.log(
        `[DvrRecording] ondataavailable fired, size: ${chunkSize} bytes, mutedDuringChunk: ${wasMutedDuringChunk}, currentlyMuted: ${videoTrackMuted}`
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

          // Call onChunkReady callback if in auto-detect mode
          if (currentSession.onChunkReady && currentSession.sessionId) {
            console.log(
              `[DvrRecording] Calling onChunkReady for auto-detect, chunk ${chunk.index}`
            );
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
        session.hiddenVideoElement.pause();
        session.hiddenVideoElement.srcObject = null;
        session.hiddenVideoElement.remove();
      }

      // Clean up hidden audio element
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
