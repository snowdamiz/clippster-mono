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
                 const keys = Array.from(this.chunks.keys()).sort((a, b) => a - b);
                 this.lastFlushedIndex = keys[0] - 1;
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
    this.firstVideoTimestampUs = null;
    this.audioSamplesWritten = 0;
    
    this.referenceTime = null;
    this.videoFramesWritten = 0;
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

    const info = await getLivestreamInfo(this.mintId);
    if (!info?.isLive) {
      console.log(
        JSON.stringify({
          type: 'stream_offline',
          mintId: this.mintId,
          sessionId: this.sessionId,
        })
      );
      return;
    }

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

        if (!this.firstAudioTime) {
            this.firstAudioTime = arrivalTime;
            this.checkSyncAndStart();
        }
        
        // If reference time is established, push to mixer
        if (this.referenceTime) {
            const buffer = Buffer.from(
              value.data.buffer,
              value.data.byteOffset,
              value.data.byteLength
            );
            
            // Calculate relative time index
            // We use arrivalTime but "snap" to grid to handle jitter while preserving large gaps
            const relativeTime = arrivalTime - this.referenceTime;
            let timeIndex = Math.floor(relativeTime / 20);

            // Jitter Snapping Logic:
            // If the calculated index is very close to the expected next index (within 2 frames = 40ms),
            // we snap it to be contiguous. This handles network jitter where packets arrive slightly late/early.
            // If it's further away, we assume it's a real gap (DTX) and respect the gap (silence will be filled by mixer).
            
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

        const yStride = width;
        const uvStride = (width + 1) >> 1;

        const extractPlane = (plane, w, h, originalStride) => {
             let stride = plane.stride || originalStride || w;
             const availableBytes = plane.byteLength !== undefined ? plane.byteLength : (plane.buffer.byteLength - plane.byteOffset);
             const requiredBytes = stride * h;

             if (requiredBytes > availableBytes && stride > w) {
                 stride = originalStride || w;
             }
             
             if (stride === w) {
                 return Buffer.from(plane.buffer, plane.byteOffset, w * h);
             }
             
             const tight = Buffer.allocUnsafe(w * h);
             for (let y = 0; y < h; y++) {
                 const srcStart = plane.byteOffset + (y * stride);
                 const dstStart = y * w;
                 if (srcStart + w > plane.buffer.byteLength) break;
                 Buffer.from(plane.buffer, srcStart, w).copy(tight, dstStart);
             }
             return tight;
        };

        const yBuffer = extractPlane(yPlane, effectiveWidth, effectiveHeight, yStride);
        const uBuffer = extractPlane(uPlane, effectiveWidth >> 1, effectiveHeight >> 1, uvStride);
        const vBuffer = extractPlane(vPlane, effectiveWidth >> 1, effectiveHeight >> 1, uvStride);

        const buffer = Buffer.concat([yBuffer, uBuffer, vBuffer]);

        // Store in queue instead of writing immediately
        if (this.firstVideoTimestampUs !== null && timestampUs !== undefined) {
            this.videoQueue.push({ 
                buffer, 
                timestampUs,
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
        this.referenceTime = Math.max(this.firstAudioTime, this.firstVideoTime);
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
        this.firstVideoTimestampUs = null;
        this.audioSamplesWritten = 0;
        this.fpsDetected = false;
        this.videoQueue = [];
        
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

      // Calculate the offset between when we STARTED the reference clock and when the first video frame appeared.
      // If referenceTime is later than firstVideoTime (e.g. waited for audio), we must skip the early video frames.
      const videoStartOffsetMs = this.referenceTime - this.firstVideoTime;
      const videoStartOffsetUs = BigInt(Math.max(0, videoStartOffsetMs) * 1000);
      const effectiveFirstTimestampUs = this.firstVideoTimestampUs + videoStartOffsetUs;

      // Calculate how many video frames we SHOULD have written to match audio duration
      // Audio Sample Rate: 48000
      // Video FPS: 30
      // Target Frames = (Samples / 48000) * 30
      const targetVideoFrames = Math.floor((this.audioSamplesWritten / 48000) * 30);
      
      while (this.videoFramesWritten < targetVideoFrames) {
          // Determine the target timestamp for this specific frame
          // Frame N corresponds to time N * 33333.33 microseconds from start
          const frameTimeUs = BigInt(Math.floor(this.videoFramesWritten * 33333.33));
          const targetTimestampUs = effectiveFirstTimestampUs + frameTimeUs;
          
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

  await recorder.start();

  const shutdown = async () => {
    process.off('SIGINT', shutdown);
    process.off('SIGTERM', shutdown);
    process.stdin.off('data', onStdinData);
    
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
}

main().catch((error) => {
  console.error(JSON.stringify({ type: 'error', message: error.message }));
  process.exit(1);
});
