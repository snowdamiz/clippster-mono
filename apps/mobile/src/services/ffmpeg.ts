import { Platform } from 'react-native';

import type { FFmpegProgress } from 'ffmpeg-expo';

type FfmpegModule = {
  execute?: (
    args: string[],
    options?: { onProgress?: (progress: FFmpegProgress) => void },
  ) => Promise<{ duration?: number }>;
  getVersion?: () => string | { version?: string };
};

let ffmpegModule: FfmpegModule | null = null;

async function loadFfmpegModule(): Promise<FfmpegModule | null> {
  if (ffmpegModule) return ffmpegModule;
  if (Platform.OS === 'web') return null;
  try {
    ffmpegModule = await import('ffmpeg-expo');
    return ffmpegModule;
  } catch {
    return null;
  }
}

export async function getFfmpegVersion(): Promise<string> {
  const mod = await loadFfmpegModule();
  if (!mod?.getVersion) {
    return 'Unavailable (requires dev build)';
  }
  const versionInfo = mod.getVersion();
  if (typeof versionInfo === 'string') {
    return versionInfo;
  }
  return versionInfo?.version ?? 'Unknown';
}

export async function runFfmpeg(
  args: string[],
  options?: { onProgress?: (ratio: number) => void },
): Promise<void> {
  const mod = await loadFfmpegModule();
  if (!mod?.execute) {
    throw new Error('FFmpeg is not available in this build');
  }

  await mod.execute(args, {
    onProgress: (progress) => {
      if (progress.totalDuration && progress.totalDuration > 0) {
        options?.onProgress?.(progress.time / progress.totalDuration);
      }
    },
  });
}

export async function remuxToMp4(
  inputPath: string,
  outputPath: string,
  onProgress?: (ratio: number) => void,
): Promise<void> {
  try {
    await runFfmpeg(['-i', inputPath, '-c', 'copy', '-movflags', '+faststart', '-y', outputPath], {
      onProgress,
    });
  } catch {
    await runFfmpeg(
      [
        '-i',
        inputPath,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-c:a',
        'aac',
        '-movflags',
        '+faststart',
        '-y',
        outputPath,
      ],
      { onProgress },
    );
  }
}

export async function extractThumbnail(inputPath: string, outputPath: string): Promise<void> {
  await runFfmpeg(['-ss', '1', '-i', inputPath, '-frames:v', '1', '-q:v', '2', '-y', outputPath]);
}

export async function extractAudioMp3(
  inputPath: string,
  outputPath: string,
  startSeconds?: number,
  endSeconds?: number,
): Promise<void> {
  const args = ['-i', inputPath];
  if (startSeconds != null) {
    args.push('-ss', String(startSeconds));
  }
  if (endSeconds != null && startSeconds != null) {
    args.push('-t', String(endSeconds - startSeconds));
  }
  args.push('-vn', '-acodec', 'libmp3lame', '-q:a', '4', '-y', outputPath);
  await runFfmpeg(args);
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
