import { Platform } from 'react-native';
import { EventEmitter, requireNativeModule } from 'expo-modules-core';
import { getNativeEditorModule } from '@clippster/editor-native';

import {
  adaptArgsForMobileEncoders,
  isHardwareMobileCodec,
  preferredMobileVideoCodec,
} from '@/lib/ffmpegArgs';
import type { MediaProbeMetadata } from '@/lib/exportValidation';

type FFmpegProgress = {
  time: number;
  totalDuration?: number;
  sessionId?: string;
};

type FFmpegLogEvent = {
  sessionId?: string;
  level?: string;
  message?: string;
};

type ExpoFFmpegNative = {
  run: (
    sessionId: string,
    args: string[],
    options: { logLevel: number; environmentVariables?: Record<string, string> },
  ) => Promise<{ returnCode: number; output?: string; duration?: number }>;
  cancel: (sessionId: string) => void;
  getVersion: () => string;
};

type FFmpegEmitter = {
  addListener: (
    eventName: 'onProgress' | 'onLog',
    listener: (event: FFmpegProgress | FFmpegLogEvent) => void,
  ) => { remove: () => void };
};

let nativeModule: ExpoFFmpegNative | null | undefined;
let progressEmitter: FFmpegEmitter | null = null;
let activeSessionId: string | null = null;

const FFMPEG_UNAVAILABLE =
  'FFmpeg is not available in this build. Rebuild the dev client: yarn mobile:android (or EAS development build). Expo Go cannot download HLS streams.';

/** Use the native module directly — never import ffmpeg-expo JS (crashes if native is missing). */
function getNativeModule(): ExpoFFmpegNative | null {
  if (nativeModule !== undefined) {
    return nativeModule;
  }
  if (Platform.OS === 'web') {
    nativeModule = null;
    return null;
  }

  try {
    const mod = requireNativeModule<ExpoFFmpegNative>('ExpoFFmpeg');
    if (typeof mod.run !== 'function' || typeof mod.getVersion !== 'function') {
      nativeModule = null;
      return null;
    }
    nativeModule = mod;
    progressEmitter = new EventEmitter(mod as never) as FFmpegEmitter;
    return nativeModule;
  } catch {
    nativeModule = null;
    return null;
  }
}

function generateSessionId(): string {
  return `ffmpeg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function executeNative(
  args: string[],
  options?: { onProgress?: (progress: FFmpegProgress) => void },
): Promise<{ returnCode: number; output?: string }> {
  const mod = getNativeModule();
  if (!mod || !progressEmitter) {
    throw new Error(FFMPEG_UNAVAILABLE);
  }

  const sessionId = generateSessionId();
  activeSessionId = sessionId;
  const logChunks: string[] = [];
  let progressSub: { remove: () => void } | undefined;
  let logSub: { remove: () => void } | undefined;

  console.log('[FFmpeg] run', args.join(' '));

  if (options?.onProgress) {
    progressSub = progressEmitter.addListener('onProgress', (event) => {
      const progress = event as FFmpegProgress;
      if (progress.sessionId === sessionId) {
        options.onProgress?.(progress);
      }
    });
  }

  // Native C++ LOGE goes to logcat only; onLog is what reaches Metro.
  logSub = progressEmitter.addListener('onLog', (event) => {
    const logEvent = event as FFmpegLogEvent;
    if (logEvent.sessionId !== sessionId) return;
    const line = logEvent.message?.trim();
    if (!line) return;
    logChunks.push(line);
    console.log(`[FFmpeg:${logEvent.level ?? 'log'}] ${line}`);
  });

  try {
    // AV_LOG_INFO = 32 (native expects AV levels, not the JS string-index mapping)
    const result = await mod.run(sessionId, args, { logLevel: 32 });
    const combined = [result.output?.trim(), logChunks.join('\n').trim()].filter(Boolean).join('\n');
    console.log('[FFmpeg] done', { returnCode: result.returnCode, outputChars: combined.length });
    return { returnCode: result.returnCode, output: combined || result.output };
  } finally {
    if (activeSessionId === sessionId) {
      activeSessionId = null;
    }
    progressSub?.remove();
    logSub?.remove();
  }
}

export function cancelFfmpeg(): void {
  const mod = getNativeModule();
  if (!mod || !activeSessionId) return;
  try {
    mod.cancel(activeSessionId);
  } catch {
    // ignore
  }
}

export async function isFfmpegAvailable(): Promise<boolean> {
  return getNativeModule() != null;
}

export async function getFfmpegVersion(): Promise<string> {
  const mod = getNativeModule();
  if (!mod) {
    return 'Unavailable (requires dev build)';
  }
  try {
    return mod.getVersion();
  } catch {
    return 'Unavailable (requires dev build)';
  }
}

export async function probeMediaMetadata(path: string): Promise<MediaProbeMetadata> {
  const localPath = path.replace(/^file:\/\//, '');

  // Prefer native MediaMetadataRetriever / AVAsset — FFmpeg log bridging often
  // returns empty output even when the probe exits successfully.
  const nativeEditor = getNativeEditorModule();
  if (nativeEditor && typeof nativeEditor.probeMedia === 'function') {
    const metadata = await nativeEditor.probeMedia(localPath);
    return {
      width: Number(metadata.width),
      height: Number(metadata.height),
      duration: Number(metadata.duration),
      videoCodec: String(metadata.videoCodec).toLowerCase(),
      audioCodec: metadata.audioCodec ? String(metadata.audioCodec).toLowerCase() : null,
    };
  }

  const result = await executeNative(['-i', localPath, '-f', 'null', '-']);
  const output = result.output ?? '';
  const video = output.match(/Video:\s*([^,\s]+)[^\n]*?(\d{2,5})x(\d{2,5})/i);
  const audio = output.match(/Audio:\s*([^,\s]+)/i);
  const duration = output.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i);
  if (!video || !duration) throw new Error('Could not validate exported video metadata');
  return {
    videoCodec: video[1].toLowerCase(),
    width: Number(video[2]),
    height: Number(video[3]),
    duration: Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]),
    audioCodec: audio?.[1].toLowerCase() ?? null,
  };
}

export async function runFfmpeg(
  args: string[],
  options?: { onProgress?: (ratio: number) => void },
): Promise<void> {
  const preferred = preferredMobileVideoCodec(Platform.OS);
  const adapted = adaptArgsForMobileEncoders(args, preferred);
  try {
    await runFfmpegRaw(adapted, options);
  } catch (error) {
    if (!adapted.some(isHardwareMobileCodec)) throw error;
    console.warn(`[FFmpeg] ${preferred} failed, falling back to software H.264`, error);
    await runFfmpegRaw(args, options);
  }
}

async function runFfmpegRaw(
  args: string[],
  options?: { onProgress?: (ratio: number) => void },
): Promise<void> {
  const result = await executeNative(args, {
    onProgress: (progress) => {
      if (progress.totalDuration && progress.totalDuration > 0) {
        options?.onProgress?.(progress.time / progress.totalDuration);
      }
    },
  });

  if (result.returnCode !== 0) {
    const tail = result.output?.trim().slice(-1200);
    const detail = tail ? `\n${tail}` : '';
    throw new Error(`FFmpeg exited with code ${result.returnCode}${detail}`);
  }
}

export { adaptArgsForMobileEncoders };

export interface SegmentRange {
  startTime: number;
  endTime: number;
}

function normalizeFfmpegPath(path: string): string {
  return path.replace(/^file:\/\//, '');
}

/** Keep http(s) URLs intact so native FFmpeg can open HLS/DASH. */
function ffmpegInputPath(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return normalizeFfmpegPath(path);
}

export interface StreamDownloadOptions {
  headers?: Record<string, string>;
  userAgent?: string;
  segment?: SegmentRange;
  onProgress?: (ratio: number) => void;
}

function ffmpegHeaderBlob(headers?: Record<string, string>): string {
  if (!headers) return '';
  const lines = Object.entries(headers)
    .filter(([key]) => key.toLowerCase() !== 'user-agent')
    .map(([key, value]) => `${key}: ${value}`);
  return lines.length ? `${lines.join('\r\n')}\r\n` : '';
}

/**
 * Desktop Kick path: FFmpeg opens the HLS/DASH URL, copies video, encodes AAC, faststart.
 * Falls back to stream-copy + aac_adtstoasc if AAC encode is unavailable.
 */
export async function downloadStreamToMp4(
  streamUrl: string,
  outputPath: string,
  options?: StreamDownloadOptions,
): Promise<void> {
  const input = ffmpegInputPath(streamUrl);
  const out = normalizeFfmpegPath(outputPath);
  const headerBlob = ffmpegHeaderBlob(options?.headers);
  const userAgent =
    options?.userAgent ??
    options?.headers?.['User-Agent'] ??
    options?.headers?.['user-agent'];
  const isHls =
    /\.m3u8/i.test(streamUrl) ||
    streamUrl.includes('/playlist') ||
    streamUrl.includes('/manifest');

  const buildArgs = (audio: 'aac' | 'copy') => {
    const args: string[] = [];
    if (isHls) {
      args.push(
        '-reconnect',
        '1',
        '-reconnect_streamed',
        '1',
        '-reconnect_delay_max',
        '5',
        '-http_persistent',
        '1',
        '-multiple_requests',
        '1',
      );
    }
    if (headerBlob) {
      args.push('-headers', headerBlob);
    }
    if (userAgent) {
      args.push('-user_agent', userAgent);
    }
    if (options?.segment) {
      args.push('-ss', String(options.segment.startTime));
    }
    args.push('-i', input, '-c:v', 'copy');
    if (audio === 'aac') {
      args.push('-c:a', 'aac', '-b:a', '128k');
    } else {
      args.push('-c:a', 'copy', '-bsf:a', 'aac_adtstoasc');
    }
    if (options?.segment) {
      args.push('-t', String(Math.max(0, options.segment.endTime - options.segment.startTime)));
    }
    args.push('-avoid_negative_ts', 'make_zero', '-movflags', '+faststart', '-y', out);
    return args;
  };

  try {
    await runFfmpeg(buildArgs('aac'), { onProgress: options?.onProgress });
  } catch (error) {
    console.warn('[FFmpeg] AAC ingest failed, falling back to copy + aac_adtstoasc', error);
    await runFfmpeg(buildArgs('copy'), { onProgress: options?.onProgress });
  }
}

/**
 * Remux via stream-copy into MP4.
 * Applies aac_adtstoasc so MPEG-TS AAC (ADTS) can land in MP4/M4A.
 */
export async function remuxToMp4(
  inputPath: string,
  outputPath: string,
  onProgress?: (ratio: number) => void,
  segment?: SegmentRange,
): Promise<void> {
  const input = normalizeFfmpegPath(inputPath);
  const out = normalizeFfmpegPath(outputPath);

  const buildArgs = (withBsf: boolean) => {
    const args: string[] = ['-fflags', '+genpts'];
    if (segment) {
      args.push('-ss', String(segment.startTime));
    }
    args.push('-i', input, '-c:v', 'copy', '-c:a', 'copy');
    if (withBsf) {
      args.push('-bsf:a', 'aac_adtstoasc');
    }
    if (segment) {
      args.push('-t', String(Math.max(0, segment.endTime - segment.startTime)));
    }
    args.push('-avoid_negative_ts', 'make_zero', '-movflags', '+faststart', '-y', out);
    return args;
  };

  try {
    await runFfmpeg(buildArgs(true), { onProgress });
  } catch {
    await runFfmpeg(buildArgs(false), { onProgress });
  }
}

export async function extractThumbnail(
  inputPath: string,
  outputPath: string,
  timestampSeconds = 1,
): Promise<void> {
  const input = normalizeFfmpegPath(inputPath);
  const out = normalizeFfmpegPath(outputPath);
  const seek = String(Math.max(0, timestampSeconds));
  try {
    await runFfmpeg(['-ss', seek, '-i', input, '-frames:v', '1', '-q:v', '2', '-y', out]);
  } catch (error) {
    console.warn('[FFmpeg] thumbnail extract failed', error);
  }
}

/**
 * Extract audio-only for Whisper (desktop-equivalent size path).
 * Prefers AAC stream-copy + aac_adtstoasc → .m4a (works for Kick HLS/.ts).
 */
export async function extractAudioForTranscription(
  inputPath: string,
  outputPath: string,
  onProgress?: (ratio: number) => void,
  startSeconds?: number,
  endSeconds?: number,
): Promise<string> {
  const input = normalizeFfmpegPath(inputPath);
  const m4aOut = normalizeFfmpegPath(outputPath).replace(/\.mp3$/i, '.m4a');

  const timed = (extra: string[]) => {
    const args: string[] = [];
    const start = startSeconds ?? 0;
    if (start > 0) {
      args.push('-ss', String(start));
    }
    args.push('-i', input);
    if (endSeconds != null) {
      args.push('-t', String(Math.max(0, endSeconds - start)));
    }
    return [...args, '-vn', ...extra, '-y', m4aOut];
  };

  try {
    await runFfmpeg(timed(['-c:a', 'copy', '-bsf:a', 'aac_adtstoasc']), { onProgress });
    return m4aOut;
  } catch (withBsf) {
    console.warn('[FFmpeg] audio extract with BSF failed, retrying copy-only', withBsf);
    await runFfmpeg(timed(['-c:a', 'copy']), { onProgress });
    return m4aOut;
  }
}

/** @deprecated Prefer extractAudioForTranscription (m4a). Kept for call-site compatibility. */
export async function extractAudioMp3(
  inputPath: string,
  outputPath: string,
  startSeconds?: number,
  endSeconds?: number,
): Promise<string> {
  return extractAudioForTranscription(inputPath, outputPath, undefined, startSeconds, endSeconds);
}

export async function probeDuration(inputPath: string): Promise<number | null> {
  try {
    await runFfmpeg(['-i', inputPath]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const match = message.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
    if (!match) return null;
    const hours = Number.parseInt(match[1], 10);
    const minutes = Number.parseInt(match[2], 10);
    const seconds = Number.parseFloat(match[3]);
    return hours * 3600 + minutes * 60 + seconds;
  }
  return null;
}
