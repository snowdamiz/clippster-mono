import type { SubtitleSettings, TargetAspectRatio, WordInfo } from '@clippster/shared-types';
import { TARGET_DIMENSIONS } from '@clippster/shared-types';

import { buildSubtitleAssContent } from './buildSubtitleAss';
import { clipEffectVideoChain, type ClipEffect } from './buildClipEffects';

export const TIMELINE_TRANSITION_SECONDS = 0.5;
export type TimelineExportTransition = 'none' | 'fade' | 'dissolve' | 'wipe';

export interface TimelineExportVideo {
  path: string;
  sourceStart: number;
  sourceEnd: number;
  speed: number;
  muted: boolean;
  transitionIn?: TimelineExportTransition;
  effect?: ClipEffect | null;
}

export interface TimelineExportImage {
  path: string;
  timelineStart: number;
  duration: number;
  x: number;
  y: number;
  widthPct: number;
}

export interface TimelineExportAudio {
  path: string;
  sourceStart: number;
  sourceEnd: number;
  timelineStart: number;
  volume: number;
}

export interface TimelineExportInput {
  videos: TimelineExportVideo[];
  images: TimelineExportImage[];
  audio: TimelineExportAudio[];
  outputPath: string;
  workDir: string;
  targetRatio: TargetAspectRatio;
  subtitleSettings?: SubtitleSettings | null;
  subtitleWords?: WordInfo[];
  assPath?: string;
}

export interface TimelineExportStage {
  args: string[];
  outputPath: string;
  listContent?: string;
  listPath?: string;
}

export interface TimelineExportPlan {
  clipRenders: TimelineExportStage[];
  concat: TimelineExportStage;
  compose: TimelineExportStage;
  assContent?: string;
  totalDuration: number;
  width: number;
  height: number;
}

export function normalizeExportPath(path: string): string {
  return path.replace(/^file:\/\//, '');
}

function videoDuration(clip: TimelineExportVideo): number {
  return Math.max(0, (clip.sourceEnd - clip.sourceStart) / Math.max(clip.speed, 0.01));
}

export function timelineClipOverlap(previous: TimelineExportVideo, incoming: TimelineExportVideo): number {
  if (!incoming.transitionIn || incoming.transitionIn === 'none') return 0;
  return Math.min(TIMELINE_TRANSITION_SECONDS, videoDuration(previous) / 2, videoDuration(incoming) / 2);
}

export function assembledTimelineDuration(videos: TimelineExportVideo[]): number {
  if (videos.length === 0) return 0;
  let total = videoDuration(videos[0]);
  for (let i = 1; i < videos.length; i++) {
    total += videoDuration(videos[i]) - timelineClipOverlap(videos[i - 1], videos[i]);
  }
  return total;
}

function xfadeName(kind: TimelineExportTransition): string {
  if (kind === 'fade') return 'fadeblack';
  if (kind === 'wipe') return 'wipeleft';
  return 'fade';
}

function escapeConcatPath(path: string): string {
  return path.replace(/'/g, "'\\''");
}

function containScale(width: number, height: number, labelIn: string, labelOut: string): string {
  return `[${labelIn}]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,setpts=PTS-STARTPTS[${labelOut}]`;
}

export function buildTimelineClipArgs(input: {
  clip: TimelineExportVideo;
  outputPath: string;
  width: number;
  height: number;
  silentAudio: boolean;
}): string[] {
  const duration = videoDuration(input.clip);
  const source = normalizeExportPath(input.clip.path);
  const speed = input.clip.speed || 1;
  const videoFilter = [
    containScale(input.width, input.height, '0:v', 'scaled'),
    clipEffectVideoChain(input.clip.effect, speed),
  ].join(';');

  const audioFilter = input.silentAudio
    ? '[1:a]aformat=sample_fmts=fltp:channel_layouts=stereo:sample_rates=44100[a]'
    : `[0:a]aformat=sample_fmts=fltp:channel_layouts=stereo:sample_rates=44100,asetpts=PTS-STARTPTS,volume=1,atempo=${speed}[a]`;

  return [
    '-ss',
    String(input.clip.sourceStart),
    '-t',
    String(input.clip.sourceEnd - input.clip.sourceStart),
    '-i',
    source,
    '-f',
    'lavfi',
    '-t',
    String(duration),
    '-i',
    'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-filter_complex',
    `${videoFilter};${audioFilter}`,
    '-map',
    '[v]',
    '-map',
    '[a]',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-c:a',
    'aac',
    '-t',
    String(duration),
    '-movflags',
    '+faststart',
    '-y',
    normalizeExportPath(input.outputPath),
  ];
}

export function buildTimelineJoinStage(
  videos: TimelineExportVideo[],
  clipRenders: TimelineExportStage[],
  workDir: string,
): TimelineExportStage {
  const concatPath = `${workDir}tl_concat.mp4`;
  const hasTransition = videos.some((clip, index) => index > 0 && timelineClipOverlap(videos[index - 1], clip) > 0);

  if (!hasTransition) {
    const listPath = `${workDir}tl_concat.txt`;
    const listContent = clipRenders
      .map((stage) => `file '${escapeConcatPath(normalizeExportPath(stage.outputPath))}'`)
      .join('\n');
    return {
      args: [
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        normalizeExportPath(listPath),
        '-c',
        'copy',
        '-movflags',
        '+faststart',
        '-y',
        normalizeExportPath(concatPath),
      ],
      outputPath: concatPath,
      listContent,
      listPath,
    };
  }

  const filters: string[] = [];
  let videoLabel = '0:v';
  let audioLabel = '0:a';
  let assembled = videoDuration(videos[0]);

  for (let i = 1; i < videos.length; i++) {
    const overlap = timelineClipOverlap(videos[i - 1], videos[i]);
    const nextVideo = `jv${i}`;
    const nextAudio = `ja${i}`;
    if (overlap > 0) {
      filters.push(
        `[${videoLabel}][${i}:v]xfade=transition=${xfadeName(videos[i].transitionIn ?? 'dissolve')}:duration=${overlap}:offset=${Math.max(0, assembled - overlap)}[${nextVideo}]`,
        `[${audioLabel}][${i}:a]acrossfade=d=${overlap}[${nextAudio}]`,
      );
      assembled += videoDuration(videos[i]) - overlap;
    } else {
      filters.push(
        `[${videoLabel}][${i}:v]concat=n=2:v=1:a=0[${nextVideo}]`,
        `[${audioLabel}][${i}:a]concat=n=2:v=0:a=1[${nextAudio}]`,
      );
      assembled += videoDuration(videos[i]);
    }
    videoLabel = nextVideo;
    audioLabel = nextAudio;
  }

  return {
    args: [
      ...clipRenders.flatMap((stage) => ['-i', normalizeExportPath(stage.outputPath)]),
      '-filter_complex',
      filters.join(';'),
      '-map',
      `[${videoLabel}]`,
      '-map',
      `[${audioLabel}]`,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-c:a',
      'aac',
      '-t',
      String(assembled),
      '-movflags',
      '+faststart',
      '-y',
      normalizeExportPath(concatPath),
    ],
    outputPath: concatPath,
  };
}

export function buildTimelineExportPlan(input: TimelineExportInput): TimelineExportPlan {
  if (input.videos.length === 0) {
    throw new Error('Add at least one video clip before exporting');
  }

  const dims = TARGET_DIMENSIONS[input.targetRatio];
  const workDir = input.workDir.replace(/\/?$/, '/');
  const totalDuration = assembledTimelineDuration(input.videos);

  const clipRenders = input.videos.map((clip, index) => {
    const outputPath = `${workDir}tl_clip_${index}.mp4`;
    return {
      args: buildTimelineClipArgs({
        clip,
        outputPath,
        width: dims.width,
        height: dims.height,
        silentAudio: clip.muted,
      }),
      outputPath,
    };
  });

  const concat = buildTimelineJoinStage(input.videos, clipRenders, workDir);

  const filterParts: string[] = [];
  const extraInputs: string[] = [];
  let videoLabel = '0:v';
  let audioLabel = '0:a';
  let inputIndex = 1;

  for (const image of input.images) {
    extraInputs.push('-i', normalizeExportPath(image.path));
    const width = Math.max(8, Math.round(dims.width * image.widthPct));
    const x = Math.round(image.x * dims.width);
    const y = Math.round(image.y * dims.height);
    const nextLabel = `ov${inputIndex}`;
    filterParts.push(
      `[${inputIndex}:v]scale=${width}:-2[img${inputIndex}]`,
      `[${videoLabel}][img${inputIndex}]overlay=${x}:${y}:enable='between(t,${image.timelineStart},${image.timelineStart + image.duration})'[${nextLabel}]`,
    );
    videoLabel = nextLabel;
    inputIndex += 1;
  }

  let assContent: string | undefined;
  if (input.subtitleSettings?.enabled && input.subtitleWords && input.subtitleWords.length > 0 && input.assPath) {
    assContent = buildSubtitleAssContent({
      settings: input.subtitleSettings,
      words: input.subtitleWords,
      clipDuration: totalDuration,
      targetRatio: input.targetRatio,
      outputPath: input.assPath,
    });
    filterParts.push(`[${videoLabel}]ass='${normalizeExportPath(input.assPath).replace(/'/g, "'\\''")}'[subbed]`);
    videoLabel = 'subbed';
  }

  const music = input.audio[0];
  if (music) {
    extraInputs.push(
      '-ss',
      String(music.sourceStart),
      '-t',
      String(music.sourceEnd - music.sourceStart),
      '-i',
      normalizeExportPath(music.path),
    );
    const delay = Math.max(0, Math.round(music.timelineStart * 1000));
    filterParts.push(
      `[${inputIndex}:a]volume=${music.volume},adelay=${delay}:all=1[mus]`,
      `[${audioLabel}][mus]amix=inputs=2:duration=first:dropout_transition=0[amix]`,
    );
    audioLabel = 'amix';
  }

  const composeArgs = [
    '-i',
    normalizeExportPath(concat.outputPath),
    ...extraInputs,
    ...(filterParts.length > 0 ? ['-filter_complex', filterParts.join(';')] : []),
    '-map',
    filterParts.length > 0 ? `[${videoLabel}]` : '0:v',
    '-map',
    audioLabel === '0:a' ? '0:a' : `[${audioLabel}]`,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-c:a',
    'aac',
    '-t',
    String(totalDuration),
    '-movflags',
    '+faststart',
    '-y',
    normalizeExportPath(input.outputPath),
  ];

  return {
    clipRenders,
    concat,
    compose: { args: composeArgs, outputPath: input.outputPath },
    assContent,
    totalDuration,
    width: dims.width,
    height: dims.height,
  };
}
