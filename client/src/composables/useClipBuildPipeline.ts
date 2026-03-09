import { ref, type Ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { ClipWithVersion } from '@/services/database';
import type { BuildSettings, IntroOutroItem } from '@/components/ClipBuildSettingsDialog.vue';

export interface BuildPipelineState {
  status: 'idle' | 'building' | 'complete' | 'error';
  progress: number;
  outputPath: string | null;
  thumbnailPath: string | null;
  duration: number | null;
  error: string | null;
  aspectRatioOutputPaths: Record<string, string>; // Maps aspect ratio (e.g., '16:9') to file path
}

export interface BuildPipelineOptions {
  clip: ClipWithVersion;
  projectId: string;
  settings: BuildSettings;
  videoPath: string;
}

export function useClipBuildPipeline() {
  const state = ref<BuildPipelineState>({
    status: 'idle',
    progress: 0,
    outputPath: null,
    thumbnailPath: null,
    duration: null,
    error: null,
    aspectRatioOutputPaths: {},
  });

  let progressUnlisten: UnlistenFn | null = null;
  let completeUnlisten: UnlistenFn | null = null;

  async function startBuild(options: BuildPipelineOptions): Promise<void> {
    const { clip, projectId, settings, videoPath } = options;
    const clipId = clip.id;

    // Reset state
    state.value = {
      status: 'building',
      progress: 0,
      outputPath: null,
      thumbnailPath: null,
      duration: null,
      error: null,
      aspectRatioOutputPaths: {},
    };

    try {
      const { createClipBuild, getClipBuilds, updateClipBuildStatus } = await import('@/services/database/clip-build');
      const { getClipSegmentsByVersionId } = await import('@/services/database/clip-segments');
      const { resolveWatermarkById } = await import('@/services/database/watermarks');

      // Update database status to building
      await updateClipBuildStatus(clipId, 'building', { progress: 0 });

      // Calculate build number
      let buildNumber = 1;
      try {
        const existingBuilds = await getClipBuilds(clipId);
        buildNumber = existingBuilds.length + 1;
      } catch {
        buildNumber = 1;
      }

      // Create clip build record with campaign context
      const buildId = await createClipBuild(clipId, {
        aspectRatios: settings.aspectRatios,
        quality: settings.quality,
        frameRate: settings.frameRate,
        outputFormat: settings.format,
        campaignId: settings.campaignId || null,
        brandingProfileId: settings.campaignBrandingProfileId ? String(settings.campaignBrandingProfileId) : null,
        brandingType: settings.brandingType || 'org',
      });

      // Load segments from DB or create synthetic
      let segments: { id: string; start_time: number; end_time: number; duration: number; transcript: string | null }[] = [];
      if (clip.current_version_id) {
        try {
          const dbSegments = await getClipSegmentsByVersionId(clip.current_version_id);
          if (dbSegments.length > 0) {
            segments = dbSegments.map((s: any) => ({
              id: s.id,
              start_time: s.start_time,
              end_time: s.end_time,
              duration: s.duration,
              transcript: s.transcript,
            }));
          }
        } catch (err) {
          console.warn('[BuildPipeline] Could not load segments from DB:', err);
        }
      }

      // Create synthetic segment if none found
      if (segments.length === 0) {
        // For clips with a file_path (already extracted clips), use the entire clip file
        // For clips without file_path (building from source), use clip times
        let startTime: number;
        let endTime: number;
        
        if (clip.file_path || videoPath) {
          // This is an already-extracted clip file - use entire file (0 to duration)
          startTime = 0;
          endTime = clip.duration ?? 0;
          console.log('[BuildPipeline] Using entire clip file (already extracted):', { startTime, endTime, duration: clip.duration });
        } else {
          // Building from source video - use clip times
          startTime = clip.start_time ?? clip.current_version_start_time ?? 0;
          endTime = clip.end_time ?? clip.current_version_end_time ?? clip.duration ?? 0;
          console.log('[BuildPipeline] Extracting from source video:', { startTime, endTime });
        }
        
        if (endTime > startTime) {
          segments = [{
            id: `synthetic-${clipId}`,
            start_time: startTime,
            end_time: endTime,
            duration: endTime - startTime,
            transcript: null,
          }];
        }
      }

      // Resolve watermark settings
      let watermarkSettings = null;
      if (settings.watermark?.enabled && settings.watermark?.watermarkId) {
        const defaultWatermark = await resolveWatermarkById(settings.watermark.watermarkId);
        if (defaultWatermark) {
          const buildPerRatioSettings: Record<string, any> = {};
          const allRatios = ['16:9', '9:16', '1:1', '4:5'];
          for (const ratio of allRatios) {
            const perRatioConfig = (settings.watermark as any).perRatioSettings?.[ratio];
            if (perRatioConfig === null) {
              buildPerRatioSettings[ratio] = null;
            } else if (perRatioConfig) {
              let filePath = defaultWatermark.filePath;
              let width = defaultWatermark.width;
              let height = defaultWatermark.height;
              if (perRatioConfig.watermarkId && perRatioConfig.watermarkId !== settings.watermark.watermarkId) {
                const ratioWm = await resolveWatermarkById(perRatioConfig.watermarkId);
                if (ratioWm) {
                  filePath = ratioWm.filePath;
                  width = ratioWm.width;
                  height = ratioWm.height;
                }
              }
              buildPerRatioSettings[ratio] = {
                watermarkId: perRatioConfig.watermarkId || settings.watermark.watermarkId,
                filePath,
                width,
                height,
                position: perRatioConfig.position || {
                  x: (settings.watermark as any).positionX,
                  y: (settings.watermark as any).positionY,
                  opacity: (settings.watermark as any).opacity,
                  scale: (settings.watermark as any).scale,
                },
              };
            } else {
              buildPerRatioSettings[ratio] = {
                watermarkId: settings.watermark.watermarkId,
                filePath: defaultWatermark.filePath,
                width: defaultWatermark.width,
                height: defaultWatermark.height,
                position: {
                  x: (settings.watermark as any).positionX,
                  y: (settings.watermark as any).positionY,
                  opacity: (settings.watermark as any).opacity,
                  scale: (settings.watermark as any).scale,
                },
              };
            }
          }
          watermarkSettings = {
            enabled: true,
            watermarkId: settings.watermark.watermarkId,
            filePath: defaultWatermark.filePath,
            width: defaultWatermark.width,
            height: defaultWatermark.height,
            positionX: (settings.watermark as any).positionX,
            positionY: (settings.watermark as any).positionY,
            opacity: (settings.watermark as any).opacity,
            scale: (settings.watermark as any).scale,
            perRatioSettings: buildPerRatioSettings,
          };
        }
      }

      // Resolve intro/outro paths
      let introPath: string | null = null;
      let introDuration: number | null = null;
      let outroPath: string | null = null;
      let outroDuration: number | null = null;
      if (settings.intro) {
        introPath = settings.intro.file_path || null;
        introDuration = settings.intro.duration || null;
      }
      if (settings.outro) {
        outroPath = settings.outro.file_path || null;
        outroDuration = settings.outro.duration || null;
      }

      // Campaign branding context
      const campaignId = settings.campaignId || null;
      const campaignBrandingProfileId = settings.campaignBrandingProfileId || null;
      const brandingType = settings.brandingType || 'org';

      // Listen for progress events
      if (progressUnlisten) {
        progressUnlisten();
      }
      progressUnlisten = await listen<{ clip_id: string; progress: number; message: string }>('clip-build-progress', (event) => {
        if (event.payload.clip_id !== clipId) return;
        state.value.progress = event.payload.progress;
      });

      // Listen for build completion event
      if (completeUnlisten) {
        completeUnlisten();
      }

      const buildCompletePromise = new Promise<void>((resolve, reject) => {
        listen<{
          clip_id: string;
          success: boolean;
          output_path: string | null;
          all_output_paths: string[];
          thumbnail_path: string | null;
          duration: number | null;
          error: string | null;
        }>('clip-build-complete', (event) => {
          const payload = event.payload;
          if (payload.clip_id !== clipId) return;

          if (payload.success && payload.output_path) {
            // Map aspect ratios to their output paths
            const aspectRatioOutputPaths: Record<string, string> = {};
            if (payload.all_output_paths && payload.all_output_paths.length > 0) {
              settings.aspectRatios.forEach((ratio, index) => {
                if (payload.all_output_paths[index]) {
                  aspectRatioOutputPaths[ratio] = payload.all_output_paths[index];
                }
              });
            }

            state.value = {
              status: 'complete',
              progress: 100,
              outputPath: payload.output_path,
              thumbnailPath: payload.thumbnail_path,
              duration: payload.duration,
              error: null,
              aspectRatioOutputPaths,
            };
            resolve();
          } else {
            state.value = {
              status: 'error',
              progress: 0,
              outputPath: null,
              thumbnailPath: null,
              duration: null,
              error: payload.error || 'Build failed',
              aspectRatioOutputPaths: {},
            };
            reject(new Error(payload.error || 'Build failed'));
          }
        }).then((unlisten) => {
          completeUnlisten = unlisten;
        });
      });

      // Start the build via Tauri command
      await invoke('build_clip_from_segments', {
        projectId,
        clipId,
        clipName: clip.current_version_name || clip.name || 'Livestream Clip',
        videoPath,
        segments,
        subtitleSettings: null,
        subtitleOverrides: settings.subtitleOverrides || null,
        transcriptWords: [],
        transcriptSegments: [],
        maxWords: 3,
        aspectRatios: settings.aspectRatios,
        quality: settings.quality,
        frameRate: settings.frameRate,
        outputFormat: settings.format,
        runNumber: clip.run_number || null,
        buildNumber,
        buildId,
        introPath,
        introDuration,
        outroPath,
        outroDuration,
        introOutroPerRatio: null,
        watermarkSettings,
        audioSettings: null,
        framingStrategy: null,
        manualFramingConfigs: settings.manualFramingConfigs || null,
        segmentFramingConfigs: null,
        videoFilterSegments: null,
        textOverlays: null,
        stickers: null,
        clipWatermarks: null,
        clipEffects: null,
        audioEffects: null,
        layoutOverlays: settings.layoutOverlays || null,
        // Campaign branding context
        campaignId,
        campaignBrandingProfileId,
        brandingType,
      });

      // Wait for build to complete
      await buildCompletePromise;

    } catch (err) {
      console.error('[BuildPipeline] Build failed:', err);
      state.value = {
        status: 'error',
        progress: 0,
        outputPath: null,
        thumbnailPath: null,
        duration: null,
        error: err instanceof Error ? err.message : String(err),
      };
      throw err;
    }
  }

  function cleanup() {
    if (progressUnlisten) {
      progressUnlisten();
      progressUnlisten = null;
    }
    if (completeUnlisten) {
      completeUnlisten();
      completeUnlisten = null;
    }
  }

  function reset() {
    cleanup();
    state.value = {
      status: 'idle',
      progress: 0,
      outputPath: null,
      thumbnailPath: null,
      duration: null,
      error: null,
      aspectRatioOutputPaths: {},
    };
  }

  return {
    state,
    startBuild,
    cleanup,
    reset,
  };
}
