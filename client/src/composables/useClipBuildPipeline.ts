import { ref, type Ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { ClipWithVersion } from '@/services/database';
import type { BuildSettings, IntroOutroItem } from '@/components/ClipBuildSettingsDialog.vue';
import { resolveIntroOutroById } from '@/services/database/intro-outros';
import { getMyAssignedCreatorProfiles } from '@/services/organizationProfilesApi';
import { getCampaign } from '@/services/campaignApi';
import { ensureAssetDownloaded } from '@/services/orgAssetSync';
import type { ServerOrganizationAsset } from '@/services/organizationAssetsApi';

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

      // Use pre-created buildId/buildNumber from settings if provided (e.g. from QuickPublishWizard)
      // to avoid creating a duplicate clip_builds record
      let buildNumber: number;
      let buildId: string;

      if (settings.buildId && settings.buildNumber) {
        buildId = settings.buildId;
        buildNumber = settings.buildNumber;
        console.log('[BuildPipeline] Using pre-created buildId:', buildId, 'buildNumber:', buildNumber);
      } else {
        // Calculate build number
        buildNumber = 1;
        try {
          const existingBuilds = await getClipBuilds(clipId);
          buildNumber = existingBuilds.length + 1;
        } catch {
          buildNumber = 1;
        }

        // Create clip build record with campaign context
        buildId = await createClipBuild(clipId, {
          aspectRatios: settings.aspectRatios,
          quality: settings.quality,
          frameRate: settings.frameRate,
          outputFormat: settings.format,
          campaignId: settings.campaignId || null,
          brandingProfileId: settings.campaignBrandingProfileId ? String(settings.campaignBrandingProfileId) : null,
          brandingType: settings.brandingType || 'org',
        });
      }

      // Load segments from DB or create synthetic
      let segments: { id: string; start_time: number; end_time: number; duration: number; transcript: string | null }[] = [];
      if (clip.current_version_id) {
        try {
          const dbSegments = await getClipSegmentsByVersionId(clip.current_version_id);
          if (dbSegments.length > 0) {
            // For self-contained extracted clips (anything with `file_path`), segments must
            // address the clip's own MP4 file (0-based). Legacy paths sometimes wrote
            // livestream-absolute timestamps into clip_segments; if any segment lies past
            // the clip's actual duration, the row is stale — fall through to the synthetic
            // [0, clip.duration] segment below so the build doesn't try to seek to a
            // timestamp that doesn't exist in the file.
            const isSelfContained =
              typeof clip.file_path === 'string' && clip.file_path.trim() !== '';
            const clipDur =
              typeof clip.duration === 'number' && clip.duration > 0 ? clip.duration : 0;
            const segmentsLookStale =
              isSelfContained &&
              clipDur > 0 &&
              dbSegments.some(
                (s: any) =>
                  typeof s.end_time === 'number' && s.end_time > clipDur + 0.5
              );

            if (!segmentsLookStale) {
              segments = dbSegments.map((s: any) => ({
                id: s.id,
                start_time: s.start_time,
                end_time: s.end_time,
                duration: s.duration,
                transcript: s.transcript,
              }));
            } else {
              console.warn(
                '[BuildPipeline] Ignoring stale livestream-absolute clip_segments rows; falling back to full clip range:',
                { clipId: clip.id, clipDuration: clipDur }
              );
            }
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

      let resolvedIntroOutroPerRatio: Record<string, { introPath?: string; introDuration?: number; outroPath?: string; outroDuration?: number }> | null = null;
      let resolvedWatermarkSettings = watermarkSettings;

      if (brandingType === 'org' && campaignBrandingProfileId) {
        try {
          const profilesResponse = await getMyAssignedCreatorProfiles();
          const profile = profilesResponse.success
            ? profilesResponse.profiles.find((p) => p.id === campaignBrandingProfileId)
            : null;

          console.log('[BuildPipeline] Org branding lookup:', {
            profileId: campaignBrandingProfileId,
            foundProfile: !!profile,
            introId: profile?.intro_id || null,
            outroId: profile?.outro_id || null,
            hasIntroRatioSettings: !!profile?.intro_ratio_settings,
            hasOutroRatioSettings: !!profile?.outro_ratio_settings,
          });

          if (!introPath && profile?.intro_id) {
            const resolved = await resolveIntroOutroById(`org-asset-${profile.intro_id}`);
            if (resolved) {
              introPath = resolved.filePath;
              introDuration = resolved.duration;
            }
          }

          if (!outroPath && profile?.outro_id) {
            const resolved = await resolveIntroOutroById(`org-asset-${profile.outro_id}`);
            if (resolved) {
              outroPath = resolved.filePath;
              outroDuration = resolved.duration;
            }
          }

          if (profile?.intro_ratio_settings || profile?.outro_ratio_settings) {
            resolvedIntroOutroPerRatio = {};

            if (profile.intro_ratio_settings) {
              const introSettings = typeof profile.intro_ratio_settings === 'string'
                ? JSON.parse(profile.intro_ratio_settings)
                : profile.intro_ratio_settings;

              for (const ratio of Object.keys(introSettings || {})) {
                const introId = introSettings?.[ratio]?.introId;
                if (!introId) continue;
                const resolved = await resolveIntroOutroById(introId);
                if (resolved) {
                  resolvedIntroOutroPerRatio[ratio] = {
                    ...(resolvedIntroOutroPerRatio[ratio] || {}),
                    introPath: resolved.filePath,
                    introDuration: resolved.duration || undefined,
                  };
                }
              }
            }

            if (profile.outro_ratio_settings) {
              const outroSettings = typeof profile.outro_ratio_settings === 'string'
                ? JSON.parse(profile.outro_ratio_settings)
                : profile.outro_ratio_settings;

              for (const ratio of Object.keys(outroSettings || {})) {
                const outroId = outroSettings?.[ratio]?.outroId;
                if (!outroId) continue;
                const resolved = await resolveIntroOutroById(outroId);
                if (resolved) {
                  resolvedIntroOutroPerRatio[ratio] = {
                    ...(resolvedIntroOutroPerRatio[ratio] || {}),
                    outroPath: resolved.filePath,
                    outroDuration: resolved.duration || undefined,
                  };
                }
              }
            }

            if (Object.keys(resolvedIntroOutroPerRatio).length === 0) {
              resolvedIntroOutroPerRatio = null;
            }
          }
        } catch (error) {
          console.warn('[BuildPipeline] Failed to resolve org branding:', error);
        }
      }

      if (brandingType === 'campaign' && campaignId) {
        try {
          const campaignResponse = await getCampaign(campaignId);
          const campaign = campaignResponse.success ? campaignResponse.campaign : null;

          console.log('[BuildPipeline] Campaign branding lookup:', {
            campaignId,
            hasCampaign: !!campaign,
            brandingProfileId: campaign?.branding_profile_id || null,
            hasBrandingProfile: !!campaign?.branding_profile,
            hasGlobalIntro: !!campaign?.global_intro,
            hasGlobalOutro: !!campaign?.global_outro,
            creatorProfilesCount: campaign?.creator_profiles?.length || 0,
            hasCreatorProfile: !!campaign?.creator_profile,
          });

          const brandingProfile = campaign?.branding_profile;

          if (!introPath && brandingProfile?.intro) {
            const introResult = await ensureAssetDownloaded({
              id: brandingProfile.intro.id,
              name: brandingProfile.intro.name,
              asset_type: 'intro',
              url: brandingProfile.intro.url,
              organization_id: campaign!.organization_id,
              organization_name: campaign?.organization?.name || '',
              duration: brandingProfile.intro.duration ? parseFloat(brandingProfile.intro.duration) : undefined,
              inserted_at: campaign!.inserted_at,
              updated_at: campaign!.updated_at,
            } as unknown as ServerOrganizationAsset);
            if (introResult.success && introResult.filePath) {
              introPath = introResult.filePath;
              introDuration = brandingProfile.intro.duration ? parseFloat(brandingProfile.intro.duration) : null;
            }
          }

          if (!outroPath && brandingProfile?.outro) {
            const outroResult = await ensureAssetDownloaded({
              id: brandingProfile.outro.id,
              name: brandingProfile.outro.name,
              asset_type: 'outro',
              url: brandingProfile.outro.url,
              organization_id: campaign!.organization_id,
              organization_name: campaign?.organization?.name || '',
              duration: brandingProfile.outro.duration ? parseFloat(brandingProfile.outro.duration) : undefined,
              inserted_at: campaign!.inserted_at,
              updated_at: campaign!.updated_at,
            } as unknown as ServerOrganizationAsset);
            if (outroResult.success && outroResult.filePath) {
              outroPath = outroResult.filePath;
              outroDuration = brandingProfile.outro.duration ? parseFloat(brandingProfile.outro.duration) : null;
            }
          }

          const watermarkProfile = brandingProfile || campaign?.creator_profiles?.[0] || campaign?.creator_profile;
          if (watermarkProfile?.watermark?.url) {
            const filename = `campaign-watermark-${watermarkProfile.watermark.id}.png`;
            const filePath = await invoke<string>('download_org_asset_from_url', {
              url: watermarkProfile.watermark.url,
              filename,
              assetType: 'watermarks',
              organizationId: String(campaign!.organization_id),
            });

            let defaultPos = { x: 12, y: 92, opacity: 80, scale: 20 };
            if (watermarkProfile.watermark_settings) {
              const wmSettings = typeof watermarkProfile.watermark_settings === 'string'
                ? JSON.parse(watermarkProfile.watermark_settings as unknown as string)
                : watermarkProfile.watermark_settings;
              const ratioConfig = wmSettings?.[settings.aspectRatios[0]] || wmSettings?.['16:9'];
              if (ratioConfig?.position) defaultPos = ratioConfig.position;
            }

            resolvedWatermarkSettings = {
              enabled: true,
              watermarkId: `org-asset-${watermarkProfile.watermark.id}`,
              filePath,
              width: null,
              height: null,
              positionX: defaultPos.x,
              positionY: defaultPos.y,
              opacity: defaultPos.opacity,
              scale: defaultPos.scale,
              perRatioSettings: (watermarkProfile.watermark_settings as any) ?? null,
            } as any;
          } else {
            resolvedWatermarkSettings = null;
          }
        } catch (error) {
          console.warn('[BuildPipeline] Failed to resolve campaign branding:', error);
        }
      }

      console.log('[BuildPipeline] Final branding payload before invoke:', {
        brandingType,
        campaignId,
        campaignBrandingProfileId,
        aspectRatios: settings.aspectRatios,
        introPath,
        outroPath,
        introOutroPerRatio: resolvedIntroOutroPerRatio,
        watermarkEnabled: !!resolvedWatermarkSettings?.enabled,
        watermarkId: (resolvedWatermarkSettings as any)?.watermarkId || null,
      });

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

      const { getClipTextBoxOverlaysForExport } = await import('@/utils/clipTextBox');
      const textOverlaysFromClipBox = await getClipTextBoxOverlaysForExport(clipId);
      console.log('[BuildPipeline] Text overlays from clip box:', {
        clipId,
        count: textOverlaysFromClipBox?.length ?? 0,
        overlays: textOverlaysFromClipBox,
      });

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
        introOutroPerRatio: resolvedIntroOutroPerRatio,
        watermarkSettings: resolvedWatermarkSettings,
        audioSettings: null,
        framingStrategy: null,
        manualFramingConfigs: settings.manualFramingConfigs || null,
        segmentFramingConfigs: null,
        videoFilterSegments: null,
        textOverlays: textOverlaysFromClipBox,
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
        aspectRatioOutputPaths: {},
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
