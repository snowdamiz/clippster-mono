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
        // Buffer latency in frames (20ms each). 10 frames = 200ms
        this.latencyBuffer = 10; 
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
        // If this is the first flush, start from the earliest chunk we have
        if (this.lastFlushedIndex === -1) {
            if (this.chunks.size === 0) return [];
            const keys = Array.from(this.chunks.keys()).sort((a, b) => a - b);
            this.lastFlushedIndex = keys[0] - 1;
        }

        const targetIndex = currentTimeIndex - this.latencyBuffer;
        
        for (let i = this.lastFlushedIndex + 1; i <= targetIndex; i++) {
            if (this.chunks.has(i)) {
                ready.push(this.chunks.get(i));
                this.chunks.delete(i);
            } else {
                // Implicit silence for gaps
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
    
    this.referenceTime = null;
    this.videoFramesWritten = 0;
    this.lastVideoBuffer = null;
    
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
            
            // Calculate index based on time since start
            const relativeTime = arrivalTime - this.referenceTime;
            if (relativeTime >= 0) {
                const timeIndex = Math.floor(relativeTime / 20);
                this.audioMixer.mixChunk(timeIndex, buffer);
            }
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
        
        const arrivalTime = Date.now();
        const frame = value.frame;
        
        if (!this.fpsDetected) {
            this.fpsSamples.push(arrivalTime);
            const count = this.fpsSamples.length;
            
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
        }

        const converted = frame.convert(VideoBufferType.I420);
        const width = converted.width;
        const height = converted.height;
        const effectiveWidth = width & ~1;
        const effectiveHeight = height & ~1;

        if (this.encoderStarted) {
            if (this.currentWidth !== 0 && (effectiveWidth !== this.currentWidth || effectiveHeight !== this.currentHeight)) {
                if (!this.pendingResChange || 
                    this.pendingResChange.width !== effectiveWidth || 
                    this.pendingResChange.height !== effectiveHeight) {
                    this.pendingResChange = {
                        width: effectiveWidth,
                        height: effectiveHeight,
                        start: Date.now()
                    };
                    continue;
                }
                
                if (Date.now() - this.pendingResChange.start > 2000) {
                    log('Resolution change stable, restarting encoder', { 
                        old: `${this.currentWidth}x${this.currentHeight}`,
                        new: `${effectiveWidth}x${effectiveHeight}`
                    });
                    await this.restartEncoder(effectiveWidth, effectiveHeight);
                    this.pendingResChange = null;
                } else {
                    continue;
                }
            } else {
                if (this.pendingResChange) {
                    this.pendingResChange = null;
                }
            }
        } else if (this.currentWidth === 0) {
             this.currentWidth = effectiveWidth;
             this.currentHeight = effectiveHeight;
             this.videoInfo = { width: effectiveWidth, height: effectiveHeight };
        } else if (effectiveWidth !== this.currentWidth || effectiveHeight !== this.currentHeight) {
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

    const pendingVideo = this.pendingVideo.splice(0);
    for (const item of pendingVideo) {
      await this.writeVideo(item.buffer, true, item.timestamp);
    }
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
      '-framerate', String(this.videoFps),
      '-i', 'pipe:3',
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
        this.lastVideoBuffer = null;
        this.referenceTime = null;
        this.videoFramesWritten = 0;
        this.firstAudioTime = null;
        this.firstVideoTime = null;
        this.fpsDetected = false;
        
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
      
      const chunks = this.audioMixer.getReadyChunks(currentTimeIndex);
      
      if (chunks.length > 0) {
          for (const chunk of chunks) {
              if (this.audioPipe && !this.audioPipe.destroyed) {
                  if (!this.audioPipe.write(chunk)) {
                      // We don't await drain in the interval to prevent blocking, 
                      // but in a real-time scenario we just push.
                  }
              }
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
