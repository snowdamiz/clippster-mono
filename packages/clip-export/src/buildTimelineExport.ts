import type { ManualFramingConfig, SubtitleSettings, TargetAspectRatio, WordInfo } from '@clippster/shared-types';
import { TARGET_DIMENSIONS } from '@clippster/shared-types';

import { buildSubtitleAssContent } from './buildSubtitleAss';
import { clipEffectVideoChain, type ClipEffect } from './buildClipEffects';
import { buildFramingFilterGraph } from './buildFramingFilter';

export const TIMELINE_TRANSITION_SECONDS = 0.5;
export type TimelineExportTransition = 'none' | 'fade' | 'dissolve' | 'wipe';

export interface TimelineExportVideo {
  path: string;
  sourceStart: number;
  sourceEnd: number;
  speed: number;
  muted: boolean;
  volume?: number;
  transitionIn?: TimelineExportTransition;
  transitionDuration?: number;
  effect?: ClipEffect | null;
  framingConfig?: ManualFramingConfig | null;
  rotationDeg?: number;
}

export interface TimelineExportImage {
  path: string;
  timelineStart: number;
  duration: number;
  x: number;
  y: number;
  widthPct: number;
  sourceStart?: number;
  sourceEnd?: number;
  speed?: number;
  opacity?: number;
  rotationDeg?: number;
  crop?: { x: number; y: number; width: number; height: number };
}

export interface TimelineExportAudio {
  path: string;
  sourceStart: number;
  sourceEnd: number;
  timelineStart: number;
  volume: number;
  speed?: number;
  fadeIn?: number;
  fadeOut?: number;
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
  framingConfig?: ManualFramingConfig | null;
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
  return Math.min(
    incoming.transitionDuration ?? TIMELINE_TRANSITION_SECONDS,
    videoDuration(previous) / 2,
    videoDuration(incoming) / 2,
  );
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
  targetRatio?: TargetAspectRatio;
  framingConfig?: ManualFramingConfig | null;
}): string[] {
  const duration = videoDuration(input.clip);
  const source = normalizeExportPath(input.clip.path);
  const speed = input.clip.speed || 1;
  const framing =
    input.framingConfig && input.targetRatio
      ? buildFramingFilterGraph({
          framingConfig: input.framingConfig,
          targetRatio: input.targetRatio,
        })
      : null;
  const baseVideoFilter = framing
    ? `${framing.filterComplex};[${framing.outputLabel}]fps=30,setpts=PTS-STARTPTS[scaled]`
    : containScale(input.width, input.height, '0:v', 'scaled');
  const rotation =
    input.clip.rotationDeg && input.clip.rotationDeg % 360 !== 0
      ? `[scaled]rotate=${((input.clip.rotationDeg * Math.PI) / 180).toFixed(6)}:ow=iw:oh=ih:c=black[rotated]`
      : null;
  const videoFilter = [
    baseVideoFilter,
    rotation,
    clipEffectVideoChain(input.clip.effect, speed, rotation ? 'rotated' : 'scaled'),
  ].filter(Boolean).join(';');

  const audioFilter = input.silentAudio
    ? '[1:a]aformat=sample_fmts=fltp:channel_layouts=stereo:sample_rates=44100[a]'
    : `[0:a]aformat=sample_fmts=fltp:channel_layouts=stereo:sample_rates=44100,asetpts=PTS-STARTPTS,volume=${input.clip.volume ?? 1},atempo=${speed}[a]`;

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
        targetRatio: input.targetRatio,
        framingConfig: clip.framingConfig ?? input.framingConfig,
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
    if (image.sourceStart != null) extraInputs.push('-ss', String(image.sourceStart));
    if (image.sourceEnd != null && image.sourceStart != null) {
      extraInputs.push('-t', String(image.sourceEnd - image.sourceStart));
    }
    extraInputs.push('-i', normalizeExportPath(image.path));
    const width = Math.max(8, Math.round(dims.width * image.widthPct));
    const x = Math.round(image.x * dims.width);
    const y = Math.round(image.y * dims.height);
    const nextLabel = `ov${inputIndex}`;
    const imageFilters: string[] = [];
    if (image.crop) {
      imageFilters.push(
        `crop=iw*${image.crop.width}:ih*${image.crop.height}:iw*${image.crop.x}:ih*${image.crop.y}`,
      );
    }
    imageFilters.push(`scale=${width}:-2`);
    if (image.speed && image.speed !== 1) imageFilters.push(`setpts=PTS/${image.speed}`);
    if (image.rotationDeg) {
      imageFilters.push(`rotate=${image.rotationDeg}*PI/180:c=none:ow=rotw(iw):oh=roth(ih)`);
    }
    if (image.opacity != null && image.opacity < 1) {
      imageFilters.push('format=rgba', `colorchannelmixer=aa=${image.opacity}`);
    }
    filterParts.push(
      `[${inputIndex}:v]${imageFilters.join(',')}[img${inputIndex}]`,
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

  for (const audio of input.audio) {
    extraInputs.push(
      '-ss',
      String(audio.sourceStart),
      '-t',
      String(audio.sourceEnd - audio.sourceStart),
      '-i',
      normalizeExportPath(audio.path),
    );
    const delay = Math.max(0, Math.round(audio.timelineStart * 1000));
    const sourceLabel = `aud${inputIndex}`;
    const mixedLabel = `amix${inputIndex}`;
    const speed = audio.speed ?? 1;
    const duration = (audio.sourceEnd - audio.sourceStart) / speed;
    const filters = [`volume=${audio.volume}`];
    if (speed !== 1) filters.push(`atempo=${speed}`);
    if (audio.fadeIn && audio.fadeIn > 0) filters.push(`afade=t=in:st=0:d=${audio.fadeIn}`);
    if (audio.fadeOut && audio.fadeOut > 0) {
      filters.push(`afade=t=out:st=${Math.max(0, duration - audio.fadeOut)}:d=${audio.fadeOut}`);
    }
    filters.push(`adelay=${delay}:all=1`);
    filterParts.push(
      `[${inputIndex}:a]${filters.join(',')}[${sourceLabel}]`,
      `[${audioLabel}][${sourceLabel}]amix=inputs=2:duration=first:dropout_transition=0[${mixedLabel}]`,
    );
    audioLabel = mixedLabel;
    inputIndex += 1;
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
