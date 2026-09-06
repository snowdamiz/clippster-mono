import type { SharedClip } from '@clippster/api-client';
import * as FileSystem from 'expo-file-system/legacy';
import { analyticsApi, sharedClipsApi } from './api';
import { createProject, createRawVideo } from './database';

const SHARED_DIR = `${FileSystem.documentDirectory}shared-clips/`;

async function ensureSharedDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(SHARED_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(SHARED_DIR, { intermediates: true });
  }
}

export async function downloadAndImportSharedClip(
  clip: SharedClip,
): Promise<{ success: boolean; projectId?: string; error?: string }> {
  if (!clip.url) {
    return { success: false, error: 'Clip URL not available' };
  }
  if (clip.days_until_expiration <= 0) {
    return { success: false, error: 'This clip has expired' };
  }

  try {
    await ensureSharedDir();
    const safeName = clip.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const localPath = `${SHARED_DIR}${clip.id}_${safeName}.mp4`;

    const download = await FileSystem.downloadAsync(clip.url, localPath);
    if (download.status !== 200) {
      return { success: false, error: `Download failed (${download.status})` };
    }

    const project = await createProject(clip.name, clip.description);

    if (clip.branding_required && clip.branding_config) {
      const { setProjectVodPresetConfig, getOrCreateProjectVodPresetConfig } = await import(
        './database/vod-presets'
      );
      const config = await getOrCreateProjectVodPresetConfig(project.id);
      await setProjectVodPresetConfig(project.id, {
        ...config,
        orgBranding: {
          brandingConfig: clip.branding_config as Record<string, unknown>,
          brandingRequired: true,
          organizationId: clip.organization_id,
        },
      });
    }

    await createRawVideo({
      projectId: project.id,
      filePath: localPath,
      originalFilename: `${safeName}.mp4`,
      duration: clip.duration,
      fileSize: clip.file_size,
      platform: 'OrgShared',
      sourceUrl: clip.url,
    });

    void sharedClipsApi.markDownloaded(clip.id);
    void analyticsApi.trackEvent({
      event_type: 'shared_clip_downloaded',
      metadata: { clip_id: clip.id, organization_id: clip.organization_id },
    });

    const { queueProjectSync } = await import('./cloudSync');
    void queueProjectSync(project.id);

    return { success: true, projectId: project.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}
