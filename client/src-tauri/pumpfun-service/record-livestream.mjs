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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FFMPEG_BINARIES = {
  win32: 'ffmpeg-x86_64-pc-windows-msvc.exe',
  darwin: 'ffmpeg-x86_64-apple-darwin',
  linux: 'ffmpeg-x86_64-unknown-linux-gnu',
};

function resolveFfmpegBinary() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }

  const binName = FFMPEG_BINARIES[process.platform];
  if (binName) {
    const candidate = path.resolve(__dirname, '../binaries', binName);
    if (fs.existsSync(candidate)) {
      return candidate;
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
    log('Resolved ffmpeg path', { path: this.ffmpegPath });
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
  }

  async start() {
    log('Recorder initializing', {
      mintId: this.mintId,
      sessionId: this.sessionId,
      outputDir: this.outputDir,
      segmentSeconds: this.segmentDurationSeconds,
    });
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
    log('Received LiveKit join response', { room: joinData?.room, role: joinData?.role });
    const token = joinData?.token;
    if (!token) {
      throw new Error('Failed to obtain LiveKit token');
    }

    const livekitUrl = await getPreferredRegion(token);
    log('Selected LiveKit region', { livekitUrl });
    this.running = true;

    await this.startRoom(livekitUrl, token);
    this.startSegmentWatcher();
  }

  async startRoom(url, token) {
    this.room = new Room();
    this.room
      .on(RoomEvent.TrackSubscribed, (track) => this.handleTrackSubscribed(track))
      .on(RoomEvent.Disconnected, () => {
        log('LiveKit disconnected');
        this.emitEvent({
          type: 'stream_ended',
          mintId: this.mintId,
          sessionId: this.sessionId,
        });
        this.stop().catch(() => {});
      })
      .on(RoomEvent.Connected, () => {
        log('LiveKit room connected successfully');
      })
      .on(RoomEvent.Reconnecting, () => {
        log('LiveKit reconnecting...');
      })
      .on(RoomEvent.Reconnected, () => {
        log('LiveKit reconnected');
      });

    log('Connecting to LiveKit', { url });
    await this.room.connect(url, token, { autoSubscribe: true });
    log('Connected to LiveKit');
  }

  handleTrackSubscribed(track) {
    log('Track subscribed', { kind: track.kind });
    if (track.kind === TrackKind.KIND_AUDIO && !this.audioReader) {
      this.bindAudioStream(track);
    } else if (track.kind === TrackKind.KIND_VIDEO && !this.videoReader) {
      this.bindVideoStream(track);
    }
  }

  async bindAudioStream(track) {
    log('bindAudioStream started');
    try {
      const audioStream = new AudioStream(track, {
        sampleRate: 48000,
        numChannels: 2,
        frameSizeMs: 20,
      });
      log('AudioStream created');
      this.audioReader = audioStream.getReader();
      log('AudioReader created');
      this.audioReady = true;
      await this.startEncoderIfReady();
      log('Audio stream ready');

      while (this.running) {
        const { value, done } = await this.audioReader.read();
        if (done || !value) break;
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
    log('bindVideoStream started');
    try {
      const videoStream = new VideoStream(track);
      log('VideoStream created');
      this.videoReader = videoStream.getReader();
      log('VideoReader created');
      this.videoReady = true;

      await this.startEncoderIfReady();
      log('Video stream ready');

      while (this.running) {
        const { value, done } = await this.videoReader.read();
        if (done || !value) break;
        const frame = value.frame;
        const converted = frame.convert(VideoBufferType.I420);
        const width = converted.width;
        const height = converted.height;

        // Check for resolution change
        if (this.encoderStarted && (width !== this.currentWidth || height !== this.currentHeight)) {
          // Only restart if dimensions actually changed and are non-zero
          if (this.currentWidth !== 0 && this.currentHeight !== 0) {
            log('Resolution changed', { old: `${this.currentWidth}x${this.currentHeight}`, new: `${width}x${height}` });
            await this.restartEncoder(width, height);
          }
        }

        // Only restart encoder for resolution change if we have frames and dimensions are non-zero
        if (this.currentWidth !== 0 && this.currentHeight !== 0 && 
            (width !== this.currentWidth || height !== this.currentHeight)) {
              
          // Only trigger restart if we are already encoding
          if (this.encoderStarted) {
             log('Resolution changed', { old: `${this.currentWidth}x${this.currentHeight}`, new: `${width}x${height}` });
             await this.restartEncoder(width, height);
          } else {
             // If encoder hasn't started yet, just update dimensions
             this.currentWidth = width;
             this.currentHeight = height;
             this.videoInfo = { width, height };
          }
        }

        if (!this.videoInfo) {
          log('Received first video frame', { width, height });
          this.currentWidth = width;
          this.currentHeight = height;
          this.videoInfo = { width, height };
          await this.startEncoderIfReady();
        }

        const yPlane = converted.getPlane(0);
        const uPlane = converted.getPlane(1);
        const vPlane = converted.getPlane(2);

        if (!yPlane || !uPlane || !vPlane) {
          continue;
        }

        const buffer = Buffer.concat([
          Buffer.from(yPlane.buffer, yPlane.byteOffset, yPlane.byteLength),
          Buffer.from(uPlane.buffer, uPlane.byteOffset, uPlane.byteLength),
          Buffer.from(vPlane.buffer, vPlane.byteOffset, vPlane.byteLength),
        ]);

        await this.writeVideo(buffer);
      }
    } catch (error) {
      console.error('[Recorder] Video stream error', error);
    }
  }

  async startEncoderIfReady() {
    if (this.encoderStarted) {
      return;
    }

    if (!this.audioReady || !this.videoReady || !this.videoInfo) {
      log('Encoder waiting for media', {
        audioReady: this.audioReady,
        videoReady: this.videoReady,
        hasVideoInfo: Boolean(this.videoInfo),
      });
      return;
    }

    this.startEncoder();
    this.encoderStarted = true;

    // Flush buffered data
    // Use splice to clear and return array
    const pendingAudio = this.pendingAudio.splice(0);
    const pendingVideo = this.pendingVideo.splice(0);
    
    for (const chunk of pendingAudio) {
      await this.writeAudio(chunk);
    }
    for (const chunk of pendingVideo) {
      await this.writeVideo(chunk);
    }
  }

  startEncoder() {
    const outputPattern = path.join(this.outputDir, `${this.segmentPrefix}%05d.mp4`);

    const { width, height } = this.videoInfo || { width: 1280, height: 720 };
    
    // Determine start number based on last processed segment
    const startNumber = this.lastSegmentNumber + 1;

    log('Starting ffmpeg encoder', { width, height, fps: this.videoFps, outputPattern, startNumber });

    const args = [
      '-loglevel',
      'warning',
      '-y',
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
      stdio: ['pipe', 'pipe', 'pipe', 'pipe', 'pipe'],
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
        log('ffmpeg exited cleanly or as expected');
      }
    });
  }

  async restartEncoder(width, height) {
    if (this.restarting) return;
    this.restarting = true;
    
    try {
        log('Restarting encoder due to resolution change');
        
        // 1. Stop current encoder cleanly
        await this.stopEncoderInternal();
        
        // 2. Update dimensions
        this.currentWidth = width;
        this.currentHeight = height;
        this.videoInfo = { width, height };
        
        // 3. Start new encoder
        // Logic of startEncoderIfReady will start it and flush any pending buffers accumulated during stop
        await this.startEncoderIfReady();
        
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

      log('Checking playlist lines', { count: lines.length });

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
        log('Segment complete', { segmentIndex, fullPath, size: (await fs.promises.stat(fullPath)).size });
        
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
                   log('Found final segment not in playlist', { segmentIndex: potentialLastSegmentIndex, fullPath: potentialLastSegmentPath, size: stats.size });
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

  async writeAudio(buffer) {
    if (!this.encoderStarted || !this.audioPipe || this.restarting) {
      this.pendingAudio.push(buffer);
      // Don't trigger startEncoderIfReady if we are restarting, it will be handled by restartEncoder
      if (!this.restarting) {
          await this.startEncoderIfReady();
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

  async writeVideo(buffer) {
    if (!this.encoderStarted || !this.videoPipe || this.restarting) {
      this.pendingVideo.push(buffer);
      if (!this.restarting) {
          await this.startEncoderIfReady();
      }
      return;
    }

    try {
        if (!this.videoPipe.write(buffer)) {
          await once(this.videoPipe, 'drain');
        }
    } catch (e) {
        if (this.restarting) {
            this.pendingVideo.push(buffer);
        }
    }
  }
  
  async stopEncoderInternal() {
      if (!this.ffmpeg) return;
      
      log('Stopping internal encoder...');
      this.encoderStarted = false;
      
      try {
        // Wait for ffmpeg to exit after closing inputs
        const exitPromise = once(this.ffmpeg, 'exit');
        
        // Close inputs
        // For stdin (audio), we must end it to signal EOF
        try { 
            if (!this.ffmpeg.stdin.destroyed) {
                this.ffmpeg.stdin.end(); 
            }
        } catch(e) {}
        
        // For video pipe (stdio[3]), we must also end it
        if (this.videoPipe) {
          try { 
            if (!this.videoPipe.destroyed) {
                this.videoPipe.end(); 
            }
          } catch(e) {}
        }

        // Wait up to 10 seconds for clean exit (increased from 5s to allow final segment flush)
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('timeout'), 10000));
        const result = await Promise.race([exitPromise, timeoutPromise]);
        
        if (result === 'timeout') {
           log('ffmpeg did not exit in time, forcing kill');
           this.ffmpeg.kill('SIGKILL');
        } else {
           log('ffmpeg exited cleanly');
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

    if (this.audioReader) {
      try {
        await this.audioReader.cancel();
      } catch (error) {
        // ignore
      }
      this.audioReader = null;
    }

    if (this.videoReader) {
      try {
        await this.videoReader.cancel();
      } catch (error) {
        // ignore
      }
      this.videoReader = null;
    }
    
    await this.stopEncoderInternal();

    if (this.segmentWatcher) {
      this.segmentWatcher.close();
      this.segmentWatcher = null;
    }

    // Final check of playlist to catch the last segment
    // Force a check even if one was "in progress" or recently done
    this.checkingPlaylist = false; 
    await this.checkPlaylist();

    if (this.room) {
      try {
        await this.room.disconnect();
      } catch (error) {
        // ignore
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

  log('Bootstrapping recorder', { mintId, sessionId, outputDir, segmentMinutes });

  await recorder.start();

  const shutdown = async () => {
    await recorder.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error(JSON.stringify({ type: 'error', message: error.message }));
  process.exit(1);
});
