import type { ClipSegment } from '@clippster/shared-types';

export interface SegmentConcatInput {
  videoPath: string;
  segments: ClipSegment[];
  outputPath: string;
  concatListPath: string;
}

export interface SegmentConcatResult {
  ffmpegArgs: string[];
  concatListContent: string;
  totalDuration: number;
}

function escapeFfmpegPath(path: string): string {
  return path.replace(/'/g, "'\\''");
}

export function buildSegmentConcatArgs(input: SegmentConcatInput): SegmentConcatResult {
  const ordered = [...input.segments];
  if (ordered.length === 0) {
    throw new Error('At least one segment is required for export');
  }

  const totalDuration = ordered.reduce((sum, seg) => sum + (seg.end_time - seg.start_time), 0);

  if (ordered.length === 1) {
    const seg = ordered[0];
    return {
      ffmpegArgs: [
        '-ss',
        String(seg.start_time),
        '-i',
        input.videoPath,
        '-t',
        String(seg.end_time - seg.start_time),
        '-c',
        'copy',
        '-movflags',
        '+faststart',
        '-y',
        input.outputPath,
      ],
      concatListContent: '',
      totalDuration,
    };
  }

  const filterParts: string[] = [];
  const inputs: string[] = [];
  ordered.forEach((seg, index) => {
    inputs.push('-ss', String(seg.start_time), '-t', String(seg.end_time - seg.start_time), '-i', input.videoPath);
    filterParts.push(`[${index}:v:0][${index}:a:0]`);
  });

  const filterComplex = `${filterParts.join('')}concat=n=${ordered.length}:v=1:a=1[outv][outa]`;

  return {
    ffmpegArgs: [
      ...inputs,
      '-filter_complex',
      filterComplex,
      '-map',
      '[outv]',
      '-map',
      '[outa]',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-c:a',
      'aac',
      '-movflags',
      '+faststart',
      '-y',
      input.outputPath,
    ],
    concatListContent: ordered
      .map((seg) => `file '${escapeFfmpegPath(input.videoPath)}'\ninpoint ${seg.start_time}\noutpoint ${seg.end_time}`)
      .join('\n'),
    totalDuration,
  };
}
