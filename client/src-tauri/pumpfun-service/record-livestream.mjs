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

// Sync Offset: Positive = Fixes "Audio Ahead" (Drops Video). Negative = Fixes "Video Ahead" (Drops Audio).
const AV_SYNC_OFFSET_MS = 0;

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
      // 1. Dev structure: ../binaries/<binName>
      path.resolve(__dirname, '../binaries', binName),
      // 2. Production structure (sidecar next to executable): ../<binName>
      path.resolve(__dirname, '..', binName),
      // 3. Just in case it's in the same folder
      path.resolve(__dirname, binName)
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    
    // Fallback for macOS: If arm64 binary missing, try x86_64 (Rosetta)
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
    this.audioReader = null;
    this.videoReader = null;
    this.audioReady = false;
    this.videoReady = false;
    this.encoderStarted = false;
    this.audioPipe = null;
    this.videoPipe = null;
    this.pendingAudio = [];
    this.pendingVideo = [];
    this.videoInfo = null;
    this.videoFps = 30;
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
    this.syncStartTime = null;
    this.syncedAudio = false;
    this.syncedVideo = false;
    
    this.isWritingAudio = false;
    this.isWritingVideo = false;
    
    this.audioStartTime = null;
    this.videoStartTime = null;
    this.audioSamplesWritten = 0;
    this.videoFramesWritten = 0;
    this.lastVideoBuffer = null;
    
    this.pendingResChange = null;
  }

  detectTimestampUnit(ts) {
    // Heuristic to detect if timestamp is in ns, us, or ms
    // based on magnitude relative to Date.now()
    if (ts > 1e16) return 1000000000; // ns
    if (ts > 1e13) return 1000000; // us
    if (ts > 1e10) return 1000; // ms
    return 1000000; // Default to us if small (relative monotonic)
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
  }

  async startRoom(url, token) {
    this.room = new Room();
    this.room
      .on(RoomEvent.TrackSubscribed, (track) => this.handleTrackSubscribed(track))
      .on(RoomEvent.Disconnected, () => {
        // log('LiveKit disconnected');
        this.emitEvent({
          type: 'stream_ended',
          mintId: this.mintId,
          sessionId: this.sessionId,
        });
        this.stop().catch(() => {});
      })
      .on(RoomEvent.Connected, () => {
        // log('LiveKit room connected successfully');
      })
      .on(RoomEvent.Reconnecting, () => {
        // log('LiveKit reconnecting...');
      })
      .on(RoomEvent.Reconnected, () => {
        // log('LiveKit reconnected');
      });

    await this.room.connect(url, token, { autoSubscribe: true });
  }

  handleTrackSubscribed(track) {
    if (track.kind === TrackKind.KIND_AUDIO && !this.audioReader) {
      this.bindAudioStream(track);
    } else if (track.kind === TrackKind.KIND_VIDEO && !this.videoReader) {
      // Attempt to lock quality to HIGH to reduce resolution switching
      try {
          if (track.setVideoQuality) {
              track.setVideoQuality(VIDEO_QUALITY_HIGH);
          }
      } catch(e) {
          // Ignore if not supported
      }
      this.bindVideoStream(track);
    }
  }

  async bindAudioStream(track) {
    try {
      const audioStream = new AudioStream(track, {
        sampleRate: 48000,
        numChannels: 2,
        frameSizeMs: 20,
      });
      this.audioReader = audioStream.getReader();
      this.audioReady = true;
      await this.startEncoderIfReady();

      while (this.running) {
        const { value, done } = await this.audioReader.read();
        if (done || !value) break;
        
        // Use Wall Clock Arrival Time
        const arrivalTime = Date.now();

        if (!this.firstAudioTime) {
            this.firstAudioTime = arrivalTime;
            // Independent Start Time
            this.audioStartTime = arrivalTime;
            this.checkSyncAndStart();
        }

        const buffer = Buffer.from(
          value.data.buffer,
          value.data.byteOffset,
          value.data.byteLength
        );
        await this.writeAudio(buffer, false, arrivalTime);
      }
    } catch (error) {
      console.error('[Recorder] Audio stream error', error);
    }
  }

  async bindVideoStream(track) {
    try {
      const videoStream = new VideoStream(track);
      this.videoReader = videoStream.getReader();

      while (this.running) {
        const { value, done } = await this.videoReader.read();
        if (done || !value) break;
        
        const arrivalTime = Date.now();
        const frame = value.frame;
        
        // Detect FPS from incoming frames using Wall Clock
        if (!this.fpsDetected) {
            this.fpsSamples.push(arrivalTime);
            const count = this.fpsSamples.length;
            
            // Collect for at least 1 second
            if (count >= 2) {
                const first = this.fpsSamples[0];
                const last = arrivalTime;
                const duration = last - first;
                
                if (duration >= 1000) {
                    const durationSec = duration / 1000;
                    const calculatedFps = (count - 1) / durationSec;
                    this.videoFps = Math.max(1, Math.min(120, Math.round(calculatedFps)));
                    this.fpsDetected = true;
                    this.checkSyncAndStart();
                }
            }
        }
        
        if (!this.firstVideoTime) {
            this.firstVideoTime = arrivalTime;
            // Independent Start Time
            this.videoStartTime = arrivalTime;
        }

        const converted = frame.convert(VideoBufferType.I420);
        const width = converted.width;
        const height = converted.height;

        // Ensure even dimensions for YUV420p
        const effectiveWidth = width & ~1;
        const effectiveHeight = height & ~1;

        // Resolution Change Debounce Logic
        if (this.encoderStarted) {
            if (this.currentWidth !== 0 && (effectiveWidth !== this.currentWidth || effectiveHeight !== this.currentHeight)) {
                // Resolution mismatch detected
                
                // If this is a new change, start tracking it
                if (!this.pendingResChange || 
                    this.pendingResChange.width !== effectiveWidth || 
                    this.pendingResChange.height !== effectiveHeight) {
                    this.pendingResChange = {
                        width: effectiveWidth,
                        height: effectiveHeight,
                        start: Date.now()
                    };
                    // Drop this frame as it doesn't match encoder
                    continue;
                }
                
                // Check if the change has persisted long enough (2 seconds)
                if (Date.now() - this.pendingResChange.start > 2000) {
                    // Stable change detected, restart encoder
                    log('Resolution change stable, restarting encoder', { 
                        old: `${this.currentWidth}x${this.currentHeight}`,
                        new: `${effectiveWidth}x${effectiveHeight}`
                    });
                    await this.restartEncoder(effectiveWidth, effectiveHeight);
                    this.pendingResChange = null;
                    // Continue to process this frame (encoder restarted)
                } else {
                    // Still debouncing, drop frame
                    continue;
                }
            } else {
                // Resolution matches current, reset pending change if any
                if (this.pendingResChange) {
                    this.pendingResChange = null;
                }
            }
        } else if (this.currentWidth === 0) {
             // Initial setup (not started yet)
             this.currentWidth = effectiveWidth;
             this.currentHeight = effectiveHeight;
             this.videoInfo = { width: effectiveWidth, height: effectiveHeight };
        } else if (effectiveWidth !== this.currentWidth || effectiveHeight !== this.currentHeight) {
             // Encoder not started, but we have a resolution change? Just update.
             this.currentWidth = effectiveWidth;
             this.currentHeight = effectiveHeight;
             this.videoInfo = { width: effectiveWidth, height: effectiveHeight };
        }

        if (!this.videoInfo) {
          this.currentWidth = effectiveWidth;
          this.currentHeight = effectiveHeight;
          this.videoInfo = { width: effectiveWidth, height: effectiveHeight };
          if (this.fpsDetected) {
            this.checkSyncAndStart();
          }
        }

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

        await this.writeVideo(buffer, false, arrivalTime);
      }
    } catch (error) {
      console.error('[Recorder] Video stream error', error);
    }
  }

  async checkSyncAndStart() {
    if (this.encoderStarted) return;
    
    // Wait for both streams to be active
    if (!this.firstAudioTime || !this.firstVideoTime || !this.fpsDetected || !this.videoInfo) {
        return;
    }
    
    this.audioReady = true;
    this.videoReady = true;
    await this.startEncoderIfReady();
  }
  
  async startEncoderIfReady() {
    if (!this.running) return; // Do not start encoder if stopping

    if (this.encoderStarted) {
      return;
    }

    if (!this.audioReady || !this.videoReady || !this.videoInfo) {
      return;
    }

    this.startEncoder();
    this.encoderStarted = true;

    // Flush buffered data - Sort by arrival time to maintain relative order if needed?
    // Actually, audio and video pipes are independent. We just need to flush each queue in order.
    // But since we are using Wall Clock Sync, we must flush them to apply the gap logic correctly.
    
    const pendingAudio = this.pendingAudio.splice(0);
    const pendingVideo = this.pendingVideo.splice(0);
    
    for (const item of pendingAudio) {
      await this.writeAudio(item.buffer, true, item.timestamp);
    }
    for (const item of pendingVideo) {
      await this.writeVideo(item.buffer, true, item.timestamp);
    }
  }

  startEncoder() {
    const outputPattern = path.join(this.outputDir, `${this.segmentPrefix}%05d.mp4`);

    const { width, height } = this.videoInfo || { width: 1280, height: 720 };
    
    // Determine start number based on last processed segment
    const startNumber = this.lastSegmentNumber + 1;

    const args = [
      '-loglevel',
      'warning',
      '-y',
      '-probesize', // Add probesize
      '100M',
      '-analyzeduration', // Add analyzeduration
      '100M',
      '-f',
      's16le',
      '-ac',
      '2',
      '-ar',
      '48000',
      '-i',
      'pipe:0',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'yuv420p',
      '-s',
      `${width}x${height}`,
      '-framerate', // Use -framerate for input to be explicit
      String(this.videoFps),
      '-i',
      'pipe:3',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-tune',
      'zerolatency',
      '-c:a',
      'aac',
      '-b:a',
      '160k',
      '-movflags',
      '+faststart',
      '-f',
      'segment',
      '-segment_time',
      String(this.segmentDurationSeconds),
      '-reset_timestamps',
      '1',
      '-segment_list',
      this.playlistPath,
      '-segment_list_type',
      'csv',
      '-segment_start_number',
      String(startNumber),
      outputPattern,
    ];

    this.ffmpeg = spawn(this.ffmpegPath, args, {
      stdio: ['pipe', 'pipe', 'pipe', 'pipe', 'ignore'],
      cwd: this.outputDir,
    });

    // Consume stdout/stderr to prevent blocking and avoid "null" file creation bug on Windows
    this.ffmpeg.stdout.on('data', () => {});
    this.ffmpeg.stderr.on('data', (data) => {
      // Only log significant ffmpeg errors/warnings
      const msg = data.toString();
      // Log all stderr from ffmpeg to help debugging, or filter if too noisy
      if (msg.trim()) {
         console.error(`[ffmpeg] ${msg}`);
      }
    });

    this.audioPipe = this.ffmpeg.stdin;
    this.videoPipe = this.ffmpeg.stdio[3];

    this.ffmpeg.on('exit', (code) => {
      this.encoderStarted = false;
      if (this.running && !this.restarting) {
        console.error('[Recorder] ffmpeg exited unexpectedly', code);
        // Prevent rapid restart loop or OOM if ffmpeg keeps failing
        // For now, we just log it. The write loop will catch EPIPE errors.
        // If we wanted to be aggressive, we could try to restart here.
      } else {
        // log('ffmpeg exited cleanly or as expected');
      }
    });
  }

  async restartEncoder(width, height) {
    if (this.restarting) return;
    if (!this.running) return; // Do not restart if we are stopping
    
    this.restarting = true;
    
    try {
        // 1. Stop current encoder cleanly
        await this.stopEncoderInternal();
        
        // Clear last video buffer to prevent resolution mismatch on next write
        this.lastVideoBuffer = null;
        
        if (!this.running) return; // Double check in case stop() was called while awaiting above
        
        // 2. Update dimensions
        this.currentWidth = width;
        this.currentHeight = height;
        this.videoInfo = { width, height };
        
        // 3. Start new encoder
        // Logic of startEncoderIfReady will start it and flush any pending buffers accumulated during stop
        await this.startEncoderIfReady();
        
        // 4. Log resolution change
        log('Resolution changed', { width, height });
        
    } catch (e) {
        console.error('Failed to restart encoder', e);
    } finally {
        this.restarting = false;
    }
  }

  startSegmentWatcher() {
    this.segmentWatcher = fs.watch(this.outputDir, (event, filename) => {
      // filename can be null or empty string on some platforms
      if (!filename || filename === 'playlist.csv') {
        this.checkPlaylist();
      }
    });
    
    // Fallback polling every 10 seconds to ensure we don't miss updates
    if (this.playlistPoller) clearInterval(this.playlistPoller);
    this.playlistPoller = setInterval(() => this.checkPlaylist(), 10000);
  }

  async checkPlaylist() {
    if (this.checkingPlaylist) return;
    this.checkingPlaylist = true;
    
    try {
      if (!fs.existsSync(this.playlistPath)) {
        // log('Playlist not found yet', { path: this.playlistPath });
        // Even if playlist not found, we should check for the first segment if we are stopping
        if (!this.running || this.restarting) {
            await this.checkPotentialLastSegment();
        }
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
        if (segmentIndex === null) {
            // log('Could not extract segment number', { filename });
            continue;
        }
        
        // Update last seen segment number
        if (segmentIndex > this.lastSegmentNumber) {
            this.lastSegmentNumber = segmentIndex;
        }

        // Double check file existence and size
        try {
          if (!fs.existsSync(fullPath)) {
             // log('Segment file missing', { fullPath });
             continue;
          }
          const stats = await fs.promises.stat(fullPath);
          // Ignore segments smaller than 5KB (likely partial/empty)
          if (stats.size < 5 * 1024) {
             continue;
          }
        } catch (e) {
          // log('Error checking segment file', { error: e.message, fullPath });
          continue;
        }

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
      
      // After checking all lines in the playlist, also check for a potential "last" segment
      if (!this.running || this.restarting) {
          await this.checkPotentialLastSegment();
      }
    } catch (error) {
      // Ignore errors reading playlist (e.g. locked file)
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
           // Ignore segments smaller than 5KB
           if (stats.size > 5 * 1024) {
               this.processedSegments.add(potentialLastSegmentPath);
               this.emitEvent({
                  type: 'segment_complete',
                  mintId: this.mintId,
                  sessionId: this.sessionId,
                  segment: potentialLastSegmentIndex + 1,
                  path: potentialLastSegmentPath,
                  duration: this.segmentDurationSeconds, // Note: It might be shorter
                });
           } else {
              //  log('Final segment found but too small', { path: potentialLastSegmentPath, size: stats.size });
           }
         } catch(e) {
             console.error('[Recorder] Error checking final segment', e);
         }
      } else {
        // Log if we expected a file but didn't find it
        // log('No final segment found', { expectedPath: potentialLastSegmentPath });
      }
  }

  extractSegmentNumber(filename) {
    const match = filename.match(/segment_(\d+)\.mp4$/);
    if (!match) return null;
    return parseInt(match[1], 10);
  }

  async writeAudio(buffer, flushing = false, arrivalTime = 0) {
    if (!flushing && (!this.encoderStarted || !this.audioPipe || this.restarting)) {
      this.pendingAudio.push({ buffer, timestamp: arrivalTime });
      // Don't trigger startEncoderIfReady if we are restarting, it will be handled by restartEncoder
      if (!this.restarting) {
          // await this.startEncoderIfReady(); // We wait for explicit sync
          if (!this.encoderStarted) this.checkSyncAndStart();
      }
      return;
    }

    // Independent Start logic
    if (arrivalTime > 0 && this.audioStartTime !== null) {
        const elapsedMs = arrivalTime - this.audioStartTime;
        const elapsedSec = elapsedMs / 1000;
        
        const sampleRate = 48000;
        const channels = 2;
        const bytesPerSample = 2;
        const bytesPerFrame = channels * bytesPerSample;
        
        const targetSamples = Math.floor(elapsedSec * sampleRate);
        const gapSamples = targetSamples - this.audioSamplesWritten;

        // Threshold ~20ms
        if (gapSamples > 1000) {
             const maxSilence = 48000; // Max 1s silence
             const fillSamples = Math.min(gapSamples, maxSilence);
             const silenceBytes = fillSamples * bytesPerFrame;
             
             if (silenceBytes > 0) {
                 try {
                    const silence = Buffer.alloc(silenceBytes);
                    if (!this.audioPipe.write(silence)) {
                        await once(this.audioPipe, 'drain');
                    }
                    this.audioSamplesWritten += fillSamples;
                 } catch(e) { }
             }
             
             if (gapSamples > maxSilence) {
                 this.audioSamplesWritten = targetSamples;
             }
        }
    }

    this.isWritingAudio = true;
    try {
        const bytesPerFrame = 4; // 2 channels * 2 bytes
        if (!this.audioPipe.write(buffer)) {
          await once(this.audioPipe, 'drain');
        }
        this.audioSamplesWritten += (buffer.length / bytesPerFrame);
    } catch (e) {
        if (this.restarting && !flushing) {
            this.pendingAudio.push({ buffer, timestamp: arrivalTime });
        }
    } finally {
        this.isWritingAudio = false;
    }
  }

  async writeVideo(buffer, flushing = false, arrivalTime = 0) {
    // If shutting down, strictly do NOT write to avoid partial frames or writing to closing pipes
    if (!flushing && !this.running) return;

    if (!flushing && (!this.encoderStarted || !this.videoPipe || this.restarting)) {
      this.pendingVideo.push({ buffer, timestamp: arrivalTime });
      if (!this.restarting) {
          // await this.startEncoderIfReady();
          if (!this.encoderStarted) this.checkSyncAndStart();
      }
      return;
    }

    // Independent Start logic
    if (arrivalTime > 0 && this.videoStartTime !== null && this.videoFps > 0) {
        const elapsedMs = arrivalTime - this.videoStartTime;
        const elapsedSec = elapsedMs / 1000;
        
        const targetFrames = Math.floor(elapsedSec * this.videoFps);
        const gapFrames = targetFrames - this.videoFramesWritten;
        
        if (gapFrames > 0) {
            const maxFill = this.videoFps; // Max 1s
            const fillCount = Math.min(gapFrames, maxFill);
            const fillBuffer = this.lastVideoBuffer; // Only use last buffer if exists
            
            // IMPORTANT: Check resolution match before duping!
            // This prevents artifacting during resolution switches
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

    this.isWritingVideo = true;
    try {
        // Extra safety check before write
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
    } finally {
        this.isWritingVideo = false;
    }
  }
  
  async stopEncoderInternal() {
      if (!this.ffmpeg) return;
      
      this.encoderStarted = false;
      
      // Wait for pending writes to finish/drain to prevent partial packets
      const startWait = Date.now();
      while ((this.isWritingAudio || this.isWritingVideo) && Date.now() - startWait < 2000) {
          await new Promise(r => setTimeout(r, 50));
      }
      
      // Immediately mark pipes as unusable to prevent writes
      const vPipe = this.videoPipe;
      const aPipe = this.audioPipe;
      this.videoPipe = null;
      this.audioPipe = null;
      
      try {
        // Wait for ffmpeg to exit after closing inputs
        const exitPromise = once(this.ffmpeg, 'exit');
        
        // Close inputs
        // For stdin (audio), we must end it to signal EOF
        try { 
            if (this.ffmpeg.stdin && !this.ffmpeg.stdin.destroyed) {
                this.ffmpeg.stdin.end(); 
            }
        } catch(e) {
            console.error('[Recorder] Error closing audio pipe', e);
        }
        
        // For video pipe (stdio[3]), we must also end it
        if (vPipe) {
          try { 
            if (!vPipe.destroyed) {
                vPipe.end(); 
            }
          } catch(e) {
            console.error('[Recorder] Error closing video pipe', e);
          }
        }


        // Wait up to 25 seconds for clean exit (increased to allow final segment flush + faststart)
        // If it doesn't exit in 15 seconds, try SIGINT to encourage it.
        
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('timeout'), 25000));
        
        // Race against timeout
        let result = await Promise.race([exitPromise, new Promise(resolve => setTimeout(() => resolve('soft-timeout'), 15000))]);
        
        if (result === 'soft-timeout') {
            //  log('ffmpeg did not exit quickly, sending SIGINT');
             try {
                 this.ffmpeg.kill('SIGINT');
             } catch (e) {}
             result = await Promise.race([exitPromise, timeoutPromise]);
        }

        if (result === 'timeout') {
          //  log('encoder did not exit in time, forcing kill');
           this.ffmpeg.kill('SIGKILL');
        } else {
           // Small delay to allow file system to flush
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

    if (this.playlistPoller) {
      clearInterval(this.playlistPoller);
      this.playlistPoller = null;
    }

    // 1. Stop readers (Source) first to prevent new data
    // This prevents writing to encoder while it's closing
    if (this.audioReader) {
        this.audioReader.cancel().catch(e => console.error('[Recorder] Error cancelling audio reader', e));
        this.audioReader = null;
    }
    
    if (this.videoReader) {
        this.videoReader.cancel().catch(e => console.error('[Recorder] Error cancelling video reader', e));
        this.videoReader = null;
    }

    if (this.segmentWatcher) {
      this.segmentWatcher.close();
      this.segmentWatcher = null;
    }

    // 2. Stop encoder (Sink)
    await this.stopEncoderInternal();

    // 3. Check playlist for last segment
    this.checkingPlaylist = false; 
    await this.checkPlaylist();

    // 4. Disconnect LiveKit
    if (this.room) {
      try {
        // Timeout disconnect to prevent hanging
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
    // Remove listeners to prevent double handling
    process.off('SIGINT', shutdown);
    process.off('SIGTERM', shutdown);
    process.stdin.off('data', onStdinData);
    
    // Force exit after 28 seconds if recorder.stop() hangs (must be less than Rust's 30s)
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
    
    // Emit a specific exit event via stdout for the Rust side to pick up if needed, 
    // but usually process exit is enough.
    // However, our Rust side listens for "stream_ended" which we emitted inside stop().
    
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
