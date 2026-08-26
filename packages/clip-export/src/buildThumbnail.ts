export interface ThumbnailInput {
  videoPath: string;
  outputPath: string;
  seekSeconds?: number;
}

export function buildThumbnailArgs(input: ThumbnailInput): string[] {
  const seek = input.seekSeconds ?? 1;
  return ['-ss', String(seek), '-i', input.videoPath, '-frames:v', '1', '-q:v', '2', '-y', input.outputPath];
}
