import { ref, onUnmounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { createDownloadedAudio } from '@/services/database/downloaded-audio';

export interface AudioDownloadProgress {
  download_id: string;
  progress: number;
  current_time?: number;
  total_time?: number;
  status: string;
}

export interface AudioDownloadResult {
  download_id: string;
  success: boolean;
  file_path?: string;
  title?: string;
  platform?: string;
  source_url?: string;
  duration?: number;
  file_size?: number;
  sample_rate?: number;
  channels?: number;
  thumbnail_url?: string;
  error?: string;
}

export interface ActiveAudioDownload {
  id: string;
  title: string;
  platform: string;
  progress: number;
  status: string;
  error?: string;
}

// Shared state across all instances (singleton pattern)
const activeDownloads = ref<Map<string, ActiveAudioDownload>>(new Map());
const queuedDownloads = ref<ActiveAudioDownload[]>([]);
let progressUnlisten: UnlistenFn | null = null;
let completeUnlisten: UnlistenFn | null = null;
let isInitialized = false;

export function useAudioDownloads() {

  async function startYouTubeAudioDownload(
    downloadId: string,
    title: string,
    vodUrl: string,
    channelName: string
  ): Promise<void> {
    // Add to active downloads
    activeDownloads.value.set(downloadId, {
      id: downloadId,
      title,
      platform: 'YouTube',
      progress: 0,
      status: 'Starting...',
    });

    try {
      await invoke('download_youtube_audio', {
        downloadId,
        title,
        vodUrl,
        channelName,
      });
    } catch (error) {
      console.error('Failed to start YouTube audio download:', error);
      const download = activeDownloads.value.get(downloadId);
      if (download) {
        download.error = error instanceof Error ? error.message : String(error);
        download.status = 'Failed';
      }
      throw error;
    }
  }

  async function startTwitterSpaceAudioDownload(
    downloadId: string,
    title: string,
    spaceUrl: string
  ): Promise<void> {
    // Add to active downloads
    activeDownloads.value.set(downloadId, {
      id: downloadId,
      title,
      platform: 'Twitter',
      progress: 0,
      status: 'Starting...',
    });

    try {
      await invoke('download_twitter_space_audio', {
        downloadId,
        title,
        spaceUrl,
      });
    } catch (error) {
      console.error('Failed to start Twitter Space audio download:', error);
      const download = activeDownloads.value.get(downloadId);
      if (download) {
        download.error = error instanceof Error ? error.message : String(error);
        download.status = 'Failed';
      }
      throw error;
    }
  }

  async function uploadAudioFile(filePath: string, title: string): Promise<AudioDownloadResult> {
    try {
      const result = await invoke<AudioDownloadResult>('upload_audio_file', {
        filePath,
        title,
      });

      // Save to database if successful
      if (result.success && result.file_path) {
        await createDownloadedAudio(
          title,
          'upload',
          result.file_path,
          undefined,
          undefined,
          result.duration,
          result.file_size,
          result.sample_rate,
          result.channels
        );
      }

      return result;
    } catch (error) {
      console.error('Failed to upload audio file:', error);
      throw error;
    }
  }

  async function cancelDownload(downloadId: string): Promise<void> {
    try {
      await invoke('cancel_audio_download', { downloadId });
      activeDownloads.value.delete(downloadId);
    } catch (error) {
      console.error('Failed to cancel audio download:', error);
      throw error;
    }
  }

  function handleProgress(event: AudioDownloadProgress) {
    const download = activeDownloads.value.get(event.download_id);
    if (download) {
      download.progress = event.progress;
      download.status = event.status;
    }
  }

  async function handleComplete(event: AudioDownloadResult) {
    console.log('[useAudioDownloads] Download complete event received:', event);
    console.log('[useAudioDownloads] Platform value:', event.platform);
    if (event.success && event.file_path && event.title && event.platform) {
      // Save to database
      try {
        await createDownloadedAudio(
          event.title,
          event.platform === 'YouTube' ? 'youtube' : 'twitter',
          event.file_path,
          event.platform,
          event.source_url,
          event.duration,
          event.file_size,
          event.sample_rate,
          event.channels,
          event.thumbnail_url
        );
        console.log('[useAudioDownloads] Saved downloaded audio to database:', event.title);
        console.log('[useAudioDownloads] Saved with platform:', event.platform);
      } catch (error) {
        console.error('[useAudioDownloads] Failed to save downloaded audio to database:', error);
      }
    }

    // Remove from active downloads
    activeDownloads.value.delete(event.download_id);
  }

  // Initialize event listeners only once (singleton pattern)
  if (!isInitialized) {
    isInitialized = true;
    (async () => {
      // Listen for download progress events
      progressUnlisten = await listen<AudioDownloadProgress>('download-progress', (event) => {
        handleProgress(event.payload);
      });

      // Listen for download complete events
      completeUnlisten = await listen<AudioDownloadResult>('download-complete', (event) => {
        handleComplete(event.payload);
      });
    })();
  }

  onUnmounted(() => {
    // Don't unlisten since this is shared across all components
    // The listeners will persist for the lifetime of the app
  });

  function getActiveDownloads(): ActiveAudioDownload[] {
    return Array.from(activeDownloads.value.values());
  }

  function getQueuedDownloads(): ActiveAudioDownload[] {
    return queuedDownloads.value;
  }

  return {
    activeDownloads,
    queuedDownloads,
    startYouTubeAudioDownload,
    startTwitterSpaceAudioDownload,
    uploadAudioFile,
    cancelDownload,
    getActiveDownloads,
    getQueuedDownloads,
  };
}
