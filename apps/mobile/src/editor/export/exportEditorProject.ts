import type { BrandingConfig } from '@clippster/api-client';
import type { TargetAspectRatio } from '@clippster/shared-types';
import * as FileSystem from 'expo-file-system/legacy';

import { validateExportMetadata } from '@/lib/exportValidation';
import { probeMediaMetadata } from '@/services/ffmpeg';
import { getAllCachedAssets, resolveBrandingForAspect } from '@/services/orgAssetCache';
import { getProjectVodPresetConfig } from '@/services/database/vod-presets';
import {
  completeClipBuild,
  createClipBuild,
  updateClipBuildProgress,
} from '@/services/database/clips';
import { addManualClip } from '@/services/database/workspace';
import {
  createMobileEditorEngine,
  NativeMobileEditorEngine,
} from '../engine/NativeMobileEditorEngine';
import type { MobileEditProjectV3 } from '../model/schema';
import { ticksToSeconds } from '../model/schema';
import { getVideoTrack } from '../model/timeline';
import type { EditorExportProgress as ClipBuildProgress } from './exportProgress';

/**
 * Validation + native export orchestration + DB bookkeeping.
 * Frame composition/encode is owned by @clippster/editor-native.
 */
export async function exportEditorProject(
  document: MobileEditProjectV3,
  ratios: TargetAspectRatio[],
  onProgress: (progress: ClipBuildProgress) => void,
  onMaterializedClip?: (clipId: string) => void,
): Promise<string[]> {
  if (ratios.length === 0) throw new Error('Choose at least one export ratio');
  if (!NativeMobileEditorEngine.isAvailable()) {
    throw new Error(
      'Native editor export requires a rebuilt dev client with @clippster/editor-native.',
    );
  }

  const exportDir = `${FileSystem.documentDirectory}exports/`;
  await FileSystem.makeDirectoryAsync(exportDir, { intermediates: true });
  const outputs: string[] = [];
  const buildIds: string[] = [];
  const vodConfig = document.projectId
    ? await getProjectVodPresetConfig(document.projectId)
    : null;
  const brandingConfig =
    (vodConfig?.orgBranding?.brandingConfig as BrandingConfig | undefined) ?? null;
  const brandingAssets = brandingConfig ? await getAllCachedAssets() : [];
  let linkedClipId =
    document.linkedClipId ?? (document.kind === 'clip' ? document.targetId : null);
  if (!linkedClipId && document.projectId) {
    const firstVideo = getVideoTrack(document).items[0];
    const source = firstVideo ? document.assets[firstVideo.assetId] : null;
    if (!firstVideo || !source) throw new Error('Add a video before exporting');
    linkedClipId = await addManualClip(
      document.projectId,
      source.sourceUri,
      ticksToSeconds(firstVideo.sourceStart),
      ticksToSeconds(firstVideo.sourceEnd),
      'Editor project',
    );
    onMaterializedClip?.(linkedClipId);
  }

  const brandingRequired = Boolean(
    document.branding && document.branding.watermarkMode !== 'none',
  );
  for (const ratio of ratios) {
    if (!brandingRequired) continue;
    const branding = brandingConfig
      ? await resolveBrandingForAspect(brandingConfig, ratio, brandingAssets)
      : null;
    if (!branding) {
      throw new Error(`Required branding assets are unavailable for ${ratio}`);
    }
  }

  const engine = createMobileEditorEngine();
  const removeProgress = engine.onExportProgress((progress, message) => {
    onProgress({
      state: 'building',
      progress,
      message: message ?? 'Exporting…',
    });
  });

  try {
    await engine.load(document);
    for (let ratioIndex = 0; ratioIndex < ratios.length; ratioIndex += 1) {
      const ratio = ratios[ratioIndex];
      const stamp = Date.now();
      const outputPath = `${exportDir}${document.targetId}_${ratio.replace(':', 'x')}_${stamp}.mp4`;
      const canvas = document.canvas.outputByRatio[ratio];
      const clipId = linkedClipId;
      const build = clipId
        ? await createClipBuild({
            clipId,
            filePath: outputPath,
            aspectRatios: [ratio],
            includeSubtitles: Boolean(document.captionDocument?.enabled),
          })
        : null;
      try {
        onProgress({
          state: 'building',
          progress: ratioIndex / ratios.length,
          message: `Preparing ${ratio} export…`,
        });
        const job = await engine.export({
          ratios: [ratio],
          outputDirectory: exportDir,
        });
        const produced =
          job.outputPaths.find((path) => path.includes(ratio.replace(':', 'x'))) ??
          job.outputPaths[0] ??
          outputPath;
        const metadata = await probeMediaMetadata(produced);
        validateExportMetadata(metadata, {
          width: canvas.width,
          height: canvas.height,
          duration: ticksToSeconds(
            Math.max(
              0,
              ...document.tracks.flatMap((track) =>
                track.items.map((item) => item.timelineEnd),
              ),
            ),
          ),
          frameTolerance: 1 / canvas.fps,
        });
        outputs.push(produced);
        if (build) {
          const info = await FileSystem.getInfoAsync(produced);
          await completeClipBuild(
            build.id,
            produced,
            info.exists && 'size' in info ? info.size : undefined,
            metadata.duration,
          );
          buildIds.push(build.id);
        }
      } catch (error) {
        if (build) {
          const message = error instanceof Error ? error.message : String(error);
          await updateClipBuildProgress(build.id, 0, 'failed', message);
        }
        throw error;
      }
    }
  } finally {
    removeProgress();
    await engine.dispose();
  }

  onProgress({
    state: 'complete',
    progress: 1,
    message: 'Export complete',
    outputPaths: outputs,
    buildIds,
  });
  return outputs;
}
