import { Platform } from 'react-native';
import { EventEmitter, requireNativeModule } from 'expo-modules-core';

type FFmpegProgress = {
  time: number;
  totalDuration?: number;
  sessionId?: string;
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

let nativeModule: ExpoFFmpegNative | null | undefined;
let progressEmitter: {
  addListener: (
    eventName: 'onProgress',
    listener: (event: FFmpegProgress) => void,
  ) => { remove: () => void };
} | null = null;

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
    progressEmitter = new EventEmitter(mod as never) as typeof progressEmitter;
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
  let subscription: { remove: () => void } | undefined;

  if (options?.onProgress) {
    subscription = progressEmitter.addListener('onProgress', (event: FFmpegProgress) => {
      if (event.sessionId === sessionId) {
        options.onProgress?.(event);
      }
    });
  }

  try {
    return await mod.run(sessionId, args, { logLevel: 32 });
  } finally {
    subscription?.remove();
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

export async function runFfmpeg(
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

export interface SegmentRange {
  startTime: number;
  endTime: number;
}

function normalizeFfmpegPath(path: string): string {
  return path.replace(/^file:\/\//, '');
}

function buildSegmentInputArgs(inputUrl: string, segment?: SegmentRange): string[] {
  const args: string[] = [];
  if (segment && segment.startTime > 0) {
    args.push('-ss', String(segment.startTime));
  }
  args.push('-i', inputUrl);
  if (segment) {
    const duration = segment.endTime - segment.startTime;
    if (duration > 0) {
      args.push('-t', String(duration));
    }
  }
  return args;
}

function buildFfmpegInputArgs(inputUrl: string, segment?: SegmentRange): string[] {
  return buildSegmentInputArgs(inputUrl, segment);
}

export async function remuxToMp4(
  inputPath: string,
  outputPath: string,
  onProgress?: (ratio: number) => void,
  segment?: SegmentRange,
): Promise<void> {
  const inputArgs = buildFfmpegInputArgs(normalizeFfmpegPath(inputPath), segment);
  const out = normalizeFfmpegPath(outputPath);
  try {
    await runFfmpeg([...inputArgs, '-c', 'copy', '-movflags', '+faststart', '-y', out], {
      onProgress,
    });
  } catch {
    await runFfmpeg(
      [
        ...inputArgs,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-c:a',
        'aac',
        '-movflags',
        '+faststart',
        '-y',
        out,
      ],
      { onProgress },
    );
  }
}

export async function extractThumbnail(inputPath: string, outputPath: string): Promise<void> {
  const input = normalizeFfmpegPath(inputPath);
  const out = normalizeFfmpegPath(outputPath);
  await runFfmpeg(['-ss', '1', '-i', input, '-frames:v', '1', '-q:v', '2', '-y', out]);
}

export async function extractAudioMp3(
  inputPath: string,
  outputPath: string,
  startSeconds?: number,
  endSeconds?: number,
): Promise<string> {
  const input = normalizeFfmpegPath(inputPath);
  const mp3Out = normalizeFfmpegPath(outputPath);
  const m4aOut = mp3Out.replace(/\.mp3$/i, '.m4a');

  const buildArgs = (outPath: string, audioCodec: string[], extra: string[] = []) => {
    const args: string[] = [];
    if (startSeconds != null && startSeconds > 0) {
      args.push('-ss', String(startSeconds));
    }
    args.push('-i', input);
    if (endSeconds != null && startSeconds != null) {
      args.push('-t', String(endSeconds - startSeconds));
    }
    return [...args, '-vn', ...audioCodec, ...extra, '-y', outPath];
  };

  try {
    await runFfmpeg(buildArgs(mp3Out, ['-acodec', 'libmp3lame', '-q:a', '4']));
    return mp3Out;
  } catch {
    await runFfmpeg(buildArgs(m4aOut, ['-acodec', 'aac', '-b:a', '128k']));
    return m4aOut;
  }
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
