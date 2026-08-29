/**
 * Composable for extracting frames from video files at specific timestamps.
 * Uses the existing Tauri `generate_thumbnail_at_timestamp` command.
 */
import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';

export function useFrameExtractor() {
  const isExtracting = ref(false);
  const error = ref<string | null>(null);

  /**
   * Extract a frame from a video file at a specific timestamp.
   * Returns the file path to the extracted frame image.
   */
  async function extractFrame(
    videoPath: string,
    timestampSeconds: number,
    outputFilename?: string,
  ): Promise<string | null> {
    isExtracting.value = true;
    error.value = null;

    try {
      const filename = outputFilename || `frame_extract_${Date.now()}`;
      const framePath = await invoke<string>('generate_thumbnail_at_timestamp', {
        videoPath,
        timestampSeconds,
        outputFilename: filename,
      });
      return framePath;
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
      console.error('[useFrameExtractor] Failed to extract frame:', err);
      return null;
    } finally {
      isExtracting.value = false;
    }
  }

  /**
   * Extract a frame and return it as a data URL for preview.
   */
  async function extractFrameAsDataUrl(
    videoPath: string,
    timestampSeconds: number,
  ): Promise<string | null> {
    const framePath = await extractFrame(videoPath, timestampSeconds);
    if (!framePath) return null;

    try {
      const dataUrl = await invoke<string>('read_file_as_data_url', {
        filePath: framePath,
      });
      return dataUrl;
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
      console.error('[useFrameExtractor] Failed to read frame as data URL:', err);
      return null;
    }
  }

  return {
    isExtracting,
    error,
    extractFrame,
    extractFrameAsDataUrl,
  };
}
