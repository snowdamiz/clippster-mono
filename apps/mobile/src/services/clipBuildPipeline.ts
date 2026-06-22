import { buildClipExportPlan, buildOrgBrandingPlan } from '@clippster/clip-export';
import type { ClipSegment, TargetAspectRatio } from '@clippster/shared-types';
import { TARGET_DIMENSIONS } from '@clippster/shared-types';
import * as FileSystem from 'expo-file-system/legacy';

import { runFfmpeg } from './ffmpeg';
import {
  completeClipBuild,
  createClipBuild,
  getClipById,
  getClipSubtitleSettings,
  getClipTextOverlay,
  updateClipBuildProgress,
} from './database/clips';
import { getClipSegmentsByClipId } from './database/clip-segments';
import { getProjectVodPresetConfig } from './database/vod-presets';
import { getTranscriptByProjectId } from './database/workspace';
import { getTextOverlayPngPath, renderTextOverlayPng } from './textOverlayRaster';
import type { WordInfo } from '@clippster/shared-types';
import { getAllCachedAssets, resolveBrandingForAspect } from './orgAssetCache';
import type { BrandingConfig } from '@clippster/api-client';

export type ClipBuildState = 'idle' | 'building' | 'complete' | 'error';

export interface ClipBuildProgress {
  state: ClipBuildState;
  progress: number;
  message: string;
  error?: string;
  outputPaths?: string[];
  buildIds?: string[];
}

type ProgressListener = (progress: ClipBuildProgress) => void;

let activeAbort: (() => void) | null = null;
let cancelled = false;

function getExportDir(): string {
  return `${FileSystem.documentDirectory}exports/`;
}

async function ensureExportDir(): Promise<string> {
  const dir = getExportDir();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

function extractWordsFromTranscript(
  rawJson: string,
  clipStart: number,
  clipEnd: number,
): WordInfo[] {
  try {
    const parsed = JSON.parse(rawJson);
    const words: WordInfo[] = parsed.words ?? parsed.segments?.flatMap((s: { words?: WordInfo[] }) => s.words ?? []) ?? [];
    return words
      .filter((w) => w.end > clipStart && w.start < clipEnd)
      .map((w) => ({
        ...w,
        start: Math.max(0, w.start - clipStart),
        end: Math.min(clipEnd - clipStart, w.end - clipStart),
      }));
  } catch {
    return [];
  }
}

export function cancelClipBuild(): void {
  cancelled = true;
  activeAbort?.();
}

export async function buildClipExport(
  clipId: string,
  projectId: string,
  options: {
    ratios?: TargetAspectRatio[];
    remuxOnly?: boolean;
    includeSubtitles?: boolean;
    brandingConfig?: BrandingConfig | null;
    onProgress?: ProgressListener;
  } = {},
): Promise<string[]> {
  cancelled = false;
  const ratios = options.ratios ?? ['9:16'];
  const onProgress = options.onProgress;
  const outputPaths: string[] = [];
  const buildIds: string[] = [];

  onProgress?.({ state: 'building', progress: 0, message: 'Preparing export...' });

  const clip = await getClipById(clipId);
  if (!clip) throw new Error('Clip not found');

  const segments = await getClipSegmentsByClipId(clipId);
  if (segments.length === 0 && clip.start_time != null && clip.end_time != null) {
    segments.push({
      start_time: clip.start_time,
      end_time: clip.end_time,
      duration: clip.end_time - clip.start_time,
      transcript: null,
    });
  }

  const vodConfig = await getProjectVodPresetConfig(projectId);
  const brandingConfig =
    options.brandingConfig ??
    (vodConfig?.orgBranding?.brandingConfig as BrandingConfig | undefined) ??
    null;
  const orgAssets = brandingConfig ? await getAllCachedAssets() : [];
  const subtitleSettings = options.includeSubtitles !== false ? await getClipSubtitleSettings(clipId) : null;
  const textBox = await getClipTextOverlay(clipId);
  const transcript = await getTranscriptByProjectId(projectId);
  const clipStart = clip.start_time ?? 0;
  const clipEnd = clip.end_time ?? clipStart + (clip.duration ?? 0);
  const subtitleWords =
    subtitleSettings?.enabled && transcript?.raw_json
      ? extractWordsFromTranscript(transcript.raw_json, clipStart, clipEnd)
      : [];

  const exportDir = await ensureExportDir();

  for (let i = 0; i < ratios.length; i++) {
    if (cancelled) throw new Error('Export cancelled');

    const ratio = ratios[i];
    const outputPath = `${exportDir}${clipId}_${ratio.replace(':', 'x')}_${Date.now()}.mp4`;
    const assPath = `${exportDir}${clipId}_${ratio.replace(':', 'x')}.ass`;
    const textPngPath = getTextOverlayPngPath(exportDir, clipId, ratio);

    const build = await createClipBuild({
      clipId,
      filePath: outputPath,
      aspectRatios: [ratio],
      includeSubtitles: !!subtitleSettings?.enabled,
    });

    try {
      const effectiveTextBox =
        !options.remuxOnly && textBox?.enabled && textBox.text ? textBox : null;

      if (effectiveTextBox) {
        onProgress?.({
          state: 'building',
          progress: i / ratios.length,
          message: `Rendering text overlay for ${ratio}...`,
        });
        await renderTextOverlayPng(effectiveTextBox, ratio, textPngPath);
      }

      const plan = buildClipExportPlan({
        videoPath: clip.file_path,
        outputPath,
        segments: segments as ClipSegment[],
        targetRatio: ratio,
        framingConfig: vodConfig?.framingConfig ?? null,
        subtitleSettings: subtitleSettings?.enabled ? subtitleSettings : null,
        subtitleWords,
        textBox: effectiveTextBox,
        assPath: subtitleSettings?.enabled ? assPath : undefined,
        textOverlayPngPath: effectiveTextBox ? textPngPath : undefined,
        remuxOnly: options.remuxOnly,
      });

      if (plan.assContent) {
        await FileSystem.writeAsStringAsync(assPath, plan.assContent);
      }

      const ratioProgress = (completed: number) => {
        const base = i / ratios.length;
        const slice = 1 / ratios.length;
        const overall = base + completed * slice;
        onProgress?.({
          state: 'building',
          progress: overall,
          message: `Exporting ${ratio}... ${Math.round(completed * 100)}%`,
        });
        void updateClipBuildProgress(build.id, completed);
      };

      await runFfmpeg(plan.ffmpegArgs, { onProgress: ratioProgress });

      let finalPath = outputPath;
      const branding = brandingConfig
        ? await resolveBrandingForAspect(brandingConfig, ratio, orgAssets)
        : null;

      if (branding?.watermarkPath || branding?.introPath || branding?.outroPath) {
        const brandedPath = `${exportDir}${clipId}_${ratio.replace(':', 'x')}_branded_${Date.now()}.mp4`;
        const dims = TARGET_DIMENSIONS[ratio];
        const brandingPlan = buildOrgBrandingPlan({
          videoPath: outputPath,
          outputPath: brandedPath,
          width: dims.width,
          height: dims.height,
          watermarkPath: branding.watermarkPath,
          watermarkSettings: branding.watermarkSettings,
          introPath: branding.introPath,
          outroPath: branding.outroPath,
        });
        await runFfmpeg(brandingPlan.ffmpegArgs, { onProgress: ratioProgress });
        finalPath = brandedPath;
      }

      const fileInfo = await FileSystem.getInfoAsync(finalPath);
      await completeClipBuild(
        build.id,
        finalPath,
        fileInfo.exists && 'size' in fileInfo ? fileInfo.size : undefined,
        plan.totalDuration,
      );

      outputPaths.push(finalPath);
      buildIds.push(build.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await updateClipBuildProgress(build.id, 0, 'failed', message);
      onProgress?.({ state: 'error', progress: 0, message: 'Export failed', error: message });
      throw error;
    }
  }

  onProgress?.({
    state: 'complete',
    progress: 1,
    message: 'Export complete',
    outputPaths,
    buildIds,
  });

  return outputPaths;
}
