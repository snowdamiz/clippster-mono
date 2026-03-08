import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '@/composables/useToast';
import { uploadMediaForPost, publishPost } from '@/services/socialAccountsApi';
import { uploadUserMediaForPost, publishToUserInstagram } from '@/services/userInstagramApi';
import { publishToUserTwitter } from '@/services/userTwitterApi';
import { publishToUserTiktok } from '@/services/userTiktokApi';
import { publishToUserYoutube } from '@/services/userYoutubeApi';

export interface PublishTarget {
  platformId: string;
  accountType: 'org' | 'user';
  accountId: number;
}

export interface BackgroundPublishState {
  uploadStatus: 'idle' | 'uploading' | 'complete' | 'error';
  publishStatus: 'idle' | 'publishing' | 'complete' | 'error';
  uploadError: string | null;
  publishResults: { platformId: string; success: boolean; error?: string }[];
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

export function useBackgroundPublish() {
  const { showToast } = useToast();

  const state = ref<BackgroundPublishState>({
    uploadStatus: 'idle',
    publishStatus: 'idle',
    uploadError: null,
    publishResults: [],
  });

  let uploadPromise: Promise<{ media_url: string; thumbnail_url?: string }> | null = null;
  let pendingPublish: {
    targets: PublishTarget[];
    caption: string;
    orgId: number | null;
    thumbnailUrl: string | null;
  } | null = null;

  async function startUpload(
    outputPath: string,
    thumbnailPath: string | null,
    orgId: number | null
  ): Promise<void> {
    state.value.uploadStatus = 'uploading';
    state.value.uploadError = null;

    uploadPromise = (async () => {
      // Read video file as data URL
      const videoDataUrl = await invoke<string>('read_file_as_data_url', { filePath: outputPath });
      const fileName = outputPath.split(/[/\\]/).pop() || 'video.mp4';
      const videoFile = dataUrlToFile(videoDataUrl, fileName);

      // Read thumbnail if available
      let thumbnailFile: File | undefined;
      if (thumbnailPath) {
        try {
          const thumbPath = thumbnailPath.startsWith('file://')
            ? thumbnailPath.replace('file://', '')
            : thumbnailPath;
          if (thumbPath.startsWith('data:')) {
            thumbnailFile = dataUrlToFile(thumbPath, 'thumbnail.jpg');
          } else if (!thumbPath.startsWith('http')) {
            const thumbDataUrl = await invoke<string>('read_file_as_data_url', { filePath: thumbPath });
            thumbnailFile = dataUrlToFile(thumbDataUrl, 'thumbnail.jpg');
          }
        } catch (thumbErr) {
          console.warn('[BackgroundPublish] Could not read thumbnail:', thumbErr);
        }
      }

      // Upload to R2
      let uploadResult;
      if (orgId) {
        uploadResult = await uploadMediaForPost(orgId, videoFile, thumbnailFile);
      } else {
        uploadResult = await uploadUserMediaForPost(videoFile, thumbnailFile);
      }

      if (!uploadResult.success || !uploadResult.media_url) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      console.log('[BackgroundPublish] R2 upload complete:', uploadResult.media_url);
      state.value.uploadStatus = 'complete';

      return { media_url: uploadResult.media_url, thumbnail_url: uploadResult.thumbnail_url };
    })();

    // Handle upload errors
    uploadPromise.catch((err) => {
      console.error('[BackgroundPublish] Upload failed:', err);
      state.value.uploadStatus = 'error';
      state.value.uploadError = err instanceof Error ? err.message : String(err);
    });

    // If there's a pending publish, execute it when upload completes
    uploadPromise.then(() => {
      if (pendingPublish) {
        executePublish(pendingPublish.targets, pendingPublish.caption, pendingPublish.orgId, pendingPublish.thumbnailUrl);
        pendingPublish = null;
      }
    });
  }

  function queuePublish(
    targets: PublishTarget[],
    caption: string,
    orgId: number | null,
    thumbnailUrl: string | null
  ): void {
    if (targets.length === 0) {
      console.warn('[BackgroundPublish] No targets to publish to');
      return;
    }

    // Show immediate feedback
    showToast(`Publishing ${targets.length} post${targets.length !== 1 ? 's' : ''} — uploading in background...`, 'success');

    // If upload is already complete, publish immediately
    if (state.value.uploadStatus === 'complete' && uploadPromise) {
      executePublish(targets, caption, orgId, thumbnailUrl);
    } else {
      // Queue the publish for when upload completes
      pendingPublish = { targets, caption, orgId, thumbnailUrl };
    }
  }

  async function executePublish(
    targets: PublishTarget[],
    caption: string,
    orgId: number | null,
    thumbnailUrl: string | null
  ): Promise<void> {
    if (!uploadPromise) {
      showToast('Upload was not started — cannot publish', 'error');
      return;
    }

    state.value.publishStatus = 'publishing';
    state.value.publishResults = [];

    try {
      console.log('[BackgroundPublish] Waiting for R2 upload to finish...');
      const uploadResult = await uploadPromise;
      const mediaUrl = uploadResult.media_url;
      const thumbUrl = uploadResult.thumbnail_url || thumbnailUrl;
      console.log('[BackgroundPublish] R2 upload done:', mediaUrl);

      let successfulCount = 0;
      let failedCount = 0;

      for (const target of targets) {
        try {
          let response: any;
          if (target.accountType === 'org' && orgId) {
            // Org account — use publishPost
            response = await publishPost(orgId, {
              social_account_id: target.accountId,
              media_url: mediaUrl,
              caption: caption,
              media_type: 'video',
              thumbnail_url: thumbUrl || undefined,
            });
          } else {
            // Personal account — use platform-specific endpoint
            const publishData = {
              account_id: target.accountId,
              media_url: mediaUrl,
              caption: caption,
              media_type: 'video' as const,
              thumbnail_url: thumbUrl || undefined,
            };
            switch (target.platformId) {
              case 'twitter':
                console.log('[BackgroundPublish] Calling publishToUserTwitter with data:', publishData);
                response = await publishToUserTwitter(publishData);
                console.log('[BackgroundPublish] publishToUserTwitter response:', response);
                break;
              case 'instagram':
                response = await publishToUserInstagram(publishData);
                break;
              case 'tiktok':
                response = await publishToUserTiktok(publishData);
                break;
              case 'youtube':
                response = await publishToUserYoutube({ ...publishData, title: caption || 'Video' });
                break;
              default:
                console.error('[BackgroundPublish] Unknown platform:', target.platformId);
                state.value.publishResults.push({ platformId: target.platformId, success: false, error: 'Unknown platform' });
                failedCount++;
                continue;
            }
          }

          if (response?.success) {
            successfulCount++;
            state.value.publishResults.push({ platformId: target.platformId, success: true });
            console.log(`[BackgroundPublish] Published to ${target.platformId} successfully`);
          } else {
            failedCount++;
            const errorMsg = response?.error || 'Unknown error';
            state.value.publishResults.push({ platformId: target.platformId, success: false, error: errorMsg });
            console.error(`[BackgroundPublish] Failed to publish to ${target.platformId}:`, errorMsg);
          }
        } catch (publishErr) {
          failedCount++;
          const errorMsg = publishErr instanceof Error ? publishErr.message : String(publishErr);
          state.value.publishResults.push({ platformId: target.platformId, success: false, error: errorMsg });
          console.error(`[BackgroundPublish] Error publishing to ${target.platformId}:`, publishErr);
        }
      }

      state.value.publishStatus = failedCount === targets.length ? 'error' : 'complete';

      if (successfulCount > 0) {
        showToast(`Published to ${successfulCount} platform${successfulCount !== 1 ? 's' : ''} successfully!`, 'success');
      }
      if (failedCount > 0) {
        showToast(`Failed to publish to ${failedCount} platform${failedCount !== 1 ? 's' : ''}`, 'error');
      }
    } catch (err) {
      console.error('[BackgroundPublish] Background publish failed:', err);
      state.value.publishStatus = 'error';
      showToast('Upload failed — could not publish', 'error');
    }
  }

  function reset() {
    state.value = {
      uploadStatus: 'idle',
      publishStatus: 'idle',
      uploadError: null,
      publishResults: [],
    };
    uploadPromise = null;
    pendingPublish = null;
  }

  return {
    state,
    startUpload,
    queuePublish,
    reset,
  };
}
