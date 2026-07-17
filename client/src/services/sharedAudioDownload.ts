/**
 * Download shared audio into the local organization audio library for use in the editor.
 */

import { invoke } from '@tauri-apps/api/core';
import {
  createOrganizationAudioAsset,
  getAudioAssetByServerId,
  sharedAudioServerId,
} from '@/services/database/organization-assets';
import {
  getAudioExtension,
  markSharedAudioDownloaded,
  type SharedAudio,
} from '@/services/sharedAudioApi';

export async function downloadSharedAudioToLibrary(
  audio: SharedAudio,
  organizationName: string
): Promise<{ success: boolean; error?: string; alreadyExists?: boolean }> {
  if (!audio.url) {
    return { success: false, error: 'No download URL available' };
  }

  const serverId = sharedAudioServerId(audio.id);
  const existing = await getAudioAssetByServerId(serverId);
  if (existing) {
    await markSharedAudioDownloaded(audio.id);
    return { success: true, alreadyExists: true };
  }

  try {
    const ext = getAudioExtension(audio.mime_type, audio.name);
    const filename = `${audio.name}.${ext}`;

    const localFilePath = await invoke<string>('download_org_asset_from_url', {
      url: audio.url,
      filename,
      assetType: 'audio',
      organizationId: String(audio.organization_id),
    });

    await createOrganizationAudioAsset(
      audio.name,
      localFilePath,
      String(audio.organization_id),
      organizationName,
      serverId,
      {
        duration: audio.duration || undefined,
        fileSize: audio.file_size || undefined,
      }
    );

    await markSharedAudioDownloaded(audio.id);
    return { success: true };
  } catch (error: any) {
    console.error('[SharedAudioDownload] Failed:', error);
    return { success: false, error: error.message || 'Failed to download audio' };
  }
}
