import type {
  ManualFramingConfig,
  SubtitleSettings,
  TargetAspectRatio,
  WordInfo,
} from '@clippster/shared-types';
import { TARGET_DIMENSIONS } from '@clippster/shared-types';

import {
  buildOrgBrandingPlan,
  type OrgBrandingPlan,
  type WatermarkSettings,
} from './buildOrgBranding';
import {
  buildTimelineExportPlan,
  type TimelineExportAudio,
  type TimelineExportImage,
  type TimelineExportPlan,
  type TimelineExportVideo,
} from './buildTimelineExport';

export interface EditorCaptionDescriptor {
  required: boolean;
  settings: SubtitleSettings;
  words: WordInfo[];
  assPath?: string;
}

export interface EditorBrandingDescriptor {
  required: boolean;
  watermarkPath?: string;
  watermarkSettings?: WatermarkSettings;
  introPath?: string;
  outroPath?: string;
}

export interface EditorRenderDescriptor {
  videos: TimelineExportVideo[];
  overlays: TimelineExportImage[];
  textOverlays: TimelineExportImage[];
  audio: TimelineExportAudio[];
  framingConfig?: ManualFramingConfig | null;
  captions?: EditorCaptionDescriptor | null;
  branding?: EditorBrandingDescriptor | null;
}

export interface EditorRenderInput {
  descriptor: EditorRenderDescriptor;
  targetRatio: TargetAspectRatio;
  outputPath: string;
  workDir: string;
}

export interface EditorRenderPlan {
  timeline: TimelineExportPlan;
  branding?: OrgBrandingPlan & { outputPath: string };
  outputPath: string;
  width: number;
  height: number;
  totalDuration: number;
}

export function buildEditorRenderPlan(input: EditorRenderInput): EditorRenderPlan {
  validateDescriptor(input.descriptor);
  const dims = TARGET_DIMENSIONS[input.targetRatio];
  const workDir = input.workDir.replace(/\/?$/, '/');
  const hasBranding = hasBrandingAssets(input.descriptor.branding);
  const timelineOutput = hasBranding
    ? `${workDir}editor_content_${input.targetRatio.replace(':', 'x')}.mp4`
    : input.outputPath;
  const captions = input.descriptor.captions;
  const timeline = buildTimelineExportPlan({
    videos: input.descriptor.videos,
    images: [...input.descriptor.overlays, ...input.descriptor.textOverlays],
    audio: input.descriptor.audio,
    framingConfig: input.descriptor.framingConfig,
    subtitleSettings: captions?.settings,
    subtitleWords: captions?.words,
    assPath: captions?.assPath,
    outputPath: timelineOutput,
    workDir,
    targetRatio: input.targetRatio,
  });
  const branding = hasBranding
    ? {
        ...buildOrgBrandingPlan({
          videoPath: timelineOutput,
          outputPath: input.outputPath,
          width: dims.width,
          height: dims.height,
          watermarkPath: input.descriptor.branding?.watermarkPath,
          watermarkSettings: input.descriptor.branding?.watermarkSettings,
          introPath: input.descriptor.branding?.introPath,
          outroPath: input.descriptor.branding?.outroPath,
        }),
        outputPath: input.outputPath,
      }
    : undefined;
  return {
    timeline,
    branding,
    outputPath: input.outputPath,
    width: dims.width,
    height: dims.height,
    totalDuration: timeline.totalDuration,
  };
}

function hasBrandingAssets(
  branding: EditorBrandingDescriptor | null | undefined,
): boolean {
  return Boolean(
    branding?.watermarkPath ||
      branding?.introPath ||
      branding?.outroPath,
  );
}

function validateDescriptor(descriptor: EditorRenderDescriptor): void {
  if (descriptor.videos.length === 0) throw new Error('Editor export requires a video item');
  if (descriptor.videos.some((video) => !video.path || video.sourceEnd <= video.sourceStart)) {
    throw new Error('Editor export contains an invalid video source');
  }
  if (
    descriptor.captions?.required &&
    (!descriptor.captions.settings.enabled ||
      descriptor.captions.words.length === 0 ||
      !descriptor.captions.assPath)
  ) {
    throw new Error('Requested captions cannot be rendered');
  }
  if (descriptor.textOverlays.some((overlay) => !overlay.path)) {
    throw new Error('Requested text overlay is missing its rendered asset');
  }
  if (descriptor.branding?.required && !hasBrandingAssets(descriptor.branding)) {
    throw new Error('Required branding assets are unavailable');
  }
}
