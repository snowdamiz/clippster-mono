import { invoke } from '@tauri-apps/api/core';

export interface StoragePaths {
  base: string;
  clips: string;
  videos: string;
  thumbnails: string;
  intros: string;
  outros: string;
  temp: string;
}

let cachedPaths: StoragePaths | null = null;

/**
 * Get the storage paths for the application
 * Results are cached after the first call
 */
export async function getStoragePaths(): Promise<StoragePaths> {
  if (cachedPaths) {
    return cachedPaths;
  }

  try {
    const paths = await invoke<StoragePaths>('get_storage_paths');
    cachedPaths = paths;
    return paths;
  } catch (error) {
    throw error;
  }
}

/**
 * Clear the cached storage paths
 * Useful for testing or if paths need to be refreshed
 */
export function clearStorageCache(): void {
  cachedPaths = null;
}

/**
 * Get a specific storage path by type
 */
export async function getStoragePath(type: keyof StoragePaths): Promise<string> {
  const paths = await getStoragePaths();
  return paths[type];
}
