import { ref, computed, readonly } from 'vue';
import { clipExtractor, type ExtractedClip } from '@/services/clip-extractor';
import { useProxyWorkflow } from './useProxyWorkflow';

/**
 * Composable for managing clip extraction workflow
 * This bridges the gap between the old trim-based system and the new clip extraction system
 */
export function useClipExtraction() {
  const isExtracting = ref(false);
  const extractionProgress = ref(0);
  const extractedClips = ref<Map<string, ExtractedClip>>(new Map());
  const error = ref<string | null>(null);

  // Get proxy workflow for integration
  const proxyWorkflow = useProxyWorkflow();

  /**
   * Extract a clip from a source video file
   * 
   * @param sourcePath Path to the source video
   * @param startTime Start time in seconds
   * @param endTime End time in seconds
   * @returns Promise<ExtractedClip> The extracted clip information
   */
  async function extractClip(
    sourcePath: string,
    startTime: number,
    endTime: number
  ): Promise<ExtractedClip> {
    isExtracting.value = true;
    error.value = null;
    extractionProgress.value = 0;

    try {
      console.log(`[useClipExtraction] Starting clip extraction: ${sourcePath} (${startTime}s - ${endTime}s)`);
      
      // Extract the clip with assets
      const clip = await clipExtractor.extractClipWithAssets(sourcePath, startTime, endTime);
      
      // Store the extracted clip
      extractedClips.value.set(clip.id, clip);
      
      console.log(`[useClipExtraction] ✓ Clip extracted: ${clip.clipPath}`);
      return clip;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      error.value = errorMessage;
      console.error(`[useClipExtraction] Extraction failed:`, err);
      throw err;

    } finally {
      isExtracting.value = false;
      extractionProgress.value = 0;
    }
  }

  /**
   * Convert a timeline source to use extracted clip instead of trim parameters
   * 
   * @param sourceId The source ID to convert
   * @param sourcePath The original source path
   * @param startTime The trim start time
   * @param endTime The trim end time
   * @returns Promise<string> The new clip file path
   */
  async function convertSourceToClip(
    sourceId: string,
    sourcePath: string,
    startTime: number,
    endTime: number
  ): Promise<string> {
    console.log(`[useClipExtraction] Converting source ${sourceId} to extracted clip`);

    // Check if we already have an extracted clip for this source
    const existingClip = Array.from(extractedClips.value.values()).find(
      clip => clip.sourcePath === sourcePath && 
              Math.abs(clip.startTime - startTime) < 0.1 && 
              Math.abs(clip.endTime - endTime) < 0.1
    );

    if (existingClip) {
      console.log(`[useClipExtraction] Using existing extracted clip: ${existingClip.clipPath}`);
      return existingClip.clipPath;
    }

    // Extract new clip
    const clip = await extractClip(sourcePath, startTime, endTime);
    return clip.clipPath;
  }

  /**
   * Delete an extracted clip and its assets
   * 
   * @param clipId The ID of the clip to delete
   */
  async function deleteClip(clipId: string): Promise<void> {
    const clip = extractedClips.value.get(clipId);
    if (!clip) {
      console.warn(`[useClipExtraction] Clip not found: ${clipId}`);
      return;
    }

    try {
      await clipExtractor.deleteClip(clip);
      extractedClips.value.delete(clipId);
      console.log(`[useClipExtraction] ✓ Clip deleted: ${clipId}`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      error.value = errorMessage;
      console.error(`[useClipExtraction] Failed to delete clip:`, err);
      throw err;
    }
  }

  /**
   * Check if a source needs to be converted to an extracted clip
   * 
   * @param sourcePath The source file path
   * @param startTime Trim start time
   * @param endTime Trim end time
   * @returns boolean True if conversion is needed
   */
  function needsConversion(sourcePath: string, startTime: number, endTime: number): boolean {
    // If no trim parameters, no conversion needed
    if (startTime === 0 && endTime === null) {
      return false;
    }

    // Check if we already have an extracted clip
    const existingClip = Array.from(extractedClips.value.values()).find(
      clip => clip.sourcePath === sourcePath && 
              Math.abs(clip.startTime - startTime) < 0.1 && 
              Math.abs(clip.endTime - endTime) < 0.1
    );

    return !existingClip;
  }

  /**
   * Get the effective file path for a source (clip or proxy)
   * 
   * @param sourceId Source ID
   * @param sourcePath Original source path
   * @param startTime Trim start time
   * @param endTime Trim end time
   * @returns string The effective file path to use
   */
  function getEffectivePath(
    sourceId: string,
    sourcePath: string,
    startTime: number,
    endTime: number
  ): string {
    // First check if we have an extracted clip
    const existingClip = Array.from(extractedClips.value.values()).find(
      clip => clip.sourcePath === sourcePath && 
              Math.abs(clip.startTime - startTime) < 0.1 && 
              Math.abs(clip.endTime - endTime) < 0.1
    );

    if (existingClip) {
      return existingClip.clipPath;
    }

    // Fall back to proxy workflow
    const proxyPath = proxyWorkflow.getEffectivePathWithOffset?.(sourceId, sourcePath, startTime);
    return proxyPath?.path || sourcePath;
  }

  // Computed properties
  const isBusy = computed(() => isExtracting.value);
  const hasError = computed(() => error.value !== null);
  const extractedCount = computed(() => extractedClips.value.size);

  return {
    // State
    isExtracting: readonly(isExtracting),
    extractionProgress: readonly(extractionProgress),
    extractedClips: readonly(extractedClips),
    error: readonly(error),
    
    // Computed
    isBusy,
    hasError,
    extractedCount,
    
    // Methods
    extractClip,
    convertSourceToClip,
    deleteClip,
    needsConversion,
    getEffectivePath,
  };
}
