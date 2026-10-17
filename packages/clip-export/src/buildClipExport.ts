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
import { buildSubtitleAssContent, buildSubtitleBurnInArgs } from './buildSubtitleAss';
import { buildTextOverlayFilterArgs, mergeTextBoxForRatio } from './buildTextOverlay';

export interface ClipExportInput {
  videoPath: string;
  outputPath: string;
  segments: ClipSegment[];
  targetRatio: TargetAspectRatio;
  framingConfig?: ManualFramingConfig | null;
  subtitleSettings?: SubtitleSettings | null;
  subtitleWords?: WordInfo[];
  subtitleRasterPath?: string;
  layoutRasterPath?: string;
  textBox?: ClipTextBoxState | null;
  assPath?: string;
  textOverlayPngPath?: string;
  textRasterPath?: string;
  remuxOnly?: boolean;
  /** False for silent source videos; defaults to true for existing callers. */
  hasAudio?: boolean;
  fit?: 'cover' | 'contain';
  mediaAssets?: Array<{ id: string; path: string; type: 'image' | 'video' }>;
  quality?: 'low' | 'medium' | 'high';
  frameRate?: 30 | 60;
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
    fit: input.fit,
    mediaSources: Object.fromEntries((input.mediaAssets || []).map((asset, index) => [asset.id, input.segments.length + (input.textOverlayPngPath ? 1 : 0) + index])),
  });

  const ordered = [...input.segments];
  if (
    ordered.some(
      (segment) =>
        !Number.isFinite(segment.start_time) ||
        !Number.isFinite(segment.end_time) ||
        segment.start_time < 0 ||
        segment.end_time <= segment.start_time,
    )
  ) {
    throw new Error('Export segments must have valid positive time ranges');
  }
  const hasAudio = input.hasAudio !== false;
  const filterParts: string[] = [];
  let videoLabel = '0:v';
  let audioLabel = hasAudio ? '0:a?' : null;
  if (ordered.length > 1) {
    ordered.forEach((_, index) => {
      filterParts.push(`[${index}:v]setpts=PTS-STARTPTS[v${index}]`);
      if (hasAudio) filterParts.push(`[${index}:a]asetpts=PTS-STARTPTS[a${index}]`);
    });
    const streams = ordered
      .map((_, index) => `[v${index}]${hasAudio ? `[a${index}]` : ''}`)
      .join('');
    filterParts.push(
      `${streams}concat=n=${ordered.length}:v=1:a=${hasAudio ? 1 : 0}[joinedv]${hasAudio ? '[joineda]' : ''}`,
    );
    videoLabel = 'joinedv';
    audioLabel = hasAudio ? '[joineda]' : null;
  }

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
  if (!input.subtitleRasterPath && input.subtitleSettings?.enabled && input.subtitleWords && input.subtitleWords.length > 0) {
    assContent = buildSubtitleAssContent({
      settings: input.subtitleSettings,
      words: input.subtitleWords,
      clipDuration: concat.totalDuration,
      targetRatio: input.targetRatio,
      outputPath: input.assPath ?? '',
    });
    if (input.assPath) {
      filterParts.push(buildSubtitleBurnInArgs(videoLabel, input.assPath));
      videoLabel = 'subbed';
    }
  }

  const effectiveTextBox =
    input.textBox?.enabled && input.textBox.text
      ? mergeTextBoxForRatio(input.textBox, input.targetRatio)
      : null;

  if (effectiveTextBox && input.textOverlayPngPath) {
    const textInputIndex = ordered.length;
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
  ordered.forEach((seg) => {
    inputs.push(
      '-ss',
      String(seg.start_time),
      '-t',
      String(seg.end_time - seg.start_time),
      '-i',
      input.videoPath,
    );
  });

  if (effectiveTextBox && input.textOverlayPngPath) {
    inputs.push('-i', input.textOverlayPngPath);
  }
  for (const asset of input.mediaAssets || []) inputs.push(...(asset.type === 'image' ? ['-loop', '1'] : ['-stream_loop', '-1']), '-i', asset.path);
  if (input.layoutRasterPath) {
    const index = ordered.length + (effectiveTextBox && input.textOverlayPngPath ? 1 : 0) + (input.mediaAssets?.length || 0);
    inputs.push('-loop', '1', '-i', input.layoutRasterPath);
    filterParts.push(`[${videoLabel}][${index}:v]overlay=0:0:shortest=1[layout_raster]`);
    videoLabel = 'layout_raster';
  }
  if (input.subtitleRasterPath) {
    const index = ordered.length + (effectiveTextBox && input.textOverlayPngPath ? 1 : 0) + (input.mediaAssets?.length || 0) + (input.layoutRasterPath ? 1 : 0);
    inputs.push('-i', input.subtitleRasterPath);
    filterParts.push(`[${videoLabel}][${index}:v]overlay=0:0:eof_action=pass[subtitles_raster]`);
    videoLabel = 'subtitles_raster';
  }
  if (input.textRasterPath && effectiveTextBox) {
    const index = ordered.length + (input.textOverlayPngPath ? 1 : 0) + (input.mediaAssets?.length || 0) + (input.subtitleRasterPath ? 1 : 0) + (input.layoutRasterPath ? 1 : 0);
    inputs.push('-loop', '1', '-i', input.textRasterPath);
    filterParts.push(`[${videoLabel}][${index}:v]overlay=0:0:shortest=1:enable='gte(t,${effectiveTextBox.startTime})*lt(t,${effectiveTextBox.endTime})'[text_raster]`);
    videoLabel = 'text_raster';
  }

  const filterComplex = filterParts.join(';');

  const ffmpegArgs = [
    ...inputs,
    '-filter_complex',
    filterComplex,
    '-map',
    `[${videoLabel}]`,
    ...(audioLabel ? ['-map', audioLabel] : []),
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    ...(input.quality ? ['-crf', String({ low: 28, medium: 23, high: 18 }[input.quality])] : []),
    ...(input.frameRate ? ['-r', String(input.frameRate)] : []),
    '-c:a',
    'aac',
    '-movflags',
    '+faststart',
    '-t',
    String(concat.totalDuration),
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
