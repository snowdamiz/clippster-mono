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
        
        if (!this.firstAudioTime) {
            this.firstAudioTime = Date.now();
            this.checkSyncAndStart();
        }

        const buffer = Buffer.from(
          value.data.buffer,
          value.data.byteOffset,
          value.data.byteLength
        );
        await this.writeAudio(buffer);
      }
    } catch (error) {
      console.error('[Recorder] Audio stream error', error);
    }
  }

  async bindVideoStream(track) {
    try {
      const videoStream = new VideoStream(track);
      this.videoReader = videoStream.getReader();
      // Video is not ready until we detect FPS
      // this.videoReady = true;
      // await this.startEncoderIfReady();

      while (this.running) {
        const { value, done } = await this.videoReader.read();
        if (done || !value) break;
        
        // Detect FPS from incoming frames
        if (!this.fpsDetected) {
            const now = Date.now();
            this.fpsSamples.push(now);
            
            const first = this.fpsSamples[0];
            const duration = now - first;
            const count = this.fpsSamples.length;

            // Collect for at least 1 second to handle bursts and get a stable average
            if (duration >= 1000 && count >= 2) {
                const durationSec = duration / 1000;
                const calculatedFps = (count - 1) / durationSec;
                
                // Clamp and round to standard values
                this.videoFps = Math.max(1, Math.min(120, Math.round(calculatedFps)));
                // log(`Detected video FPS: ${this.videoFps} (${count} frames in ${durationSec.toFixed(3)}s)`);
                
                this.fpsDetected = true;
                this.checkSyncAndStart();
            }
        }
        
        if (!this.firstVideoTime) {
            this.firstVideoTime = Date.now();
        }

        const frame = value.frame;
        const converted = frame.convert(VideoBufferType.I420);
        const width = converted.width;
        const height = converted.height;

        // Ensure even dimensions for YUV420p
        const effectiveWidth = width & ~1;
        const effectiveHeight = height & ~1;

        // Check for resolution change (using effective dimensions)
        if (this.encoderStarted && (effectiveWidth !== this.currentWidth || effectiveHeight !== this.currentHeight)) {
          // Only restart if dimensions actually changed and are non-zero
          if (this.currentWidth !== 0 && this.currentHeight !== 0) {
            // log('Resolution changed', { oldW: this.currentWidth, oldH: this.currentHeight, newW: effectiveWidth, newH: effectiveHeight });
            await this.restartEncoder(effectiveWidth, effectiveHeight);
          }
        }

        // Only restart encoder for resolution change if we have frames and dimensions are non-zero
        if (this.currentWidth !== 0 && this.currentHeight !== 0 && 
            (effectiveWidth !== this.currentWidth || effectiveHeight !== this.currentHeight)) {
              
          // Only trigger restart if we are already encoding
          if (this.encoderStarted) {
             await this.restartEncoder(effectiveWidth, effectiveHeight);
          } else {
             // If encoder hasn't started yet, just update dimensions
             this.currentWidth = effectiveWidth;
             this.currentHeight = effectiveHeight;
             this.videoInfo = { width: effectiveWidth, height: effectiveHeight };
          }
        }

        if (!this.videoInfo) {
          this.currentWidth = effectiveWidth;
          this.currentHeight = effectiveHeight;
          this.videoInfo = { width: effectiveWidth, height: effectiveHeight };
          // Only start if FPS detection is also complete
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

        // Check for stride mismatch and copy row-by-row if needed
        // We now extract based on EFFECTIVE width/height (even dimensions)
        // This effectively crops 1 pixel if original was odd.
        
        const yStride = width;
        const uvStride = (width + 1) >> 1;

        const extractPlane = (plane, w, h, originalStride) => {
             let stride = plane.stride || originalStride || w;
             
             // Heuristic: Check if the buffer actually has enough data for the reported stride.
             // If not, and the stride is larger than width, it's likely a packed buffer with an aligned stride reported.
             // We use plane.byteLength if available, otherwise calculate from buffer.
             const availableBytes = plane.byteLength !== undefined ? plane.byteLength : (plane.buffer.byteLength - plane.byteOffset);
             const requiredBytes = stride * h;

             if (requiredBytes > availableBytes && stride > w) {
                 // Stride is too large for the buffer. Fallback to packed.
                 // log('Detected invalid stride, falling back to packed', { reportedStride: stride, w, originalStride, availableBytes, requiredBytes });
                 stride = originalStride || w;
             }

             // Debug logging for strides (once per stream ideally, but here randomized)
             // if (Math.random() < 0.001) {
             //    log('Plane info', { stride, w, h, byteLength: availableBytes, originalStride });
             // }
             
             if (stride === w) {
                 // Ensure we only take exactly w * h bytes. 
                 return Buffer.from(plane.buffer, plane.byteOffset, w * h);
             }
             
             // If stride != width, we must copy row by row to pack the data tightly for FFmpeg rawvideo
             const tight = Buffer.allocUnsafe(w * h);
             for (let y = 0; y < h; y++) {
                 const srcStart = plane.byteOffset + (y * stride);
                 const dstStart = y * w;
                 
                 // Boundary check to prevent crashes if stride is still slightly off
                 if (srcStart + w > plane.buffer.byteLength) {
                     break;
                 }

                 // Copy w bytes from source to dest
                 Buffer.from(plane.buffer, srcStart, w).copy(tight, dstStart);
             }
             return tight;
        };

        const yBuffer = extractPlane(yPlane, effectiveWidth, effectiveHeight, yStride);
        const uBuffer = extractPlane(uPlane, effectiveWidth >> 1, effectiveHeight >> 1, uvStride);
        const vBuffer = extractPlane(vPlane, effectiveWidth >> 1, effectiveHeight >> 1, uvStride);

        const buffer = Buffer.concat([yBuffer, uBuffer, vBuffer]);

        await this.writeVideo(buffer);
      }
    } catch (error) {
      console.error('[Recorder] Video stream error', error);
    }
  }

  async checkSyncAndStart() {
    if (this.encoderStarted) return;
    
    // We need both audio and video to have started receiving data (and FPS detected)
    if (!this.firstAudioTime || !this.firstVideoTime || !this.fpsDetected || !this.videoInfo) {
        return;
    }
    
    if (!this.syncStartTime) {
        // Sync start to the later of the two streams to ensure we have data for both
        this.syncStartTime = Math.max(this.firstAudioTime, this.firstVideoTime);
        // log('Synchronizing streams', { 
        //     audioStart: this.firstAudioTime, 
        //     videoStart: this.firstVideoTime, 
        //     syncStart: this.syncStartTime,
        //     diff: Math.abs(this.firstAudioTime - this.firstVideoTime) 
        // });
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

    // Flush buffered data
    // Use splice to clear and return array
    const pendingAudio = this.pendingAudio.splice(0);
    const pendingVideo = this.pendingVideo.splice(0);
    
    // We assume the 'pending' arrays contain objects { buffer, time } 
    // But currently they are just buffers. 
    // However, since we only start WRITING to pending when read() returns,
    // and we know the arrival time of the FIRST packet.
    
    // Wait, we pushed RAW buffers to pendingAudio/pendingVideo. We didn't attach timestamps.
    // But we know that index 0 of pendingAudio arrived at this.firstAudioTime.
    // And index 0 of pendingVideo arrived at this.firstVideoTime.
    // We can estimate arrival time of each chunk if we assume constant rate, but that's risky.
    // Better approach: We just discard the "head" of the stream that started earlier.
    
    // But since we don't have timestamps on chunks, we can only estimate how much to drop.
    // Audio: 48000 * 2 * 2 bytes/sec? No, it's raw PCM?
    // The AudioStream options say frameSizeMs: 20. So each chunk is roughly 20ms.
    // We can drop N chunks.
    
    // Video: Frame rate is this.videoFps. Each frame is 1000/FPS ms.
    
    // Note: We previously dropped audio/video based on arrival time difference to sync them.
    // However, testing showed this caused "Audio Ahead" issues (audio playing before video action).
    // This implies that the delay in 'firstVideoTime' was primarily network latency/buffering 
    // and not a content timestamp offset. By dropping audio, we were shifting audio "future" 
    // to match "past" video arrival, causing the desync.
    // We now write all captured data. FFmpeg will mux them starting from t=0.
    // Since we start capturing both tracks at subscription time, they should be roughly aligned 
    // by content, even if one arrives later than the other.
    
    // UPDATE: User reports video corruption when syncing logic was enabled.
    // This is likely because we were dropping P-frames or B-frames without dropping the preceding I-frame,
    // causing the decoder to glitch until the next I-frame.
    // We will remove the syncing logic (dropping frames) but keep the manual offset capability 
    // in case we need to implement a safer offset mechanism (e.g. dropping only audio, or full GOPs).
    
    // For now, we will just flush all pending data. The AV_SYNC_OFFSET_MS constant remains but is currently unused
    // to prevent video corruption. If we need to shift audio, we should do it by dropping audio packets only.
    
    if (this.syncStartTime && AV_SYNC_OFFSET_MS !== 0) {
         const offset = AV_SYNC_OFFSET_MS;
         
         // If offset is positive (Audio Ahead), we want to delay Audio (or drop Video).
         // But dropping video frames corrupted the stream.
         // So we should only try to adjust AUDIO if possible.
         
         // If offset is NEGATIVE (Video Ahead), we drop Audio. This is safe.
         if (offset < 0) {
             // Drop initial audio corresponding to 'offset' ms
             const chunksToDrop = Math.floor(Math.abs(offset) / 20);
             if (chunksToDrop > 0 && chunksToDrop < pendingAudio.length) {
                pendingAudio.splice(0, chunksToDrop);
             }
         }
         
         // If offset is POSITIVE (Audio Ahead), we technically need to drop Video or insert silent Audio.
         // Dropping video corrupted it.
         // Inserting silent audio is complex with raw buffers.
         // We will SKIP video dropping for now to fix the corruption.
    }
    
    for (const chunk of pendingAudio) {
      await this.writeAudio(chunk, true);
    }
    for (const chunk of pendingVideo) {
      await this.writeVideo(chunk, true);
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
      '-r',
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
          if (stats.size === 0) {
             // log('Segment file empty', { fullPath });
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
      // that isn't in the playlist yet but exists on disk (e.g. when stopping)
      if (!this.running || this.restarting) {
          const potentialLastSegmentIndex = this.lastSegmentNumber + 1;
          const potentialLastSegmentName = `${this.segmentPrefix}${String(potentialLastSegmentIndex).padStart(5, '0')}.mp4`;
          const potentialLastSegmentPath = path.join(this.outputDir, potentialLastSegmentName);
          
          if (!this.processedSegments.has(potentialLastSegmentPath) && fs.existsSync(potentialLastSegmentPath)) {
             try {
               const stats = await fs.promises.stat(potentialLastSegmentPath);
               if (stats.size > 0) {
                   this.processedSegments.add(potentialLastSegmentPath);
                   this.emitEvent({
                      type: 'segment_complete',
                      mintId: this.mintId,
                      sessionId: this.sessionId,
                      segment: potentialLastSegmentIndex + 1,
                      path: potentialLastSegmentPath,
                      duration: this.segmentDurationSeconds, // Note: It might be shorter, but UI handles duration mostly for ordering
                    });
               }
             } catch(e) {}
          }
      }
    } catch (error) {
      // Ignore errors reading playlist (e.g. locked file)
      console.warn('[Recorder] Failed to read playlist', error);
    } finally {
        this.checkingPlaylist = false;
    }
  }

  extractSegmentNumber(filename) {
    const match = filename.match(/segment_(\d+)\.mp4$/);
    if (!match) return null;
    return parseInt(match[1], 10);
  }

  async writeAudio(buffer, flushing = false) {
    if (!flushing && (!this.encoderStarted || !this.audioPipe || this.restarting)) {
      this.pendingAudio.push(buffer);
      // Don't trigger startEncoderIfReady if we are restarting, it will be handled by restartEncoder
      if (!this.restarting) {
          // await this.startEncoderIfReady(); // We wait for explicit sync
          if (!this.encoderStarted) this.checkSyncAndStart();
      }
      return;
    }

    try {
        if (!this.audioPipe.write(buffer)) {
          await once(this.audioPipe, 'drain');
        }
    } catch (e) {
        // Pipe error (e.g. ffmpeg exited)
        // Push back to pending? Or just drop?
        // If restarting, we might want to save it.
        if (this.restarting) {
            this.pendingAudio.push(buffer);
        }
    }
  }

  async writeVideo(buffer, flushing = false) {
    // If shutting down, strictly do NOT write to avoid partial frames or writing to closing pipes
    if (!flushing && !this.running) return;

    if (!flushing && (!this.encoderStarted || !this.videoPipe || this.restarting)) {
      this.pendingVideo.push(buffer);
      if (!this.restarting) {
          // await this.startEncoderIfReady();
          if (!this.encoderStarted) this.checkSyncAndStart();
      }
      return;
    }

    try {
        // Extra safety check before write
        if (this.videoPipe && !this.videoPipe.destroyed && (flushing || this.running)) {
            if (!this.videoPipe.write(buffer)) {
                await once(this.videoPipe, 'drain');
            }
        }
    } catch (e) {
        if (this.restarting) {
            this.pendingVideo.push(buffer);
        }
    }
  }
  
  async stopEncoderInternal() {
      if (!this.ffmpeg) return;
      
      this.encoderStarted = false;
      
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


        // Wait up to 12 seconds for clean exit (increased to allow final segment flush)
        // If it doesn't exit in 2 seconds, try SIGINT to encourage it.
        
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('timeout'), 12000));
        
        // Race against timeout
        let result = await Promise.race([exitPromise, new Promise(resolve => setTimeout(() => resolve('soft-timeout'), 2000))]);
        
        if (result === 'soft-timeout') {
             log('ffmpeg did not exit quickly, sending SIGINT');
             try {
                 this.ffmpeg.kill('SIGINT');
             } catch (e) {}
             result = await Promise.race([exitPromise, timeoutPromise]);
        }

        if (result === 'timeout') {
           log('encoder did not exit in time, forcing kill');
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
    log('Stopping recorder...');
    this.running = false;

    if (this.playlistPoller) {
      clearInterval(this.playlistPoller);
      this.playlistPoller = null;
    }

    // Stop encoder first to ensure video is saved
    log('Stopping encoder...');
    await this.stopEncoderInternal();
    log('Encoder stopped.');

    if (this.segmentWatcher) {
      this.segmentWatcher.close();
      this.segmentWatcher = null;
    }

    // Check playlist for last segment
    log('Checking playlist...');
    this.checkingPlaylist = false; 
    await this.checkPlaylist();
    log('Playlist checked.');

    // Cleanup LiveKit
    log('Disconnecting LiveKit...');
    
    // Do not await reader cancellations as they might hang if streams are idle
    if (this.audioReader) {
        this.audioReader.cancel().catch(e => console.error('[Recorder] Error cancelling audio reader', e));
        this.audioReader = null;
    }
    
    if (this.videoReader) {
        this.videoReader.cancel().catch(e => console.error('[Recorder] Error cancelling video reader', e));
        this.videoReader = null;
    }

    if (this.room) {
      try {
        await this.room.disconnect();
      } catch (error) {
        // ignore
      }
    }
    log('LiveKit disconnected.');
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

    console.log(JSON.stringify({ type: 'log', message: 'Shutting down recorder...' }));
    
    // Force exit after 25 seconds if recorder.stop() hangs (must be less than Rust's 30s)
    const forceExitTimer = setTimeout(() => {
        console.error(JSON.stringify({ type: 'log', message: 'Shutdown timed out, forcing exit' }));
        process.exit(0);
    }, 25000);

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
