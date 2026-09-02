import type {
  ClipSegment,
  ClipTextBoxState,
  ManualFramingConfig,
  SubtitleSettings,
  TargetAspectRatio,
  WordInfo,
} from '@clippster/shared-types';
import { TARGET_DIMENSIONS } from '@clippster/shared-types';

import { buildFramingFilterGraph } from './buildFramingFilter';
import { buildSegmentConcatArgs } from './buildSegmentConcat';
import { buildSubtitleAssContent } from './buildSubtitleAss';
import { buildTextOverlayFilterArgs, mergeTextBoxForRatio } from './buildTextOverlay';

export interface ClipExportInput {
  videoPath: string;
  outputPath: string;
  segments: ClipSegment[];
  targetRatio: TargetAspectRatio;
  framingConfig?: ManualFramingConfig | null;
  subtitleSettings?: SubtitleSettings | null;
  subtitleWords?: WordInfo[];
  textBox?: ClipTextBoxState | null;
  assPath?: string;
  textOverlayPngPath?: string;
  remuxOnly?: boolean;
}

export interface ClipExportPlan {
  ffmpegArgs: string[];
  assContent?: string;
  totalDuration: number;
  width: number;
  height: number;
}

export function buildClipExportPlan(input: ClipExportInput): ClipExportPlan {
  const dims = TARGET_DIMENSIONS[input.targetRatio];
  const concat = buildSegmentConcatArgs({
    videoPath: input.videoPath,
    segments: input.segments,
    outputPath: input.outputPath,
    concatListPath: '',
  });

  if (input.remuxOnly) {
    return {
      ffmpegArgs: concat.ffmpegArgs,
      totalDuration: concat.totalDuration,
      width: dims.width,
      height: dims.height,
    };
  }

  const framing = buildFramingFilterGraph({
    framingConfig: input.framingConfig ?? null,
    targetRatio: input.targetRatio,
  });

  const filterParts: string[] = [];
  let videoLabel = '0:v';

  if (framing) {
    const framingFilter = framing.filterComplex.replace(/\[0:v\]/g, `[${videoLabel}]`);
    filterParts.push(framingFilter);
    videoLabel = framing.outputLabel;
  } else {
    filterParts.push(
      `[${videoLabel}]scale=${dims.width}:${dims.height}:force_original_aspect_ratio=decrease,pad=${dims.width}:${dims.height}:(ow-iw)/2:(oh-ih)/2[framed]`,
    );
    videoLabel = 'framed';
  }

  let assContent: string | undefined;
  if (input.subtitleSettings?.enabled && input.subtitleWords && input.subtitleWords.length > 0) {
    assContent = buildSubtitleAssContent({
      settings: input.subtitleSettings,
      words: input.subtitleWords,
      clipDuration: concat.totalDuration,
      targetRatio: input.targetRatio,
      outputPath: input.assPath ?? '',
    });
    if (input.assPath) {
      filterParts.push(`[${videoLabel}]ass='${input.assPath.replace(/'/g, "'\\''")}'[subbed]`);
      videoLabel = 'subbed';
    }
  }

  const sorted = [...input.segments].sort((a, b) => a.start_time - b.start_time);

  const effectiveTextBox =
    input.textBox?.enabled && input.textBox.text
      ? mergeTextBoxForRatio(input.textBox, input.targetRatio)
      : null;

  if (effectiveTextBox && input.textOverlayPngPath) {
    const textInputIndex = sorted.length;
    filterParts.push(
      buildTextOverlayFilterArgs(
        videoLabel,
        textInputIndex,
        effectiveTextBox,
        dims.width,
        dims.height,
        'outv',
      ),
    );
    videoLabel = 'outv';
  }

  const inputs: string[] = [];
  sorted.forEach((seg) => {
    inputs.push('-ss', String(seg.start_time), '-t', String(seg.end_time - seg.start_time), '-i', input.videoPath);
  });

  if (effectiveTextBox && input.textOverlayPngPath) {
    inputs.push('-i', input.textOverlayPngPath);
  }

  const filterComplex = filterParts.join(';');

  const ffmpegArgs = [
    ...inputs,
    '-filter_complex',
    filterComplex,
    '-map',
    `[${videoLabel}]`,
    '-map',
    '0:a?',
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
  ];

  return {
    ffmpegArgs,
    assContent,
    totalDuration: concat.totalDuration,
    width: dims.width,
    height: dims.height,
  };
}
