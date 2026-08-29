import { buildTimelineExportPlan, type TimelineExportVideo } from '@clippster/clip-export';
import type { TargetAspectRatio, WordInfo } from '@clippster/shared-types';
import * as FileSystem from 'expo-file-system/legacy';

import type { EditDocument } from '@/lib/timeline/editDocument';
import { mapWordsToTimeline, timelineDuration } from '@/lib/timeline/editDocument';
import { runFfmpeg } from './ffmpeg';
import {
  completeClipBuild,
  createClipBuild,
  updateClipBuildProgress,
} from './database/clips';
import type { ClipBuildProgress } from './clipBuildPipeline';

type ProgressListener = (progress: ClipBuildProgress) => void;

function toFileUri(path: string): string {
  if (path.startsWith('file://') || path.startsWith('content://') || path.startsWith('http')) {
    return path;
  }
  return `file://${path}`;
}

export function editDocToExportVideos(doc: EditDocument): TimelineExportVideo[] {
  return doc.videos.map((clip) => ({
    path: clip.sourcePath,
    sourceStart: clip.sourceStart,
    sourceEnd: clip.sourceEnd,
    speed: clip.speed,
    muted: clip.muted,
    transitionIn: clip.transitionIn,
    effect: clip.effect ?? null,
  }));
}

export async function buildTimelineExport(
  doc: EditDocument,
  options: {
    ratios?: TargetAspectRatio[];
    wordsBySourcePath?: Record<string, WordInfo[]>;
    clipId?: string;
    projectId?: string;
    onProgress?: ProgressListener;
  } = {},
): Promise<string[]> {
  if (doc.videos.length === 0) {
    throw new Error('Add a video clip before exporting');
  }

  const ratios = options.ratios ?? ['16:9'];
  const onProgress = options.onProgress;
  const outputPaths: string[] = [];
  const buildIds: string[] = [];
  const exportDir = `${FileSystem.documentDirectory}exports/`;
  const info = await FileSystem.getInfoAsync(exportDir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(exportDir, { intermediates: true });
  }

  const clipId = options.clipId ?? doc.linkedClipId ?? doc.targetId;
  const words = mapWordsToTimeline(doc, options.wordsBySourcePath ?? {});

  for (let i = 0; i < ratios.length; i++) {
    const ratio = ratios[i];
    const workDir = `${exportDir}timeline_${Date.now()}_${i}/`;
    await FileSystem.makeDirectoryAsync(workDir, { intermediates: true });
    const outputPath = `${exportDir}${clipId}_${ratio.replace(':', 'x')}_${Date.now()}.mp4`;
    const assPath = `${workDir}captions.ass`;

    const build = await createClipBuild({
      clipId,
      filePath: outputPath,
      aspectRatios: [ratio],
      includeSubtitles: Boolean(doc.captions.enabled && words.length > 0),
    });

    try {
      const plan = buildTimelineExportPlan({
        videos: editDocToExportVideos(doc),
        images: doc.images.map((image) => ({
          path: image.sourcePath,
          timelineStart: image.timelineStart,
          duration: image.duration,
          x: image.x,
          y: image.y,
          widthPct: image.widthPct,
        })),
        audio: doc.audio.map((item) => ({
          path: item.sourcePath,
          sourceStart: item.sourceStart,
          sourceEnd: item.sourceEnd,
          timelineStart: item.timelineStart,
          volume: item.volume,
        })),
        outputPath,
        workDir,
        targetRatio: ratio,
        subtitleSettings: doc.captions.enabled && words.length > 0 ? doc.captions.settings : null,
        subtitleWords: words,
        assPath,
      });

      if (plan.assContent) {
        await FileSystem.writeAsStringAsync(assPath, plan.assContent);
      }

      const report = (stage: number, ratioComplete: number) => {
        const slice = 1 / ratios.length;
        onProgress?.({
          state: 'building',
          progress: i / ratios.length + (stage + ratioComplete) / 3 * slice,
          message: `Exporting ${ratio}…`,
        });
        void updateClipBuildProgress(build.id, (stage + ratioComplete) / 3);
      };

      for (const [index, clip] of plan.clipRenders.entries()) {
        report(0, index / plan.clipRenders.length);
        try {
          await runFfmpeg(clip.args);
        } catch {
          const silent = buildTimelineExportPlan({
            videos: editDocToExportVideos(doc).map((video, videoIndex) =>
              videoIndex === index ? { ...video, muted: true } : video,
            ),
            images: [],
            audio: [],
            outputPath: clip.outputPath,
            workDir,
            targetRatio: ratio,
          }).clipRenders[index];
          await runFfmpeg(silent.args);
        }
      }

      if (plan.concat.listContent && plan.concat.listPath) {
        await FileSystem.writeAsStringAsync(plan.concat.listPath, plan.concat.listContent);
      }
      report(1, 0.2);
      await runFfmpeg(plan.concat.args);
      report(2, 0.2);
      await runFfmpeg(plan.compose.args);

      const fileInfo = await FileSystem.getInfoAsync(toFileUri(outputPath));
      await completeClipBuild(
        build.id,
        outputPath,
        fileInfo.exists && 'size' in fileInfo ? fileInfo.size : undefined,
        timelineDuration(doc),
      );
      outputPaths.push(outputPath);
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

  if (options.projectId) {
    const { queueProjectSync } = await import('./cloudSync');
    void queueProjectSync(options.projectId);
  }

  return outputPaths;
}
