import { defineStore } from 'pinia';
import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';

/**
 * Persistent thumbnail cache store
 * Maintains clip and build thumbnail data URLs across component mounts/unmounts
 */
export const useClipThumbnailStore = defineStore('clipThumbnails', () => {
  // Map of clipId -> data URL
  const thumbnailCache = ref<Map<string, string>>(new Map());
  
  // Map of buildId or filePath -> data URL for build-specific thumbnails
  const buildThumbnailCache = ref<Map<string, string>>(new Map());

  // Track which thumbnails are currently being loaded to prevent duplicates
  const loadingThumbnails = ref<Set<string>>(new Set());

  /**
   * Get a thumbnail from cache
   */
  function getThumbnail(clipId: string): string | null {
    return thumbnailCache.value.get(clipId) || null;
  }

  /**
   * Check if a thumbnail exists in cache
   */
  function hasThumbnail(clipId: string): boolean {
    return thumbnailCache.value.has(clipId);
  }

  /**
   * Check if a thumbnail is currently being loaded
   */
  function isLoading(clipId: string): boolean {
    return loadingThumbnails.value.has(clipId);
  }

  /**
   * Load a single thumbnail from disk and cache it
   */
  async function loadThumbnail(clipId: string, thumbnailPath: string): Promise<string | null> {
    // Return cached if available
    if (thumbnailCache.value.has(clipId)) {
      return thumbnailCache.value.get(clipId)!;
    }

    // Skip if already loading
    if (loadingThumbnails.value.has(clipId)) {
      return null;
    }

    try {
      loadingThumbnails.value.add(clipId);

      const dataUrl = await invoke<string>('read_file_as_data_url', {
        filePath: thumbnailPath,
      });

      thumbnailCache.value.set(clipId, dataUrl);
      
      // Trigger Vue reactivity
      thumbnailCache.value = new Map(thumbnailCache.value);

      return dataUrl;
    } catch (error) {
      console.warn(`[ClipThumbnailStore] Failed to load thumbnail for clip ${clipId}:`, error);
      return null;
    } finally {
      loadingThumbnails.value.delete(clipId);
    }
  }

  /**
   * Load multiple thumbnails in parallel (batched)
   */
  async function loadThumbnails(
    clips: Array<{ id: string; built_thumbnail_path: string | null }>
  ): Promise<void> {
    const clipsToLoad = clips.filter(
      (clip) =>
        clip.built_thumbnail_path &&
        !thumbnailCache.value.has(clip.id) &&
        !loadingThumbnails.value.has(clip.id)
    );

    if (clipsToLoad.length === 0) return;

    const batchSize = 5;
    let hasNewThumbnails = false;

    for (let i = 0; i < clipsToLoad.length; i += batchSize) {
      const batch = clipsToLoad.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (clip) => {
          try {
            loadingThumbnails.value.add(clip.id);

            const dataUrl = await invoke<string>('read_file_as_data_url', {
              filePath: clip.built_thumbnail_path!,
            });

            thumbnailCache.value.set(clip.id, dataUrl);
            hasNewThumbnails = true;
          } catch (error) {
            console.warn(`[ClipThumbnailStore] Failed to load thumbnail for clip ${clip.id}:`, error);
          } finally {
            loadingThumbnails.value.delete(clip.id);
          }
        })
      );
    }

    // Trigger Vue reactivity once per batch
    if (hasNewThumbnails) {
      thumbnailCache.value = new Map(thumbnailCache.value);
    }
  }

  /**
   * Set a thumbnail directly (used after generation)
   */
  function setThumbnail(clipId: string, dataUrl: string): void {
    thumbnailCache.value.set(clipId, dataUrl);
    thumbnailCache.value = new Map(thumbnailCache.value);
  }

  /**
   * Remove a thumbnail from cache
   */
  function removeThumbnail(clipId: string): void {
    if (thumbnailCache.value.has(clipId)) {
      thumbnailCache.value.delete(clipId);
      thumbnailCache.value = new Map(thumbnailCache.value);
    }
  }

  /**
   * Get a build thumbnail from cache (by buildId or filePath)
   */
  function getBuildThumbnail(key: string): string | null {
    return buildThumbnailCache.value.get(key) || null;
  }

  /**
   * Check if a build thumbnail exists in cache
   */
  function hasBuildThumbnail(key: string): boolean {
    return buildThumbnailCache.value.has(key);
  }

  /**
   * Set a build thumbnail directly
   */
  function setBuildThumbnail(key: string, dataUrl: string): void {
    buildThumbnailCache.value.set(key, dataUrl);
    buildThumbnailCache.value = new Map(buildThumbnailCache.value);
  }

  /**
   * Load build thumbnails in parallel (batched)
   */
  async function loadBuildThumbnails(
    builds: Array<{ key: string; thumbnailPath: string }>
  ): Promise<void> {
    const buildsToLoad = builds.filter(
      (build) =>
        !buildThumbnailCache.value.has(build.key) &&
        !loadingThumbnails.value.has(build.key)
    );

    if (buildsToLoad.length === 0) return;

    const batchSize = 5;
    let hasNewThumbnails = false;

    for (let i = 0; i < buildsToLoad.length; i += batchSize) {
      const batch = buildsToLoad.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (build) => {
          try {
            loadingThumbnails.value.add(build.key);

            const dataUrl = await invoke<string>('read_file_as_data_url', {
              filePath: build.thumbnailPath,
            });

            buildThumbnailCache.value.set(build.key, dataUrl);
            hasNewThumbnails = true;
          } catch (error) {
            console.warn(`[ClipThumbnailStore] Failed to load build thumbnail for ${build.key}:`, error);
          } finally {
            loadingThumbnails.value.delete(build.key);
          }
        })
      );
    }

    if (hasNewThumbnails) {
      buildThumbnailCache.value = new Map(buildThumbnailCache.value);
    }
  }

  /**
   * Clear all thumbnails from cache
   */
  function clearCache(): void {
    thumbnailCache.value.clear();
    buildThumbnailCache.value.clear();
    loadingThumbnails.value.clear();
    thumbnailCache.value = new Map();
    buildThumbnailCache.value = new Map();
  }

  /**
   * Clear thumbnails for specific clips
   */
  function clearClips(clipIds: string[]): void {
    let hasChanges = false;
    for (const clipId of clipIds) {
      if (thumbnailCache.value.has(clipId)) {
        thumbnailCache.value.delete(clipId);
        hasChanges = true;
      }
    }
    if (hasChanges) {
      thumbnailCache.value = new Map(thumbnailCache.value);
    }
  }

  return {
    thumbnailCache,
    buildThumbnailCache,
    getThumbnail,
    hasThumbnail,
    isLoading,
    loadThumbnail,
    loadThumbnails,
    setThumbnail,
    removeThumbnail,
    getBuildThumbnail,
    hasBuildThumbnail,
    setBuildThumbnail,
    loadBuildThumbnails,
    clearCache,
    clearClips,
  };
});
