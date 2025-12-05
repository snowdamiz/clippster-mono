#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { once } from 'events';
import {
  AudioStream,
  Room,
  RoomEvent,
  TrackKind,
  VideoStream,
  VideoBufferType,
} from '@livekit/rtc-node';

const VIDEO_QUALITY_HIGH = 2;
// Audio-Video Sync Configuration
// The sync is now PTS-based (presentation timestamp) for both audio and video.
//
// AUDIO_ADVANCE_MS: Manual offset to fix audio being behind video.
// Positive value = advance audio (audio plays earlier) - fixes "audio behind" issues
// Adjust this value if audio is consistently behind across all streams.
// Typical values: 100-300ms
const AUDIO_ADVANCE_MS = 208; // Advance audio by 200ms to fix sync

const AUDIO_FALLBACK_OFFSET_MS = 0; // Only used as fallback if sync setup fails
const DEBUG_SYNC = true; // Enabled to diagnose video stride issues

const args = process.argv.slice(2);
const [mintId, sessionId, outputDirArg, segmentMinutesArg] = args;

if (!mintId || !sessionId || !outputDirArg) {
  console.error(
    JSON.stringify({
      type: 'error',
      message: 'Usage: record-livestream.mjs <mintId> <sessionId> <outputDir> [segmentMinutes]',
    })
  );
  process.exit(1);
}

const segmentMinutes = Math.max(parseInt(segmentMinutesArg || '5', 10), 1);
const segmentDurationSeconds = segmentMinutes * 60;
const outputDir = path.resolve(outputDirArg);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FFMPEG_BINARIES = {
  win32: 'ffmpeg-x86_64-pc-windows-msvc.exe',
  darwin: process.arch === 'arm64' ? 'ffmpeg-aarch64-apple-darwin' : 'ffmpeg-x86_64-apple-darwin',
  linux: 'ffmpeg-x86_64-unknown-linux-gnu',
};

function resolveFfmpegBinary() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }

  const binName = FFMPEG_BINARIES[process.platform];
  if (binName) {
    const candidates = [
      path.resolve(__dirname, '../binaries', binName),
      path.resolve(__dirname, '..', binName),
      path.resolve(__dirname, binName)
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    
    if (process.platform === 'darwin' && process.arch === 'arm64') {
       const x86Name = 'ffmpeg-x86_64-apple-darwin';
       const x86Candidates = [
          path.resolve(__dirname, '../binaries', x86Name),
          path.resolve(__dirname, '..', x86Name)
       ];
       for (const candidate of x86Candidates) {
          if (fs.existsSync(candidate)) {
            return candidate;
          }
       }
    }
  }

  return 'ffmpeg';
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed (${response.status}): ${text}`);
  }
  return response.json();
}

async function getLivestreamInfo(mint) {
  return fetchJson(`https://livestream-api.pump.fun/livestream?mintId=${mint}`);
}

async function joinLivestream(mint) {
  return fetchJson('https://livestream-api.pump.fun/livestream/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mintId: mint, viewer: true }),
  });
}

async function getPreferredRegion(token) {
  try {
    const regions = await fetchJson('https://pump-prod-tg2x8veh.livekit.cloud/settings/regions', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (Array.isArray(regions?.regions) && regions.regions.length > 0) {
      const sorted = [...regions.regions].sort(
        (a, b) => Number(a.distance || Infinity) - Number(b.distance || Infinity)
      );
      return sorted[0]?.url;
    }
  } catch (error) {
    console.warn('[Recorder] Failed to fetch regions', error);
  }
  return 'https://pump-prod-tg2x8veh.livekit.cloud';
}

function log(message, context = {}) {
  console.log(
    JSON.stringify({
      type: 'log',
      message,
      ...context,
    })
  );
}

// Software audio mixer
class AudioMixer {
    constructor(frameSize = 3840) {
        this.frameSize = frameSize;
        this.chunks = new Map(); // timeIndex -> Buffer
        this.lastFlushedIndex = -1;
        // Buffer latency in frames (20ms each). 50 frames = 1000ms jitter buffer
        this.latencyBuffer = 50; 
    }

    mixChunk(timeIndex, buffer) {
        if (!this.chunks.has(timeIndex)) {
            // Allocate new zero-filled buffer (silence)
            this.chunks.set(timeIndex, Buffer.alloc(this.frameSize));
        }
        
        const target = this.chunks.get(timeIndex);
        
        // Mix (add with saturation)
        for (let i = 0; i < target.length; i += 2) {
            const val1 = target.readInt16LE(i);
            const val2 = buffer.readInt16LE(i);
            let sum = val1 + val2;
            if (sum > 32767) sum = 32767;
            if (sum < -32768) sum = -32768;
            target.writeInt16LE(sum, i);
        }
    }

    getReadyChunks(currentTimeIndex) {
        const ready = [];
        // If this is the first flush, start from the earliest chunk we have or currentTimeIndex
        if (this.lastFlushedIndex === -1) {
             // If we have chunks, start from the first one.
             // If not, we just wait.
             if (this.chunks.size > 0) {
                 // Always start flushing from timeIndex 0.
                 // Positive offset (keys[0] > 0): fills 0..keys[0]-1 with silence (DELAY audio)
                 // Negative offset (keys[0] < 0): skips keys[0]..-1 (ADVANCE audio/Crop)
                 this.lastFlushedIndex = -1;
                 
                 // Cleanup negative chunks we are skipping
                 for (const key of this.chunks.keys()) {
                     if (key < 0) this.chunks.delete(key);
                 }
             } else {
                 return [];
             }
        }

        // We want to flush up to (currentTime - latency)
        const targetIndex = currentTimeIndex - this.latencyBuffer;
        
        for (let i = this.lastFlushedIndex + 1; i <= targetIndex; i++) {
            // Check if we have a chunk at this index
            if (this.chunks.has(i)) {
                ready.push(this.chunks.get(i));
                this.chunks.delete(i);
            } else {
                // Gap detected: Fill with silence
                // This ensures output audio is continuous and matches wall-clock duration
                ready.push(Buffer.alloc(this.frameSize));
            }
            this.lastFlushedIndex = i;
        }
        return ready;
    }
    
    reset() {
        this.chunks.clear();
        this.lastFlushedIndex = -1;
    }
}

class PumpfunRecorder {
  constructor({ mintId, sessionId, outputDir, segmentDuration }) {
    this.mintId = mintId;
    this.sessionId = sessionId;
    this.outputDir = outputDir;
    this.segmentDurationSeconds = segmentDuration;
    this.ffmpegPath = resolveFfmpegBinary();
    this.segmentPrefix = `${this.mintId}_${this.sessionId}_segment_`;
    this.playlistPath = path.join(this.outputDir, 'playlist.csv');
    this.processedSegments = new Set();
    this.running = false;
    this.restarting = false;
    this.stopRequested = false; // Flag to signal stop during waiting phase
    this.room = null;
    this.ffmpeg = null;
    this.audioMixer = new AudioMixer();
    this.audioTracks = new Set(); // Set of active track SIDs
    this.videoReader = null;
    this.audioReady = false;
    this.videoReady = false;
    this.encoderStarted = false;
    this.audioPipe = null;
    this.videoPipe = null;
    this.pendingVideo = [];
    this.videoInfo = null;
    this.videoFps = 30; // Deprecated but kept for compatibility
    this.segmentWatcher = null;
    this.playlistPoller = null;
    this.checkingPlaylist = false;
    
    this.currentWidth = 0;
    this.currentHeight = 0;
    this.lastSegmentNumber = -1;
    
    this.fpsSamples = [];
    this.fpsDetected = false;
    
    this.firstAudioTime = null;
    this.firstVideoTime = null;
    this.firstAudioTimestampUs = null; // Audio PTS from LiveKit (or computed)
    this.firstVideoTimestampUs = null;
    this.audioSamplesWritten = 0;
    this.audioFrameCount = 0; // Count audio frames for computed PTS fallback
    
    // Sync reference - calculated from PTS alignment
    this.referenceTime = null;
    this.audioOffsetFromRef = 0; // ms offset to apply to audio timestamps
    this.videoOffsetFromRef = 0; // ms offset to apply to video timestamps
    this.syncMethod = 'unknown'; // 'pts', 'computed-pts', or 'wallclock'
    this.videoFramesWritten = 0;
    this._loggedAudioFrame = false; // Debug: log first audio frame structure
    this._loggedVideoFrame = false; // Debug: log first video frame structure
    this._audioTimestampSource = 'none'; // 'livekit', 'computed', or 'none'
    this.lastVideoFrame = null;
    this.videoQueue = []; // { buffer, timestampUs } sorted
    
    this.pendingResChange = null;
    this.mixerInterval = null;
  }

  async getHardwareEncoderArgs() {
    try {
      const { stdout } = await new Promise((resolve) => {
        const p = spawn(this.ffmpegPath, ['-encoders']);
        let out = '';
        p.stdout.on('data', (d) => (out += d.toString()));
        p.on('close', () => resolve({ stdout: out }));
        p.on('error', () => resolve({ stdout: '' }));
      });

      if (stdout.includes('h264_nvenc')) return ['-c:v', 'h264_nvenc', '-preset', 'p4', '-rc', 'vbr', '-cq', '19'];
      if (stdout.includes('h264_amf')) return ['-c:v', 'h264_amf', '-usage', 'transcoding'];
      if (stdout.includes('h264_qsv')) return ['-c:v', 'h264_qsv', '-global_quality', '20'];
      if (process.platform === 'darwin' && stdout.includes('h264_videotoolbox')) {
         const width = this.videoInfo?.width || 1280;
         let bitrate = '4000k';
         if (width >= 1920) bitrate = '6000k';
         else if (width < 1280) bitrate = '2500k';
         return ['-c:v', 'h264_videotoolbox', '-b:v', bitrate, '-realtime', 'true', '-allow_sw', '1'];
      }
      if (stdout.includes('h264_vaapi')) return ['-c:v', 'h264_vaapi'];

    } catch (e) {
      console.error('[Recorder] Failed to detect hardware encoder', e);
    }

    return [
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-tune', 'zerolatency',
    ];
  }

  async getVideoEncoderArgs() {
    return this.getHardwareEncoderArgs();
  }

  async start() {
    await fs.promises.mkdir(this.outputDir, { recursive: true });

    // Poll until stream goes live or stop is requested
    const POLL_INTERVAL_MS = 15000; // Check every 15 seconds
    let isLive = false;
    let pollCount = 0;
    
    while (!isLive && !this.stopRequested) {
      try {
        const info = await getLivestreamInfo(this.mintId);
        isLive = Boolean(info?.isLive);
        
        if (!isLive) {
          pollCount++;
          // Emit waiting status so frontend knows we're monitoring
          console.log(
            JSON.stringify({
              type: 'waiting_for_stream',
              mintId: this.mintId,
              sessionId: this.sessionId,
              pollCount,
            })
          );
          
          // Wait before next check, but allow early exit if stop requested
          await new Promise((resolve) => {
            const timeout = setTimeout(resolve, POLL_INTERVAL_MS);
            // Store timeout so we can clear it on stop
            this._waitTimeout = timeout;
          });
          this._waitTimeout = null;
        }
      } catch (error) {
        // Log error but continue polling
        console.log(
          JSON.stringify({
            type: 'log',
            message: `Error checking stream status: ${error.message}`,
          })
        );
        // Wait before retry on error
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }
    
    // If stop was requested during waiting, exit cleanly
    if (this.stopRequested) {
      console.log(
        JSON.stringify({
          type: 'log',
          message: 'Stop requested while waiting for stream',
        })
      );
      return;
    }

    // Stream is live - proceed with recording
    console.log(
      JSON.stringify({
        type: 'log',
        message: 'Stream is live, starting recording...',
      })
    );

    const joinData = await joinLivestream(this.mintId);
    const token = joinData?.token;
    if (!token) {
      throw new Error('Failed to obtain LiveKit token');
    }

    const livekitUrl = await getPreferredRegion(token);
    this.running = true;

    await this.startRoom(livekitUrl, token);
    this.startSegmentWatcher();
    
    // Start mixer flush loop
    this.mixerInterval = setInterval(() => this.flushMixer(), 20);
  }

  async startRoom(url, token) {
    this.room = new Room();
    this.room
      .on(RoomEvent.TrackSubscribed, (track) => this.handleTrackSubscribed(track))
      .on(RoomEvent.Disconnected, () => {
        this.emitEvent({
          type: 'stream_ended',
          mintId: this.mintId,
          sessionId: this.sessionId,
        });
        this.stop().catch(() => {});
      });

    await this.room.connect(url, token, { autoSubscribe: true });
  }

  handleTrackSubscribed(track) {
    if (track.kind === TrackKind.KIND_AUDIO) {
      this.bindAudioStream(track);
    } else if (track.kind === TrackKind.KIND_VIDEO && !this.videoReader) {
      try {
          if (track.setVideoQuality) {
              track.setVideoQuality(VIDEO_QUALITY_HIGH);
          }
      } catch(e) {}
      this.bindVideoStream(track);
    }
  }

  async bindAudioStream(track) {
    const trackId = track.sid;
    if (this.audioTracks.has(trackId)) return;
    this.audioTracks.add(trackId);
    
    // log('Audio track subscribed', { trackId });

    try {
      const audioStream = new AudioStream(track, {
        sampleRate: 48000,
        numChannels: 2,
        frameSizeMs: 20,
      });
      const reader = audioStream.getReader();

      // Just ensure we flag audio as ready so encoder can start
      this.audioReady = true;
      if (!this.encoderStarted) await this.startEncoderIfReady();

      let lastAudioIndex = -1;

      while (this.running) {
        const { value, done } = await reader.read();
        if (done || !value) break;
        
        const arrivalTime = Date.now();
        this.audioFrameCount++;
        
        // Extract audio timestamp from LiveKit frame (similar to video)
        // LiveKit provides timestampUs as BigInt presentation timestamp
        // If not available, compute from frame count (each frame = 20ms = 20000us)
        let audioTimestampUs = value.timestampUs;
        let timestampSource = 'livekit';
        
        if (audioTimestampUs === undefined) {
            // Compute PTS from frame count: each frame is exactly 20ms (20000 microseconds)
            // This is reliable because AudioStream is configured with frameSizeMs: 20
            audioTimestampUs = BigInt((this.audioFrameCount - 1) * 20000);
            timestampSource = 'computed';
        }
        
        // Debug: Log first audio frame structure to understand available properties
        if (!this._loggedAudioFrame) {
            this._loggedAudioFrame = true;
            // Always log audio frame structure on first frame - critical for debugging sync issues
            const frameProps = {};
            for (const key of Object.keys(value)) {
                const v = value[key];
                if (typeof v === 'bigint') {
                    frameProps[key] = v.toString() + 'n';
                } else if (v && typeof v === 'object' && v.byteLength !== undefined) {
                    frameProps[key] = `[Buffer ${v.byteLength} bytes]`;
                } else if (typeof v === 'object') {
                    frameProps[key] = JSON.stringify(v);
                } else {
                    frameProps[key] = v;
                }
            }
            log('Audio frame structure', frameProps);
            
            // Also check for nested frame object (some SDKs wrap the data)
            if (value.frame) {
                const nestedProps = {};
                for (const key of Object.keys(value.frame)) {
                    const v = value.frame[key];
                    if (typeof v === 'bigint') {
                        nestedProps[key] = v.toString() + 'n';
                    } else {
                        nestedProps[key] = typeof v;
                    }
                }
                log('Audio frame.frame properties', nestedProps);
            }
        }

        // Track first audio timestamp (both wall-clock and PTS)
        if (!this.firstAudioTime) {
            this.firstAudioTime = arrivalTime;
            this.firstAudioTimestampUs = audioTimestampUs;
            this._audioTimestampSource = timestampSource;
            if (DEBUG_SYNC) {
                log('First audio PTS captured', { 
                    pts: audioTimestampUs.toString(),
                    source: timestampSource,
                    wallClock: arrivalTime 
                });
            }
            this.checkSyncAndStart();
        }
        
        // If reference time is established, push to mixer
        if (this.referenceTime) {
            const buffer = Buffer.from(
              value.data.buffer,
              value.data.byteOffset,
              value.data.byteLength
            );
            
            let timeIndex;
            
            // Use PTS-based timing (always available now - either from LiveKit or computed)
            if ((this.syncMethod === 'pts' || this.syncMethod === 'computed-pts') && this.firstAudioTimestampUs !== null) {
                // Calculate time relative to first audio frame using PTS
                const diffUs = audioTimestampUs - this.firstAudioTimestampUs;
                const diffMs = Number(diffUs) / 1000;
                // Apply sync offset: subtract AUDIO_ADVANCE_MS to make audio play earlier
                // (smaller time index = audio chunk is output sooner)
                const relativeTime = diffMs + this.audioOffsetFromRef - AUDIO_ADVANCE_MS;
                timeIndex = Math.floor(relativeTime / 20);
            } else {
                // Fallback: wall-clock based timing (only if sync setup failed)
                const relativeTime = arrivalTime - this.referenceTime + AUDIO_FALLBACK_OFFSET_MS - AUDIO_ADVANCE_MS;
                timeIndex = Math.floor(relativeTime / 20);
            }

            // Jitter Snapping Logic (only needed for wall-clock mode, but kept for safety):
            // If the calculated index is very close to the expected next index (within 2 frames = 40ms),
            // we snap it to be contiguous. This handles network jitter where packets arrive slightly late/early.
            if (lastAudioIndex !== -1) {
                const diff = timeIndex - (lastAudioIndex + 1);
                if (diff > 0 && diff <= 2) {
                    // Small gap, probably jitter, snap to next
                    timeIndex = lastAudioIndex + 1;
                } else if (diff < 0 && diff >= -2) {
                    // Packet arrived "early" or out of order but close, snap to next
                    timeIndex = lastAudioIndex + 1;
                }
            }

            // Ensure we don't go backwards
            if (timeIndex <= lastAudioIndex) {
                 timeIndex = lastAudioIndex + 1;
            }

            this.audioMixer.mixChunk(timeIndex, buffer);
            lastAudioIndex = timeIndex;
        }
      }
    } catch (error) {
      console.error('[Recorder] Audio stream error', error);
    } finally {
        this.audioTracks.delete(trackId);
    }
  }

  async bindVideoStream(track) {
    try {
      const videoStream = new VideoStream(track);
      this.videoReader = videoStream.getReader();

      while (this.running) {
        const { value, done } = await this.videoReader.read();
        if (done || !value) break;
        
        let arrivalTime = Date.now();
        const frame = value.frame;
        const timestampUs = value.timestampUs; // BigInt from LiveKit

        if (!this.firstVideoTime) {
            this.firstVideoTime = arrivalTime;
            if (timestampUs !== undefined) {
                this.firstVideoTimestampUs = timestampUs;
            }
        } else if (this.firstVideoTimestampUs !== null && timestampUs !== undefined) {
            // Use presentation timestamp to calculate precise arrival time
            // This prevents network jitter from affecting frame spacing
            const diffUs = timestampUs - this.firstVideoTimestampUs;
            // Convert BigInt us to Number ms
            const diffMs = Number(diffUs) / 1000;
            arrivalTime = this.firstVideoTime + diffMs;
        }
        
        if (!this.fpsDetected) {
            this.fpsSamples.push(arrivalTime);
            const count = this.fpsSamples.length;
            
            if (count >= 2) {
                const first = this.fpsSamples[0];
                const last = arrivalTime;
                const duration = last - first;
                
                if (duration >= 1000) {
                    this.videoFps = 30; // Force 30fps for consistency
                    this.fpsDetected = true;
                    this.checkSyncAndStart();
                }
            }
        }
        
        if (!this.firstVideoTime) {
            this.firstVideoTime = arrivalTime;
        }

        const converted = frame.convert(VideoBufferType.I420);
        const width = converted.width;
        const height = converted.height;
        const effectiveWidth = width & ~1;
        const effectiveHeight = height & ~1;

        const yPlane = converted.getPlane(0);
        const uPlane = converted.getPlane(1);
        const vPlane = converted.getPlane(2);

        if (!yPlane || !uPlane || !vPlane) {
          continue;
        }
        
        // Debug: Log video frame structure on first frame to diagnose stride issues
        if (!this._loggedVideoFrame) {
            this._loggedVideoFrame = true;
            const describePlane = (plane, name, planeHeight) => {
                return {
                    type: plane.constructor?.name || typeof plane,
                    stride: plane.stride,
                    byteLength: plane.byteLength,
                    byteOffset: plane.byteOffset,
                    hasBuffer: !!plane.buffer,
                    inferredStride: plane.byteLength && planeHeight > 0 
                        ? Math.floor(plane.byteLength / planeHeight)
                        : 'N/A'
                };
            };
            log('Video frame structure', {
                width: effectiveWidth,
                height: effectiveHeight,
                Y: describePlane(yPlane, 'Y', effectiveHeight),
                U: describePlane(uPlane, 'U', effectiveHeight >> 1),
                V: describePlane(vPlane, 'V', effectiveHeight >> 1)
            });
        }

        // Extract plane data - handles LiveKit's I420 plane format
        // LiveKit planes are TypedArrays (Uint8Array) with potential stride padding
        const extractPlane = (plane, w, h, planeType) => {
             // Convert plane to Buffer - handles TypedArray correctly
             const srcBuffer = Buffer.from(plane.buffer, plane.byteOffset, plane.byteLength);
             
             // Calculate stride - either explicit or inferred from buffer size
             let stride;
             if (typeof plane.stride === 'number' && plane.stride >= w) {
                 stride = plane.stride;
             } else {
                 // Infer stride from buffer size / height
                 stride = Math.floor(srcBuffer.length / h);
                 if (stride < w) stride = w;
             }
             
             // Fast path: no padding, direct copy
             if (stride === w && srcBuffer.length >= w * h) {
                 return Buffer.from(srcBuffer.buffer, srcBuffer.byteOffset, w * h);
             }
             
             // Slow path: remove stride padding row by row
             const tight = Buffer.allocUnsafe(w * h);
             
             for (let row = 0; row < h; row++) {
                 const srcStart = row * stride;
                 const dstStart = row * w;
                 
                 if (srcStart + w <= srcBuffer.length) {
                     srcBuffer.copy(tight, dstStart, srcStart, srcStart + w);
                 } else {
                     // Fill with neutral value if out of bounds
                     const fillValue = planeType === 'Y' ? 16 : 128;
                     tight.fill(fillValue, dstStart, dstStart + w);
                 }
             }
             
             return tight;
        };

        const yBuffer = extractPlane(yPlane, effectiveWidth, effectiveHeight, 'Y');
        const uBuffer = extractPlane(uPlane, effectiveWidth >> 1, effectiveHeight >> 1, 'U');
        const vBuffer = extractPlane(vPlane, effectiveWidth >> 1, effectiveHeight >> 1, 'V');

        const buffer = Buffer.concat([yBuffer, uBuffer, vBuffer]);

        // Store in queue with RELATIVE timestamp (relative to first frame)
        // This ensures all timestamp comparisons use consistent relative values
        if (this.firstVideoTimestampUs !== null && timestampUs !== undefined) {
            const relativeTimestampUs = timestampUs - this.firstVideoTimestampUs;
            this.videoQueue.push({ 
                buffer, 
                timestampUs: relativeTimestampUs, // Now relative, not absolute
                width: effectiveWidth, 
                height: effectiveHeight 
            });
            
            // Limit queue size to prevent memory issues (keep last 5 seconds approx)
            if (this.videoQueue.length > 150) {
                this.videoQueue.shift();
            }
        }
        
        // Handle resolution changes (simplified)
        if (!this.videoInfo) {
             this.currentWidth = effectiveWidth;
             this.currentHeight = effectiveHeight;
             this.videoInfo = { width: effectiveWidth, height: effectiveHeight };
             if (this.fpsDetected) {
               this.checkSyncAndStart();
             }
        } else if (this.encoderStarted && (this.currentWidth !== effectiveWidth || this.currentHeight !== effectiveHeight)) {
            // Check for stable resolution change
             if (!this.pendingResChange || 
                this.pendingResChange.width !== effectiveWidth || 
                this.pendingResChange.height !== effectiveHeight) {
                this.pendingResChange = {
                    width: effectiveWidth,
                    height: effectiveHeight,
                    start: Date.now()
                };
            } else if (Date.now() - this.pendingResChange.start > 2000) {
                 log('Resolution change detected', { old: `${this.currentWidth}x${this.currentHeight}`, new: `${effectiveWidth}x${effectiveHeight}` });
                 await this.restartEncoder(effectiveWidth, effectiveHeight);
                 this.pendingResChange = null;
            }
        }
      }
    } catch (error) {
      console.error('[Recorder] Video stream error', error);
    }
  }

  async checkSyncAndStart() {
    if (this.encoderStarted) return;
    if (!this.firstAudioTime || !this.firstVideoTime || !this.fpsDetected || !this.videoInfo) {
        return;
    }
    
    if (!this.referenceTime) {
        // SIMPLE SYNC STRATEGY:
        // - Both audio and video use RELATIVE timestamps (from their first frame = 0)
        // - No offset needed - both streams start at relative time 0
        // - The mixer and video sync naturally align them
        //
        // Why this works:
        // - Audio computed PTS: frame 1 = 0ms, frame 2 = 20ms, etc.
        // - Video relative PTS: frame 1 = 0us, frame 2 = 33333us, etc.
        // - Both start at 0, so they're aligned by definition
        // - Any wall-clock arrival difference is just network jitter, not content offset
        
        const hasVideoPTS = this.firstVideoTimestampUs !== null;
        const hasAudioPTS = this.firstAudioTimestampUs !== null;
        
        if (hasAudioPTS && hasVideoPTS) {
            // Use the EARLIER arrival time as reference
            // This ensures both streams start outputting as soon as possible
            const wallClockOffsetMs = this.firstAudioTime - this.firstVideoTime;
            this.referenceTime = Math.min(this.firstAudioTime, this.firstVideoTime);
            
            // No offset needed - both streams are relative starting from 0
            this.audioOffsetFromRef = 0;
            this.videoOffsetFromRef = 0;
            
            this.syncMethod = this._audioTimestampSource === 'livekit' ? 'pts' : 'computed-pts';
            
            log('A/V sync initialized', {
                method: this.syncMethod,
                audioSource: this._audioTimestampSource,
                audioAdvanceMs: AUDIO_ADVANCE_MS,
                wallClockDiffMs: wallClockOffsetMs.toFixed(1)
            });
        } else {
            // WALL-CLOCK FALLBACK (Original behavior - only if PTS missing)
            this.referenceTime = Math.max(this.firstAudioTime, this.firstVideoTime);
            this.audioOffsetFromRef = 0;
            this.videoOffsetFromRef = 0;
            this.syncMethod = 'wallclock';
            log('A/V sync initialized', {
                method: 'wall-clock (fallback)',
                note: 'PTS unavailable'
            });
        }
        
        this.videoFramesWritten = 0;
    }

    this.audioReady = true;
    this.videoReady = true;
    await this.startEncoderIfReady();
  }
  
  async startEncoderIfReady() {
    if (!this.running) return;
    if (this.encoderStarted) return;
    if (!this.audioReady || !this.videoReady || !this.videoInfo) return;

    this.startEncoder();
    this.encoderStarted = true;

    // No pending video flushing needed with new queue system
  }

  async startEncoder() {
    const outputPattern = path.join(this.outputDir, `${this.segmentPrefix}%05d.mp4`);
    const { width, height } = this.videoInfo || { width: 1280, height: 720 };
    const startNumber = this.lastSegmentNumber + 1;
    const encoderArgs = await this.getVideoEncoderArgs();

    const args = [
      '-loglevel',
      'warning',
      '-y',
      '-probesize', '100M',
      '-analyzeduration', '100M',
      '-f', 's16le',
      '-ac', '2',
      '-ar', '48000',
      '-i', 'pipe:0',
      '-f', 'rawvideo',
      '-pix_fmt', 'yuv420p',
      '-s', `${width}x${height}`,
      '-framerate', '30',
      '-i', 'pipe:3',
      '-force_key_frames', 'expr:gte(t,n_forced*2)',
      ...encoderArgs,
      '-c:a', 'aac',
      '-b:a', '160k',
      '-movflags', '+faststart',
      '-f', 'segment',
      '-segment_time', String(this.segmentDurationSeconds),
      '-reset_timestamps', '1',
      '-segment_list', this.playlistPath,
      '-segment_list_type', 'csv',
      '-segment_start_number', String(startNumber),
      outputPattern,
    ];

    this.ffmpeg = spawn(this.ffmpegPath, args, {
      stdio: ['pipe', 'pipe', 'pipe', 'pipe', 'ignore'],
      cwd: this.outputDir,
    });

    this.ffmpeg.stdout.on('data', () => {});
    this.ffmpeg.stderr.on('data', (data) => {
      const msg = data.toString();
      if (msg.trim()) console.error(`[ffmpeg] ${msg}`);
    });

    this.audioPipe = this.ffmpeg.stdin;
    this.videoPipe = this.ffmpeg.stdio[3];

    this.ffmpeg.on('exit', (code) => {
      this.encoderStarted = false;
      if (this.running && !this.restarting) {
        console.error('[Recorder] ffmpeg exited unexpectedly', code);
      }
    });
  }

  async restartEncoder(width, height) {
    if (this.restarting) return;
    if (!this.running) return; 
    this.restarting = true;
    
    try {
        await this.stopEncoderInternal();
        this.lastVideoFrame = null;
        this.referenceTime = null;
        this.videoFramesWritten = 0;
        this.firstAudioTime = null;
        this.firstVideoTime = null;
        this.firstAudioTimestampUs = null;
        this.firstVideoTimestampUs = null;
        this.audioSamplesWritten = 0;
        this.audioFrameCount = 0;
        this.audioOffsetFromRef = 0;
        this.videoOffsetFromRef = 0;
        this.syncMethod = 'unknown';
        this._audioTimestampSource = 'none';
        this.fpsDetected = false;
        this.videoQueue = [];
        this._loggedAudioFrame = false;
        this._loggedVideoFrame = false;
        
        // Reset mixer state
        this.audioMixer.reset();
        
        if (!this.running) return;
        
        this.currentWidth = width;
        this.currentHeight = height;
        this.videoInfo = { width, height };
        log('Resolution changed', { width, height });
    } catch (e) {
        console.error('Failed to restart encoder', e);
    } finally {
        this.restarting = false;
    }
  }

  async flushMixer() {
      if (!this.encoderStarted || !this.audioPipe || this.restarting || !this.referenceTime) return;
      
      const now = Date.now();
      const relativeTime = now - this.referenceTime;
      const currentTimeIndex = Math.floor(relativeTime / 20);
      
      // Get chunks up to (now - 1000ms) to ensure we have buffered enough for jitter
      // But actually, getReadyChunks handles the latencyBuffer logic (50 frames = 1000ms)
      const chunks = this.audioMixer.getReadyChunks(currentTimeIndex);
      
      if (chunks.length > 0) {
          for (const chunk of chunks) {
              if (this.audioPipe && !this.audioPipe.destroyed) {
                  if (!this.audioPipe.write(chunk)) {
                      // backpressure handling if needed
                  }
                  
                  // Update total audio samples written to drive video sync
                  this.audioSamplesWritten += (chunk.length / 4); // 2 bytes * 2 channels = 4 bytes per sample
              }
          }
          
          // After writing audio, ensure video catches up
          await this.syncVideoToAudio();
      }
  }

  async syncVideoToAudio() {
      if (!this.videoPipe || this.restarting || !this.firstVideoTimestampUs || !this.referenceTime) return;

      // Video queue contains RELATIVE timestamps (relative to first video frame = 0)
      // Audio uses computed relative timestamps (first frame = 0)
      // Both start at 0, so they're naturally aligned

      // Calculate how many video frames we SHOULD have written to match audio duration
      // Audio Sample Rate: 48000
      // Video FPS: 30
      // Target Frames = (Samples / 48000) * 30
      const targetVideoFrames = Math.floor((this.audioSamplesWritten / 48000) * 30);
      
      while (this.videoFramesWritten < targetVideoFrames) {
          // Determine the target RELATIVE timestamp for this specific frame
          // Frame N corresponds to time N * 33333.33 microseconds from encoder start
          const frameTimeUs = BigInt(Math.floor(this.videoFramesWritten * 33333.33));
          const targetTimestampUs = frameTimeUs;
          
          // Find the best matching frame in the queue
          // We want the newest frame that is <= targetTimestampUs
          // (Sample-and-Hold behavior)
          
          let bestFrame = null;
          
          // Iterate queue to find match
          // Since queue is sorted by timestamp, we can iterate forward
          let bestIndex = -1;
          
          for (let i = 0; i < this.videoQueue.length; i++) {
              const item = this.videoQueue[i];
              if (item.timestampUs <= targetTimestampUs) {
                  bestFrame = item;
                  bestIndex = i;
              } else {
                  // Found a frame in the future, stop searching
                  break;
              }
          }
          
          // If we found a frame, use it. If not, reuse last frame (or black if none).
          // If we use a frame from the queue, do we remove it?
          // We can remove frames that are definitely older than current target time minus some safety margin.
          // But for "Sample and Hold", we might re-use the same frame multiple times if input FPS < 30.
          // So we should NOT remove the *bestFrame* yet, only frames strictly older than it that we won't need?
          // Actually, if we use bestFrame, we can discard everything OLDER than bestFrame.
          
          if (bestFrame) {
              this.lastVideoFrame = bestFrame.buffer;
              
              // Cleanup older frames from queue, but keep the bestFrame for potential reuse
              if (bestIndex > 0) {
                   this.videoQueue.splice(0, bestIndex);
              }
          }
          
          const bufferToWrite = this.lastVideoFrame || Buffer.alloc(this.videoInfo.width * this.videoInfo.height * 1.5); // Grey/Black
          
          if (this.videoPipe && !this.videoPipe.destroyed) {
               if (!this.videoPipe.write(bufferToWrite)) {
                   // await once(this.videoPipe, 'drain'); // Optional: avoid blocking main loop too much
               }
               this.videoFramesWritten++;
          } else {
              break;
          }
      }
  }

  // Deprecated direct write
  async writeVideo(buffer, flushing = false, arrivalTime = 0) {
      if (flushing) {
          // If flushing, just write directly
           if (this.videoPipe && !this.videoPipe.destroyed) {
                this.videoPipe.write(buffer);
                this.videoFramesWritten++;
           }
      }
  }
  
  startSegmentWatcher() {
    this.segmentWatcher = fs.watch(this.outputDir, (event, filename) => {
      if (!filename || filename === 'playlist.csv') {
        this.checkPlaylist();
      }
    });
    if (this.playlistPoller) clearInterval(this.playlistPoller);
    this.playlistPoller = setInterval(() => this.checkPlaylist(), 10000);
  }

  async checkPlaylist() {
    if (this.checkingPlaylist) return;
    this.checkingPlaylist = true;
    try {
      if (!fs.existsSync(this.playlistPath)) {
        if (!this.running || this.restarting) await this.checkPotentialLastSegment();
        return;
      }
      const content = await fs.promises.readFile(this.playlistPath, 'utf8');
      const lines = content.split('\n').filter((line) => line.trim() !== '');

      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length < 1) continue;
        const filename = parts[0];
        const fullPath = path.join(this.outputDir, filename);
        if (this.processedSegments.has(fullPath)) continue;
        const segmentIndex = this.extractSegmentNumber(filename);
        if (segmentIndex === null) continue;
        if (segmentIndex > this.lastSegmentNumber) this.lastSegmentNumber = segmentIndex;

        try {
          if (!fs.existsSync(fullPath)) continue;
          const stats = await fs.promises.stat(fullPath);
          if (stats.size < 5 * 1024) continue;
        } catch (e) { continue; }

        this.processedSegments.add(fullPath);
        this.emitEvent({
          type: 'segment_complete',
          mintId: this.mintId,
          sessionId: this.sessionId,
          segment: segmentIndex + 1,
          path: fullPath,
          duration: this.segmentDurationSeconds,
        });
      }
      if (!this.running || this.restarting) await this.checkPotentialLastSegment();
    } catch (error) {
      console.warn('[Recorder] Failed to read playlist', error);
    } finally {
        this.checkingPlaylist = false;
    }
  }
  
  async checkPotentialLastSegment() {
      const potentialLastSegmentIndex = this.lastSegmentNumber + 1;
      const potentialLastSegmentName = `${this.segmentPrefix}${String(potentialLastSegmentIndex).padStart(5, '0')}.mp4`;
      const potentialLastSegmentPath = path.join(this.outputDir, potentialLastSegmentName);
      
      if (!this.processedSegments.has(potentialLastSegmentPath) && fs.existsSync(potentialLastSegmentPath)) {
         try {
           const stats = await fs.promises.stat(potentialLastSegmentPath);
           if (stats.size > 5 * 1024) {
               this.processedSegments.add(potentialLastSegmentPath);
               this.emitEvent({
                  type: 'segment_complete',
                  mintId: this.mintId,
                  sessionId: this.sessionId,
                  segment: potentialLastSegmentIndex + 1,
                  path: potentialLastSegmentPath,
                  duration: this.segmentDurationSeconds,
                });
           }
         } catch(e) {}
      }
  }

  extractSegmentNumber(filename) {
    const match = filename.match(/segment_(\d+)\.mp4$/);
    if (!match) return null;
    return parseInt(match[1], 10);
  }

  // Note: Old writeAudio logic is removed in favor of mixer + flushMixer

  async writeVideo(buffer, flushing = false, arrivalTime = 0) {
    if (!flushing && !this.running) return;

    if (!flushing && (!this.encoderStarted || !this.videoPipe || this.restarting)) {
      this.pendingVideo.push({ buffer, timestamp: arrivalTime });
      if (!this.restarting) {
          if (!this.encoderStarted) this.checkSyncAndStart();
      }
      return;
    }

    if (arrivalTime < this.referenceTime) {
        return;
    }

    if (arrivalTime > 0 && this.referenceTime !== null && this.videoFps > 0) {
        const elapsedMs = arrivalTime - this.referenceTime;
        const elapsedSec = elapsedMs / 1000;
        
        const targetFrames = Math.floor(elapsedSec * this.videoFps);
        const gapFrames = targetFrames - this.videoFramesWritten;
        
        if (gapFrames > 0) {
            const maxFill = this.videoFps;
            const fillCount = Math.min(gapFrames, maxFill);
            const fillBuffer = this.lastVideoBuffer; 
            if (fillBuffer && fillBuffer.length === buffer.length) {
                for (let i = 0; i < fillCount; i++) {
                    try {
                        if (this.videoPipe && !this.videoPipe.destroyed) {
                            if (!this.videoPipe.write(fillBuffer)) {
                                await once(this.videoPipe, 'drain');
                            }
                            this.videoFramesWritten++;
                        }
                    } catch(e) {}
                }
            }
            if (gapFrames > maxFill) {
                this.videoFramesWritten = targetFrames;
            }
        }
    }

    try {
        if (this.videoPipe && !this.videoPipe.destroyed && (flushing || this.running)) {
            if (!this.videoPipe.write(buffer)) {
                await once(this.videoPipe, 'drain');
            }
            this.videoFramesWritten++;
            this.lastVideoBuffer = buffer;
        }
    } catch (e) {
        if (this.restarting && !flushing) {
            this.pendingVideo.push({ buffer, timestamp: arrivalTime });
        }
    }
  }
  
  async stopEncoderInternal() {
      if (!this.ffmpeg) return;
      this.encoderStarted = false;
      
      const startWait = Date.now();
      while (Date.now() - startWait < 500) {
          await new Promise(r => setTimeout(r, 50));
      }
      
      const vPipe = this.videoPipe;
      const aPipe = this.audioPipe;
      this.videoPipe = null;
      this.audioPipe = null;
      
      try {
        const exitPromise = once(this.ffmpeg, 'exit');
        try { if (this.ffmpeg.stdin && !this.ffmpeg.stdin.destroyed) this.ffmpeg.stdin.end(); } catch(e) {}
        if (vPipe) try { if (!vPipe.destroyed) vPipe.end(); } catch(e) {}

        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('timeout'), 25000));
        let result = await Promise.race([exitPromise, new Promise(resolve => setTimeout(() => resolve('soft-timeout'), 15000))]);
        
        if (result === 'soft-timeout') {
             try { this.ffmpeg.kill('SIGINT'); } catch (e) {}
             result = await Promise.race([exitPromise, timeoutPromise]);
        }

        if (result === 'timeout') {
           this.ffmpeg.kill('SIGKILL');
        } else {
           await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error('[Recorder] Error stopping ffmpeg', error);
      }
      
      this.ffmpeg = null;
      this.audioPipe = null;
      this.videoPipe = null;
  }

  async stop() {
    this.running = false;
    if (this.playlistPoller) clearInterval(this.playlistPoller);
    if (this.mixerInterval) clearInterval(this.mixerInterval);

    if (this.segmentWatcher) {
      this.segmentWatcher.close();
      this.segmentWatcher = null;
    }

    await this.stopEncoderInternal();
    this.checkingPlaylist = false; 
    await this.checkPlaylist();

    if (this.room) {
      try {
        await Promise.race([
            this.room.disconnect(),
            new Promise(resolve => setTimeout(resolve, 2000))
        ]);
      } catch (error) {
        console.warn('[Recorder] Error disconnecting LiveKit', error);
      }
    }
  }

  emitEvent(payload) {
    console.log(JSON.stringify(payload));
  }
}

async function main() {
  const recorder = new PumpfunRecorder({
    mintId,
    sessionId,
    outputDir,
    segmentDuration: segmentDurationSeconds,
  });

  let isStarting = true; // Track if we're still in the start() phase

  const shutdown = async () => {
    process.off('SIGINT', shutdown);
    process.off('SIGTERM', shutdown);
    process.stdin.off('data', onStdinData);
    
    // Signal stop to interrupt waiting phase
    recorder.stopRequested = true;
    if (recorder._waitTimeout) {
      clearTimeout(recorder._waitTimeout);
    }
    
    // If still starting (waiting for stream), just exit after signaling
    if (isStarting) {
      // Give a moment for the start() loop to exit cleanly
      await new Promise(resolve => setTimeout(resolve, 100));
      process.exit(0);
      return;
    }
    
    const forceExitTimer = setTimeout(() => {
        console.error(JSON.stringify({ type: 'log', message: 'Shutdown timed out, forcing exit' }));
        process.exit(0);
    }, 28000);

    try {
        await recorder.stop();
    } catch (e) {
        console.error(JSON.stringify({ type: 'log', message: `Error during stop: ${e.message}` }));
    }
    
    clearTimeout(forceExitTimer);
    process.exit(0);
  };

  const onStdinData = (data) => {
    const str = data.toString().trim();
    if (str === 'STOP') {
        shutdown();
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.stdin.on('data', onStdinData);

  await recorder.start();
  isStarting = false; // Recording has started (or was stopped during wait)
}

main().catch((error) => {
  console.error(JSON.stringify({ type: 'error', message: error.message }));
  process.exit(1);
});
