#!/usr/bin/env node
// =============================================================================
// EXPERIMENTAL AUTO-SYNC RECORDER
// =============================================================================
// This is a TEST version of record-livestream.mjs with automatic PTS alignment.
// 
// KEY CHANGES FROM ORIGINAL:
// 1. AUDIO_ADVANCE_MS = 0 (no manual offset)
// 2. No per-mint overrides
// 3. Audio starts mixing immediately when firstAudioTimestampUs is set
// 4. Automatic PTS alignment calculated from first audio/video timestamps
// 5. Negative audio chunks preserved (not deleted)
//
// TO REVERT: Delete this file and change pumpfun.rs back to "record-livestream.mjs"
// =============================================================================

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

// =============================================================================
// EXPERIMENTAL: Auto PTS Sync - No manual offset needed
// =============================================================================
const AUDIO_ADVANCE_MS = 0; // Automatic PTS alignment handles sync

// No per-mint overrides - automatic sync should handle all streams
const AUDIO_ADVANCE_OVERRIDES_MS = {};

const getAudioAdvanceMs = (mintId) => 0; // Always 0 - rely on auto PTS alignment

const AUDIO_FALLBACK_OFFSET_MS = 0;
const DEBUG_SYNC = true;

const DIAGNOSTIC_MODE = true;
const DIAGNOSTIC_LOG_INTERVAL_FRAMES = 30;
const SYNC_HEALTH_INTERVAL_MS = 30000;

const args = process.argv.slice(2);
const [mintId, sessionId, outputDirArg, segmentMinutesArg] = args;

if (!mintId || !sessionId || !outputDirArg) {
  console.error(
    JSON.stringify({
      type: 'error',
      message: 'Usage: record-livestream-experimental.mjs <mintId> <sessionId> <outputDir> [segmentMinutes]',
    })
  );
  process.exit(1);
}

// Log that we're using experimental mode
console.log(JSON.stringify({
  type: 'log',
  message: '🧪 EXPERIMENTAL AUTO-SYNC MODE - Using automatic PTS alignment (no manual offset)'
}));

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

// =============================================================================
// EXPERIMENTAL AudioMixer - Preserves negative chunks for PTS alignment
// =============================================================================
class AudioMixer {
    constructor(frameSize = 3840) {
        this.frameSize = frameSize;
        this.numSamples = frameSize / 2;
        this.chunks = new Map();
        this.lastFlushedIndex = -1;
        this.latencyBuffer = 50; 
    }

    mixChunk(timeIndex, buffer, trackId = null) {
        if (!this.chunks.has(timeIndex)) {
            this.chunks.set(timeIndex, {
                samples: new Float64Array(this.numSamples),
                contributors: 0,
                trackIds: new Set()
            });
        }
        
        const chunk = this.chunks.get(timeIndex);
        const target = chunk.samples;
        
        if (trackId) {
            if (chunk.trackIds.has(trackId)) {
                return;
            }
            chunk.trackIds.add(trackId);
        }
        chunk.contributors++;
        
        const numSamples = Math.min(this.numSamples, buffer.length / 2);
        for (let i = 0; i < numSamples; i++) {
            const sample = buffer.readInt16LE(i * 2);
            target[i] += sample;
        }
    }

    getReadyChunks(currentTimeIndex) {
        const ready = [];
        if (this.lastFlushedIndex === -1) {
             if (this.chunks.size > 0) {
                 this.lastFlushedIndex = -1;
                 
                 // =============================================================
                 // EXPERIMENTAL: DON'T delete negative chunks
                 // They represent audio that arrived before video reference
                 // Keep them for proper PTS alignment
                 // =============================================================
                 // REMOVED: for (const key of this.chunks.keys()) {
                 //     if (key < 0) this.chunks.delete(key);
                 // }
                 
                 // Instead, find the minimum time index and start from there
                 const minIndex = Math.min(...this.chunks.keys());
                 if (minIndex < 0) {
                     log('🧪 EXPERIMENTAL: Preserving negative audio chunks for PTS alignment', {
                         minIndex,
                         chunkCount: this.chunks.size
                     });
                 }
             } else {
                 return [];
             }
        }

        const targetIndex = currentTimeIndex - this.latencyBuffer;
        
        for (let i = this.lastFlushedIndex + 1; i <= targetIndex; i++) {
            if (this.chunks.has(i)) {
                const chunk = this.chunks.get(i);
                const outBuffer = Buffer.alloc(this.frameSize);
                
                const divisor = chunk.contributors > 1 ? chunk.contributors : 1;
                for (let j = 0; j < this.numSamples; j++) {
                    let val = Math.round(chunk.samples[j] / divisor);
                    val = Math.max(-32768, Math.min(32767, val));
                    outBuffer.writeInt16LE(val, j * 2);
                }
                
                ready.push(outBuffer);
                this.chunks.delete(i);
            } else {
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
    this.audioAdvanceMs = 0; // EXPERIMENTAL: Always 0
    this.ffmpegPath = resolveFfmpegBinary();
    this.segmentPrefix = `${this.mintId}_${this.sessionId}_segment_`;
    this.playlistPath = path.join(this.outputDir, 'playlist.csv');
    this.processedSegments = new Set();
    this.running = false;
    this.restarting = false;
    this.stopRequested = false;
    this.room = null;
    this.ffmpeg = null;
    this.audioMixer = new AudioMixer();
    this.audioTracks = new Set();
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
    this.firstAudioTimestampUs = null;
    this.firstVideoTimestampUs = null;
    this.audioSamplesWritten = 0;
    this.audioFrameCount = 0;
    
    this.referenceTime = null;
    this.audioOffsetFromRef = 0;
    this.videoOffsetFromRef = 0;
    this.syncMethod = 'unknown';
    this.videoFramesWritten = 0;
    this._loggedAudioFrame = false;
    this._loggedVideoFrame = false;
    this._audioTimestampSource = 'none';
    this.lastVideoFrame = null;
    this.videoQueue = [];
    
    this.pendingResChange = null;
    this.mixerInterval = null;
    this._loggedResolutionSkip = false;
    this._resChangeConsecutiveFrames = 0;
    
    this._encoderEpoch = 0;
    
    // EXPERIMENTAL: Track early audio frames that arrived before referenceTime
    this._earlyAudioFrames = [];
    this._loggedEarlyAudioFlush = false;
    
    this._diagnosticVideoFrameCount = 0;
    this._diagnosticAudioFrameCount = 0;
    this._diagnosticVideoQueueSkipped = 0;
    this._diagnosticVideoFrameReuse = 0;
    this._diagnosticStrideIssues = 0;
    this._diagnosticLastHealthLog = 0;
    this._diagnosticStreamProfile = null;
    this._diagnosticPlaneWarnings = new Set();
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

    const POLL_INTERVAL_MS = 15000;
    let isLive = false;
    let pollCount = 0;
    
    while (!isLive && !this.stopRequested) {
      try {
        const info = await getLivestreamInfo(this.mintId);
        isLive = Boolean(info?.isLive);
        
        if (!isLive) {
          pollCount++;
          console.log(
            JSON.stringify({
              type: 'waiting_for_stream',
              mintId: this.mintId,
              sessionId: this.sessionId,
              pollCount,
            })
          );
          
          await new Promise((resolve) => {
            const timeout = setTimeout(resolve, POLL_INTERVAL_MS);
            this._waitTimeout = timeout;
          });
          this._waitTimeout = null;
        }
      } catch (error) {
        console.log(
          JSON.stringify({
            type: 'log',
            message: `Error checking stream status: ${error.message}`,
          })
        );
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }
    
    if (this.stopRequested) {
      console.log(
        JSON.stringify({
          type: 'log',
          message: 'Stop requested while waiting for stream',
        })
      );
      return;
    }

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

    let livekitUrl = joinData?.serverUrl || joinData?.url || joinData?.wsUrl;
    if (!livekitUrl) {
      livekitUrl = await getPreferredRegion(token);
    }
    this.running = true;

    await this.startRoom(livekitUrl, token);
    this.startSegmentWatcher();
    
    this.mixerInterval = setInterval(() => this.flushMixer(), 20);
  }

  async startRoom(url, token) {
    this.room = new Room();
    this.room
      .on(RoomEvent.TrackSubscribed, (track) => this.handleTrackSubscribed(track))
      .on(RoomEvent.TrackPublished, (publication, participant) => {
        if (DIAGNOSTIC_MODE) {
            log('DIAG: TrackPublished event', {
                publicationSid: publication?.sid,
                kind: publication?.kind,
                participantIdentity: participant?.identity,
                isSubscribed: publication?.isSubscribed
            });
        }
      })
      .on(RoomEvent.Disconnected, () => {
        this.emitEvent({
          type: 'stream_ended',
          mintId: this.mintId,
          sessionId: this.sessionId,
        });
        this.stop().catch(() => {});
      });

    await this.room.connect(url, token, { autoSubscribe: true });
    
    if (DIAGNOSTIC_MODE) {
        log('DIAG: Room connected', {
            participantCount: this.room?.remoteParticipants?.size || 0,
            localParticipantSid: this.room?.localParticipant?.sid
        });
        
        if (this.room?.remoteParticipants) {
            for (const [sid, participant] of this.room.remoteParticipants) {
                const trackInfo = [];
                if (participant?.trackPublications) {
                    for (const [trackSid, publication] of participant.trackPublications) {
                        trackInfo.push({
                            sid: trackSid,
                            kind: publication?.kind,
                            isSubscribed: publication?.isSubscribed,
                            hasTrack: !!publication?.track
                        });
                        if (publication?.track && !publication?.isSubscribed) {
                            log('DIAG: Manually processing existing track', { trackSid });
                            this.handleTrackSubscribed(publication.track);
                        }
                    }
                }
                log('DIAG: Remote participant', {
                    identity: participant?.identity,
                    sid,
                    tracks: trackInfo
                });
            }
        }
    }
  }

  handleTrackSubscribed(track) {
    if (DIAGNOSTIC_MODE) {
        log('DIAG: TrackSubscribed event', {
            trackSid: track?.sid,
            trackKind: track?.kind,
            kindIsAudio: track?.kind === TrackKind.KIND_AUDIO,
            kindIsVideo: track?.kind === TrackKind.KIND_VIDEO,
            hasVideoReader: !!this.videoReader,
            willProcessVideo: track?.kind === TrackKind.KIND_VIDEO && !this.videoReader
        });
    }
    
    if (track.kind === TrackKind.KIND_AUDIO) {
      this.bindAudioStream(track);
    } else if (track.kind === TrackKind.KIND_VIDEO && !this.videoReader) {
      try {
          if (track.setVideoQuality) {
              track.setVideoQuality(VIDEO_QUALITY_HIGH);
          }
      } catch(e) {}
      this.bindVideoStream(track);
    } else if (track.kind === TrackKind.KIND_VIDEO && this.videoReader) {
      if (DIAGNOSTIC_MODE) {
          log('DIAG: Video track skipped (already have reader)', {
              trackSid: track?.sid
          });
      }
    }
  }

  async bindAudioStream(track) {
    const trackId = track.sid;
    if (this.audioTracks.has(trackId)) return;
    this.audioTracks.add(trackId);
    
    if (DIAGNOSTIC_MODE) {
        const isFirstTrack = this.audioTracks.size === 1;
        log('DIAG: Audio track subscribed', {
            trackId,
            trackNumber: this.audioTracks.size,
            isFirstTrack,
            note: isFirstTrack ? 'Primary audio track' : 'Additional audio track (will be mixed)'
        });
    }

    try {
      const audioStream = new AudioStream(track, {
        sampleRate: 48000,
        numChannels: 2,
        frameSizeMs: 20,
      });
      const reader = audioStream.getReader();

      this.audioReady = true;
      if (!this.encoderStarted) await this.startEncoderIfReady();

      let lastAudioIndex = -1;
      
      let trackFrameCount = 0;
      let trackFirstArrivalTime = null;
      let trackEncoderEpoch = this._encoderEpoch;

      while (this.running) {
        const { value, done } = await reader.read();
        if (done || !value) break;
        
        if (trackEncoderEpoch !== this._encoderEpoch) {
            trackEncoderEpoch = this._encoderEpoch;
            trackFrameCount = 0;
            trackFirstArrivalTime = null;
            lastAudioIndex = -1;
            if (DIAGNOSTIC_MODE) {
                log('DIAG: Audio track reset for new encoder epoch', {
                    trackId,
                    newEpoch: trackEncoderEpoch
                });
            }
        }
        
        const arrivalTime = Date.now();
        this.audioFrameCount++;
        this._diagnosticAudioFrameCount++;
        trackFrameCount++;
        
        if (trackFirstArrivalTime === null) {
            trackFirstArrivalTime = arrivalTime;
        }
        
        let audioTimestampUs = value.timestampUs;
        let timestampSource = 'livekit';
        
        if (audioTimestampUs === undefined) {
            audioTimestampUs = BigInt((trackFrameCount - 1) * 20000);
            timestampSource = 'computed';
        }
        
        if (!this._loggedAudioFrame) {
            this._loggedAudioFrame = true;
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
            
            if (DIAGNOSTIC_MODE) {
                log('DIAG: Stream audio profile', {
                    mintId: this.mintId,
                    hasTimestamp: value.timestampUs !== undefined,
                    timestampSource,
                    dataSize: value.data?.byteLength || 0,
                    sampleRate: 48000,
                    channels: 2,
                    frameSizeMs: 20
                });
            }
            
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
            
            if (DIAGNOSTIC_MODE) {
                log('DIAG: First audio frame', {
                    trackId,
                    trackFrameCount,
                    hasTimestamp: value.timestampUs !== undefined,
                    timestampUs: audioTimestampUs.toString(),
                    timestampSource,
                    arrivalTime,
                    note: timestampSource === 'computed' ? 'Using computed timestamps (per-track counter)' : 'Using LiveKit timestamps'
                });
            }
            
            this.checkSyncAndStart();
        }
        
        // =============================================================
        // EXPERIMENTAL: Start mixing audio IMMEDIATELY when we have
        // firstAudioTimestampUs, don't wait for referenceTime
        // =============================================================
        const shouldMix = this.firstAudioTimestampUs !== null;
        
        if (shouldMix) {
            const buffer = Buffer.from(
              value.data.buffer,
              value.data.byteOffset,
              value.data.byteLength
            );
            
            let timeIndex;
            
            // Calculate time index from PTS
            const diffUs = audioTimestampUs - this.firstAudioTimestampUs;
            const diffMs = Number(diffUs) / 1000;
            
            // Apply the auto-calculated PTS offset (set in checkSyncAndStart)
            // No manual AUDIO_ADVANCE_MS needed
            const relativeTime = diffMs + this.audioOffsetFromRef;
            timeIndex = Math.floor(relativeTime / 20);

            // Jitter snapping
            if (lastAudioIndex !== -1) {
                const diff = timeIndex - (lastAudioIndex + 1);
                if (diff > 0 && diff <= 2) {
                    timeIndex = lastAudioIndex + 1;
                } else if (diff < 0 && diff >= -2) {
                    timeIndex = lastAudioIndex + 1;
                }
            }

            if (timeIndex <= lastAudioIndex) {
                 timeIndex = lastAudioIndex + 1;
            }

            this.audioMixer.mixChunk(timeIndex, buffer, trackId);
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
        const timestampUs = value.timestampUs;
        
        this._diagnosticVideoFrameCount++;

        if (!this.firstVideoTime) {
            this.firstVideoTime = arrivalTime;
            if (timestampUs !== undefined) {
                this.firstVideoTimestampUs = timestampUs;
            }
            
            if (DIAGNOSTIC_MODE) {
                log('DIAG: First video frame', {
                    hasTimestamp: timestampUs !== undefined,
                    timestampUs: timestampUs !== undefined ? timestampUs.toString() : 'UNDEFINED',
                    arrivalTime
                });
            }
        } else if (this.firstVideoTimestampUs !== null && timestampUs !== undefined) {
            const diffUs = timestampUs - this.firstVideoTimestampUs;
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
                    this.videoFps = 30;
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

        const yPlaneRaw = converted.getPlane(0);
        const uPlaneRaw = converted.getPlane(1);
        const vPlaneRaw = converted.getPlane(2);

        if (!yPlaneRaw || !uPlaneRaw || !vPlaneRaw) {
          if (DIAGNOSTIC_MODE && !this._diagnosticPlaneWarnings.has('missing_planes')) {
              this._diagnosticPlaneWarnings.add('missing_planes');
              log('DIAG: WARNING - Missing video planes', {
                  hasY: !!yPlaneRaw,
                  hasU: !!uPlaneRaw,
                  hasV: !!vPlaneRaw,
                  frameCount: this._diagnosticVideoFrameCount
              });
          }
          continue;
        }
        
        const yPlane = Buffer.from(yPlaneRaw.slice());
        const uPlane = Buffer.from(uPlaneRaw.slice());
        const vPlane = Buffer.from(vPlaneRaw.slice());
        yPlane.stride = yPlaneRaw.stride;
        uPlane.stride = uPlaneRaw.stride;
        vPlane.stride = vPlaneRaw.stride;
        
        const analyzePlane = (plane, expectedWidth, expectedHeight, planeName) => {
            const srcBuffer = plane;
            const expectedSize = expectedWidth * expectedHeight;
            const hasExplicitStride = typeof plane.stride === 'number';
            const explicitStride = hasExplicitStride ? plane.stride : null;
            const inferredStride = Math.floor(srcBuffer.length / expectedHeight);
            const strideSource = hasExplicitStride && plane.stride >= expectedWidth ? 'explicit' : 'inferred';
            const usedStride = strideSource === 'explicit' ? explicitStride : inferredStride;
            
            const sizeMatch = srcBuffer.length >= expectedSize;
            const strideMatch = usedStride === expectedWidth;
            const hasExtraPadding = srcBuffer.length > expectedSize && !strideMatch;
            
            return {
                planeName,
                expectedSize,
                actualSize: srcBuffer.length,
                sizeMatch,
                expectedWidth,
                expectedHeight,
                explicitStride,
                inferredStride,
                strideSource,
                usedStride,
                strideMatch,
                hasExtraPadding,
                potentialIssue: !sizeMatch || (hasExtraPadding && strideSource === 'inferred')
            };
        };
        
        if (!this._loggedVideoFrame) {
            this._loggedVideoFrame = true;
            
            const yAnalysis = analyzePlane(yPlane, effectiveWidth, effectiveHeight, 'Y');
            const uAnalysis = analyzePlane(uPlane, effectiveWidth >> 1, effectiveHeight >> 1, 'U');
            const vAnalysis = analyzePlane(vPlane, effectiveWidth >> 1, effectiveHeight >> 1, 'V');
            
            this._diagnosticStreamProfile = {
                resolution: `${effectiveWidth}x${effectiveHeight}`,
                hasVideoTimestamp: timestampUs !== undefined,
                yPlane: yAnalysis,
                uPlane: uAnalysis,
                vPlane: vAnalysis,
                potentialGreenScreen: yAnalysis.potentialIssue || uAnalysis.potentialIssue || vAnalysis.potentialIssue
            };
            
            if (DIAGNOSTIC_MODE) {
                log('DIAG: Stream video profile', {
                    mintId: this.mintId,
                    resolution: `${effectiveWidth}x${effectiveHeight}`,
                    hasVideoTimestamp: timestampUs !== undefined,
                    timestampType: timestampUs !== undefined ? typeof timestampUs : 'N/A',
                    Y: {
                        size: `${yAnalysis.actualSize} (expected ${yAnalysis.expectedSize})`,
                        stride: `${yAnalysis.usedStride} (${yAnalysis.strideSource})`,
                        issue: yAnalysis.potentialIssue ? 'POTENTIAL ISSUE' : 'OK'
                    },
                    U: {
                        size: `${uAnalysis.actualSize} (expected ${uAnalysis.expectedSize})`,
                        stride: `${uAnalysis.usedStride} (${uAnalysis.strideSource})`,
                        issue: uAnalysis.potentialIssue ? 'POTENTIAL ISSUE' : 'OK'
                    },
                    V: {
                        size: `${vAnalysis.actualSize} (expected ${vAnalysis.expectedSize})`,
                        stride: `${vAnalysis.usedStride} (${vAnalysis.strideSource})`,
                        issue: vAnalysis.potentialIssue ? 'POTENTIAL ISSUE' : 'OK'
                    }
                });
                
                if (this._diagnosticStreamProfile.potentialGreenScreen) {
                    log('DIAG: WARNING - Potential green screen risk detected', {
                        reason: 'Plane buffer size or stride mismatch',
                        yIssue: yAnalysis.potentialIssue,
                        uIssue: uAnalysis.potentialIssue,
                        vIssue: vAnalysis.potentialIssue
                    });
                }
            }
            
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

        const extractPlane = (plane, w, h, planeType) => {
             const srcBuffer = plane;
             
             let stride;
             let strideSource = 'inferred';
             if (typeof plane.stride === 'number' && plane.stride >= w) {
                 stride = plane.stride;
                 strideSource = 'explicit';
             } else {
                 stride = Math.floor(srcBuffer.length / h);
                 if (stride < w) stride = w;
             }
             
             if (DIAGNOSTIC_MODE && strideSource === 'inferred' && stride !== w) {
                 const warningKey = `stride_${planeType}_${w}_${stride}`;
                 if (!this._diagnosticPlaneWarnings.has(warningKey)) {
                     this._diagnosticPlaneWarnings.add(warningKey);
                     this._diagnosticStrideIssues++;
                     log('DIAG: Stride inference used', {
                         plane: planeType,
                         expectedWidth: w,
                         inferredStride: stride,
                         bufferSize: srcBuffer.length,
                         height: h,
                         note: stride !== w ? 'PADDING DETECTED' : 'OK'
                     });
                 }
             }
             
             if (stride === w && srcBuffer.length >= w * h) {
                 const result = Buffer.allocUnsafe(w * h);
                 srcBuffer.copy(result, 0, 0, w * h);
                 return result;
             }
             
             const tight = Buffer.allocUnsafe(w * h);
             let outOfBoundsRows = 0;
             
             for (let row = 0; row < h; row++) {
                 const srcStart = row * stride;
                 const dstStart = row * w;
                 
                 if (srcStart + w <= srcBuffer.length) {
                     srcBuffer.copy(tight, dstStart, srcStart, srcStart + w);
                 } else {
                     const fillValue = planeType === 'Y' ? 16 : 128;
                     tight.fill(fillValue, dstStart, dstStart + w);
                     outOfBoundsRows++;
                 }
             }
             
             if (DIAGNOSTIC_MODE && outOfBoundsRows > 0) {
                 const warningKey = `oob_${planeType}_${outOfBoundsRows}`;
                 if (!this._diagnosticPlaneWarnings.has(warningKey)) {
                     this._diagnosticPlaneWarnings.add(warningKey);
                     log('DIAG: WARNING - Out of bounds rows filled', {
                         plane: planeType,
                         outOfBoundsRows,
                         totalRows: h,
                         percentFilled: ((outOfBoundsRows / h) * 100).toFixed(1) + '%'
                     });
                 }
             }
             
             return tight;
        };

        const yBuffer = extractPlane(yPlane, effectiveWidth, effectiveHeight, 'Y');
        const uBuffer = extractPlane(uPlane, effectiveWidth >> 1, effectiveHeight >> 1, 'U');
        const vBuffer = extractPlane(vPlane, effectiveWidth >> 1, effectiveHeight >> 1, 'V');

        const buffer = Buffer.concat([yBuffer, uBuffer, vBuffer]);

        if (this.firstVideoTimestampUs !== null && timestampUs !== undefined) {
            const relativeTimestampUs = timestampUs - this.firstVideoTimestampUs;
            this.videoQueue.push({ 
                buffer, 
                timestampUs: relativeTimestampUs,
                width: effectiveWidth, 
                height: effectiveHeight 
            });
            
            if (this.videoQueue.length > 150) {
                this.videoQueue.shift();
            }
        } else {
            this._diagnosticVideoQueueSkipped++;
            
            if (DIAGNOSTIC_MODE && this._diagnosticVideoQueueSkipped === 1) {
                log('DIAG: WARNING - Video frame skipped (no timestamp)', {
                    hasFirstTimestamp: this.firstVideoTimestampUs !== null,
                    currentTimestamp: timestampUs !== undefined ? timestampUs.toString() : 'UNDEFINED',
                    frameNumber: this._diagnosticVideoFrameCount,
                    note: 'This stream may show STILL IMAGE issue'
                });
            }
            
            if (DIAGNOSTIC_MODE && this._diagnosticVideoQueueSkipped % 30 === 0) {
                log('DIAG: Video frames skipped count', {
                    skipped: this._diagnosticVideoQueueSkipped,
                    total: this._diagnosticVideoFrameCount,
                    percentSkipped: ((this._diagnosticVideoQueueSkipped / this._diagnosticVideoFrameCount) * 100).toFixed(1) + '%'
                });
            }
        }
        
        if (!this.videoInfo) {
             this.currentWidth = effectiveWidth;
             this.currentHeight = effectiveHeight;
             this.videoInfo = { width: effectiveWidth, height: effectiveHeight };
             this._resChangeConsecutiveFrames = 0;
             if (this.fpsDetected) {
               this.checkSyncAndStart();
             }
        } else if (this.currentWidth !== effectiveWidth || this.currentHeight !== effectiveHeight) {
            if (this.encoderStarted) {
                if (DIAGNOSTIC_MODE && !this._loggedResolutionSkip) {
                    this._loggedResolutionSkip = true;
                    log('DIAG: Resolution change starting - skipping mismatched frames', {
                        expected: `${this.currentWidth}x${this.currentHeight}`,
                        received: `${effectiveWidth}x${effectiveHeight}`,
                        note: 'Waiting for 30 consecutive frames at new resolution'
                    });
                }
            }
            
            if (!this.pendingResChange || 
                this.pendingResChange.width !== effectiveWidth || 
                this.pendingResChange.height !== effectiveHeight) {
                this.pendingResChange = {
                    width: effectiveWidth,
                    height: effectiveHeight,
                    consecutiveFrames: 1,
                    start: Date.now()
                };
            } else {
                this.pendingResChange.consecutiveFrames++;
                
                if (this.pendingResChange.consecutiveFrames >= 30) {
                    if (DIAGNOSTIC_MODE) {
                        log('DIAG: Resolution change confirmed after 30 frames', {
                            old: `${this.currentWidth}x${this.currentHeight}`,
                            new: `${effectiveWidth}x${effectiveHeight}`,
                            consecutiveFrames: this.pendingResChange.consecutiveFrames,
                            elapsedMs: Date.now() - this.pendingResChange.start
                        });
                    }
                    
                    log('Resolution change detected', { 
                        old: `${this.currentWidth}x${this.currentHeight}`, 
                        new: `${effectiveWidth}x${effectiveHeight}` 
                    });
                    
                    const queueSizeBefore = this.videoQueue.length;
                    this.videoQueue = this.videoQueue.filter(
                        item => item.width === effectiveWidth && item.height === effectiveHeight
                    );
                    
                    if (DIAGNOSTIC_MODE && queueSizeBefore !== this.videoQueue.length) {
                        log('DIAG: Cleared wrong-resolution frames from queue', {
                            before: queueSizeBefore,
                            after: this.videoQueue.length,
                            removed: queueSizeBefore - this.videoQueue.length
                        });
                    }
                    
                    await this.restartEncoder(effectiveWidth, effectiveHeight);
                    this.pendingResChange = null;
                    this._loggedResolutionSkip = false;
                }
            }
            
            if (this.encoderStarted) {
                continue;
            }
        } else {
            if (this.pendingResChange) {
                this.pendingResChange = null;
                this._loggedResolutionSkip = false;
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
        const hasVideoPTS = this.firstVideoTimestampUs !== null;
        const hasAudioPTS = this.firstAudioTimestampUs !== null;
        
        if (hasAudioPTS && hasVideoPTS) {
            const wallClockOffsetMs = this.firstAudioTime - this.firstVideoTime;
            this.referenceTime = Math.min(this.firstAudioTime, this.firstVideoTime);
            
            // =============================================================
            // EXPERIMENTAL: Auto-calculate PTS alignment offset
            // =============================================================
            const ptsOffsetUs = this.firstAudioTimestampUs - this.firstVideoTimestampUs;
            const ptsOffsetMs = Number(ptsOffsetUs) / 1000;
            
            // If audio PTS > video PTS: audio content is "later" → advance it (negative offset)
            // If audio PTS < video PTS: audio content is "earlier" → delay it (positive offset)
            this.audioOffsetFromRef = -ptsOffsetMs;
            this.videoOffsetFromRef = 0;
            
            this.syncMethod = this._audioTimestampSource === 'livekit' ? 'pts' : 'computed-pts';
            
            log('🧪 EXPERIMENTAL: Auto PTS alignment calculated', {
                method: this.syncMethod,
                audioSource: this._audioTimestampSource,
                audioPtsStart: this.firstAudioTimestampUs.toString(),
                videoPtsStart: this.firstVideoTimestampUs.toString(),
                ptsOffsetMs: ptsOffsetMs.toFixed(2),
                autoCorrection: this.audioOffsetFromRef.toFixed(2),
                wallClockDiffMs: wallClockOffsetMs.toFixed(1),
                note: 'No manual AUDIO_ADVANCE_MS applied'
            });
        } else {
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
        this.fpsSamples = [];
        this.videoQueue = [];
        this._loggedAudioFrame = false;
        this._loggedVideoFrame = false;
        this._videoTimestampOffset = undefined;
        this._encoderEpoch++;
        
        if (DIAGNOSTIC_MODE) {
            log('DIAG: Encoder restarting - resetting counters', {
                previousVideoFramesReceived: this._diagnosticVideoFrameCount,
                previousAudioFramesReceived: this._diagnosticAudioFrameCount,
                previousSkipped: this._diagnosticVideoQueueSkipped,
                reason: 'resolution_change'
            });
        }
        this._diagnosticVideoFrameCount = 0;
        this._diagnosticAudioFrameCount = 0;
        this._diagnosticVideoQueueSkipped = 0;
        this._diagnosticVideoFrameReuse = 0;
        this._diagnosticStrideIssues = 0;
        this._diagnosticPlaneWarnings.clear();
        this._diagnosticStreamProfile = null;
        
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
      
      if (DIAGNOSTIC_MODE && now - this._diagnosticLastHealthLog >= SYNC_HEALTH_INTERVAL_MS) {
          this._diagnosticLastHealthLog = now;
          
          const elapsedSec = relativeTime / 1000;
          const expectedVideoFrames = Math.floor((this.audioSamplesWritten / 48000) * 30);
          const actualVideoFrames = this.videoFramesWritten;
          const videoDrift = actualVideoFrames - expectedVideoFrames;
          const driftPercent = expectedVideoFrames > 0 ? ((videoDrift / expectedVideoFrames) * 100) : 0;
          
          const expectedRatio = 1600;
          const actualRatio = actualVideoFrames > 0 ? (this.audioSamplesWritten / actualVideoFrames) : 0;
          
          log('DIAG: Sync health report', {
              elapsedSec: elapsedSec.toFixed(1),
              audioSamplesWritten: this.audioSamplesWritten,
              videoFramesWritten: actualVideoFrames,
              expectedVideoFrames,
              videoDrift,
              driftPercent: driftPercent.toFixed(2) + '%',
              expectedRatio,
              actualRatio: actualRatio.toFixed(1),
              syncMethod: this.syncMethod,
              audioTimestampSource: this._audioTimestampSource,
              videoQueueDepth: this.videoQueue.length,
              audioMixerChunks: this.audioMixer.chunks.size,
              totalVideoFramesReceived: this._diagnosticVideoFrameCount,
              totalAudioFramesReceived: this._diagnosticAudioFrameCount,
              videoFramesSkipped: this._diagnosticVideoQueueSkipped,
              videoFrameReuseCount: this._diagnosticVideoFrameReuse,
              strideIssuesDetected: this._diagnosticStrideIssues,
              experimentalMode: true,
              autoOffset: this.audioOffsetFromRef.toFixed(2)
          });
          
          if (this._diagnosticVideoQueueSkipped > 0) {
              log('DIAG: WARNING - Video frames being skipped', {
                  skipped: this._diagnosticVideoQueueSkipped,
                  percentOfTotal: ((this._diagnosticVideoQueueSkipped / this._diagnosticVideoFrameCount) * 100).toFixed(1) + '%',
                  likelyCause: 'Missing timestamps - may cause STILL IMAGE'
              });
          }
          
          if (Math.abs(driftPercent) > 5) {
              log('DIAG: WARNING - Significant A/V drift detected', {
                  driftPercent: driftPercent.toFixed(2) + '%',
                  driftFrames: videoDrift,
                  note: 'Audio/video may be out of sync'
              });
          }
      }
      
      const chunks = this.audioMixer.getReadyChunks(currentTimeIndex);
      
      if (chunks.length > 0) {
          for (const chunk of chunks) {
              if (this.audioPipe && !this.audioPipe.destroyed) {
                  if (!this.audioPipe.write(chunk)) {
                  }
                  
                  this.audioSamplesWritten += (chunk.length / 4);
              }
          }
          
          await this.syncVideoToAudio();
      }
  }

  async syncVideoToAudio() {
      if (!this.videoPipe || this.restarting || !this.firstVideoTimestampUs || !this.referenceTime) return;

      if (this._videoTimestampOffset === undefined && this.videoQueue.length > 0) {
          const queueMinTs = this.videoQueue.reduce(
              (min, item) => item.timestampUs < min ? item.timestampUs : min, 
              this.videoQueue[0].timestampUs
          );
          
          if (queueMinTs > 0n) {
              this._videoTimestampOffset = queueMinTs;
              if (DIAGNOSTIC_MODE) {
                  log('DIAG: Adjusting video timestamp baseline', {
                      queueMinTs: queueMinTs.toString(),
                      note: 'Early frames were dropped before encoder started, adjusting baseline'
                  });
              }
          } else {
              this._videoTimestampOffset = 0n;
          }
      }
      
      const timestampOffset = this._videoTimestampOffset || 0n;

      const targetVideoFrames = Math.floor((this.audioSamplesWritten / 48000) * 30);
      
      while (this.videoFramesWritten < targetVideoFrames) {
          const frameTimeUs = BigInt(Math.floor(this.videoFramesWritten * 33333.33));
          const targetTimestampUs = frameTimeUs + timestampOffset;
          
          let bestFrame = null;
          let bestIndex = -1;
          
          for (let i = 0; i < this.videoQueue.length; i++) {
              const item = this.videoQueue[i];
              if (item.timestampUs <= targetTimestampUs) {
                  if (bestFrame === null || item.timestampUs > bestFrame.timestampUs) {
                      bestFrame = item;
                      bestIndex = i;
                  }
              }
          }
          
          const usingNewFrame = bestFrame !== null;
          
          if (bestFrame) {
              this.lastVideoFrame = bestFrame.buffer;
              
              const bestTs = bestFrame.timestampUs;
              this.videoQueue = this.videoQueue.filter(item => item.timestampUs >= bestTs);
          } else {
              if (this.videoQueue.length > 0) {
                  const queueMin = this.videoQueue.reduce(
                      (min, item) => item.timestampUs < min ? item.timestampUs : min, 
                      this.videoQueue[0].timestampUs
                  );
                  
                  if (queueMin > targetTimestampUs) {
                      const gapUs = queueMin - targetTimestampUs;
                      const framesToSkip = Math.floor(Number(gapUs) / 33333.33);
                      
                      if (framesToSkip > 0) {
                          this._diagnosticSkipAheadCount = (this._diagnosticSkipAheadCount || 0) + 1;
                          this._diagnosticSkipAheadFrames = (this._diagnosticSkipAheadFrames || 0) + framesToSkip;
                          
                          if (DIAGNOSTIC_MODE && (this._diagnosticSkipAheadCount === 1 || this._diagnosticSkipAheadCount % 100 === 0)) {
                              log('DIAG: Skipping ahead to match queue', {
                                  targetTimestampUs: targetTimestampUs.toString(),
                                  queueMinTs: queueMin.toString(),
                                  gapUs: gapUs.toString(),
                                  framesToSkip,
                                  totalSkipEvents: this._diagnosticSkipAheadCount,
                                  totalFramesSkipped: this._diagnosticSkipAheadFrames,
                                  note: 'Queue is ahead of playback position, catching up'
                              });
                          }
                          
                          this.videoFramesWritten += framesToSkip;
                          continue;
                      }
                  }
              }
              
              this._diagnosticVideoFrameReuse++;
              
              if (DIAGNOSTIC_MODE) {
                  if (this._diagnosticVideoFrameReuse === 1) {
                      const queueSample = this.videoQueue.slice(0, 5).map((item, idx) => ({
                          idx,
                          ts: item.timestampUs.toString(),
                          tsType: typeof item.timestampUs
                      }));
                      const queueMin = this.videoQueue.length > 0 
                          ? this.videoQueue.reduce((min, item) => item.timestampUs < min ? item.timestampUs : min, this.videoQueue[0].timestampUs)
                          : null;
                      const queueMax = this.videoQueue.length > 0
                          ? this.videoQueue.reduce((max, item) => item.timestampUs > max ? item.timestampUs : max, this.videoQueue[0].timestampUs)
                          : null;
                      
                      log('DIAG: WARNING - No matching video frame found, reusing last frame', {
                          targetTimestampUs: targetTimestampUs.toString(),
                          targetType: typeof targetTimestampUs,
                          queueLength: this.videoQueue.length,
                          hasLastFrame: this.lastVideoFrame !== null,
                          queueMinTs: queueMin !== null ? queueMin.toString() : 'N/A',
                          queueMaxTs: queueMax !== null ? queueMax.toString() : 'N/A',
                          queueSample,
                          firstVideoTimestampUs: this.firstVideoTimestampUs ? this.firstVideoTimestampUs.toString() : 'null',
                          note: 'If this persists, video may appear frozen'
                      });
                      
                      if (this.videoQueue.length > 0) {
                          const firstItem = this.videoQueue[0];
                          log('DIAG: Comparison debug', {
                              firstItemTs: firstItem.timestampUs.toString(),
                              firstItemTsType: typeof firstItem.timestampUs,
                              targetTs: targetTimestampUs.toString(),
                              targetTsType: typeof targetTimestampUs,
                              comparisonResult: firstItem.timestampUs <= targetTimestampUs,
                              directComparison: `${firstItem.timestampUs} <= ${targetTimestampUs} = ${firstItem.timestampUs <= targetTimestampUs}`
                          });
                      }
                  } else if (this._diagnosticVideoFrameReuse % 90 === 0) {
                      log('DIAG: Video frame reuse count', {
                          reuseCount: this._diagnosticVideoFrameReuse,
                          totalWritten: this.videoFramesWritten,
                          percentReused: ((this._diagnosticVideoFrameReuse / this.videoFramesWritten) * 100).toFixed(1) + '%',
                          queueLength: this.videoQueue.length
                      });
                  }
              }
          }
          
          const bufferToWrite = this.lastVideoFrame || Buffer.alloc(this.videoInfo.width * this.videoInfo.height * 1.5);
          
          if (this.videoPipe && !this.videoPipe.destroyed) {
               if (!this.videoPipe.write(bufferToWrite)) {
               }
               this.videoFramesWritten++;
          } else {
              break;
          }
      }
  }

  async writeVideo(buffer, flushing = false, arrivalTime = 0) {
      if (flushing) {
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

    if (DIAGNOSTIC_MODE) {
        const durationSec = this.referenceTime ? (Date.now() - this.referenceTime) / 1000 : 0;
        const expectedVideoFrames = Math.floor((this.audioSamplesWritten / 48000) * 30);
        const videoDrift = this.videoFramesWritten - expectedVideoFrames;
        
        log('DIAG: Recording session summary (EXPERIMENTAL)', {
            mintId: this.mintId,
            sessionId: this.sessionId,
            durationSec: durationSec.toFixed(1),
            syncMethod: this.syncMethod,
            audioTimestampSource: this._audioTimestampSource,
            experimentalMode: true,
            autoOffset: this.audioOffsetFromRef.toFixed(2),
            totalVideoFramesReceived: this._diagnosticVideoFrameCount,
            totalAudioFramesReceived: this._diagnosticAudioFrameCount,
            videoFramesWritten: this.videoFramesWritten,
            audioSamplesWritten: this.audioSamplesWritten,
            videoFramesSkipped: this._diagnosticVideoQueueSkipped,
            videoFrameReuseCount: this._diagnosticVideoFrameReuse,
            strideIssuesDetected: this._diagnosticStrideIssues,
            expectedVideoFrames,
            videoDrift,
            driftPercent: expectedVideoFrames > 0 ? ((videoDrift / expectedVideoFrames) * 100).toFixed(2) + '%' : 'N/A',
            streamProfile: this._diagnosticStreamProfile
        });
        
        const issues = [];
        if (this._diagnosticVideoQueueSkipped > this._diagnosticVideoFrameCount * 0.1) {
            issues.push('HIGH VIDEO FRAME SKIP RATE - Likely STILL IMAGE issue');
        }
        if (this._diagnosticVideoFrameReuse > this.videoFramesWritten * 0.5) {
            issues.push('HIGH FRAME REUSE RATE - Video may appear frozen');
        }
        if (this._diagnosticStrideIssues > 0) {
            issues.push('STRIDE ISSUES DETECTED - Potential GREEN SCREEN risk');
        }
        if (Math.abs(videoDrift) > expectedVideoFrames * 0.05) {
            issues.push('SIGNIFICANT A/V DRIFT - Sync may be off');
        }
        
        if (issues.length > 0) {
            log('DIAG: Session issues detected', {
                issueCount: issues.length,
                issues
            });
        } else {
            log('🧪 EXPERIMENTAL: Session completed without detected issues');
        }
    }

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

  let isStarting = true;

  const shutdown = async () => {
    process.off('SIGINT', shutdown);
    process.off('SIGTERM', shutdown);
    process.stdin.off('data', onStdinData);
    
    recorder.stopRequested = true;
    if (recorder._waitTimeout) {
      clearTimeout(recorder._waitTimeout);
    }
    
    if (isStarting) {
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
  isStarting = false;
}

main().catch((error) => {
  console.error(JSON.stringify({ type: 'error', message: error.message }));
  process.exit(1);
});

