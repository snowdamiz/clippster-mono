import { invoke } from '@tauri-apps/api/core';

/**
 * Project Cache Metadata
 * Tracks all cached resources for a project (proxies, waveforms, frames)
 */
interface ProjectCacheMetadata {
  projectId: string;
  createdAt: number;
  lastAccessedAt: number;
  exported: boolean;
  proxyFiles: string[];
  waveformCacheKeys: string[];
  framesCached: boolean;
}

const DB_NAME = 'project-cache-manager';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

/**
 * Project Cache Manager
 * 
 * Manages cache lifecycle for video editor projects:
 * - Tracks proxy files, waveform data, and decoded frames per project
 * - Persists caches from first open until export
 * - Clears all caches when project is exported
 * 
 * Usage:
 * ```ts
 * // On project open
 * await projectCacheManager.registerProject(projectId);
 * 
 * // Track resources
 * await projectCacheManager.addProxyFile(projectId, proxyPath);
 * 
 * // On export
 * await projectCacheManager.markAsExported(projectId);
 * await projectCacheManager.clearProjectCache(projectId);
 * ```
 */
class ProjectCacheManager {
  private db: IDBDatabase | null = null;

  /**
   * Initialize IndexedDB connection
   */
  async initialize(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[ProjectCacheManager] Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'projectId' });
        }
      };
    });
  }

  /**
   * Register a project for cache tracking
   * Creates metadata if new, updates lastAccessedAt if existing
   */
  async registerProject(projectId: string): Promise<void> {
    await this.initialize();
    if (!this.db) return;

    const existing = await this.getProjectMetadata(projectId);
    if (existing && !existing.exported) {
      // Update last accessed time
      existing.lastAccessedAt = Date.now();
      await this.saveProjectMetadata(existing);
      console.log(`[ProjectCacheManager] Project ${projectId} accessed, cache will persist`);
      return;
    }

    // Create new metadata
    const metadata: ProjectCacheMetadata = {
      projectId,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      exported: false,
      proxyFiles: [],
      waveformCacheKeys: [],
      framesCached: false,
    };

    await this.saveProjectMetadata(metadata);
    console.log(`[ProjectCacheManager] Project ${projectId} registered for cache tracking`);
  }

  /**
   * Mark project as exported (triggers cache cleanup eligibility)
   */
  async markAsExported(projectId: string): Promise<void> {
    const metadata = await this.getProjectMetadata(projectId);
    if (!metadata) return;

    metadata.exported = true;
    await this.saveProjectMetadata(metadata);
    console.log(`[ProjectCacheManager] Project ${projectId} marked as exported`);
  }

  /**
   * Check if project cache should be cleared (after export)
   */
  async shouldClearCache(projectId: string): Promise<boolean> {
    const metadata = await this.getProjectMetadata(projectId);
    return metadata?.exported ?? false;
  }

  /**
   * Add a proxy file path to project tracking
   */
  async addProxyFile(projectId: string, proxyPath: string): Promise<void> {
    const metadata = await this.getProjectMetadata(projectId);
    if (!metadata) {
      console.warn(`[ProjectCacheManager] Project ${projectId} not registered, cannot track proxy`);
      return;
    }

    if (!metadata.proxyFiles.includes(proxyPath)) {
      metadata.proxyFiles.push(proxyPath);
      await this.saveProjectMetadata(metadata);
      console.log(`[ProjectCacheManager] Proxy tracked for ${projectId}: ${proxyPath}`);
    }
  }

  /**
   * Add a waveform cache key to project tracking
   */
  async addWaveformCacheKey(projectId: string, cacheKey: string): Promise<void> {
    const metadata = await this.getProjectMetadata(projectId);
    if (!metadata) {
      console.warn(`[ProjectCacheManager] Project ${projectId} not registered, cannot track waveform`);
      return;
    }

    if (!metadata.waveformCacheKeys.includes(cacheKey)) {
      metadata.waveformCacheKeys.push(cacheKey);
      await this.saveProjectMetadata(metadata);
    }
  }

  /**
   * Mark that frames have been cached for this project
   */
  async markFramesCached(projectId: string): Promise<void> {
    const metadata = await this.getProjectMetadata(projectId);
    if (!metadata) return;

    metadata.framesCached = true;
    await this.saveProjectMetadata(metadata);
  }

  /**
   * Clear all caches for a project (proxy files, waveforms, frames)
   * Called after export completion
   */
  async clearProjectCache(projectId: string): Promise<void> {
    const metadata = await this.getProjectMetadata(projectId);
    if (!metadata) {
      console.log(`[ProjectCacheManager] No cache metadata for project ${projectId}`);
      return;
    }

    console.log(`[ProjectCacheManager] Clearing cache for project ${projectId}:`, {
      proxyFiles: metadata.proxyFiles.length,
      waveformKeys: metadata.waveformCacheKeys.length,
      framesCached: metadata.framesCached,
    });

    // Delete proxy files from disk
    for (const proxyPath of metadata.proxyFiles) {
      try {
        await invoke('delete_file', { path: proxyPath });
        console.log(`[ProjectCacheManager] Deleted proxy: ${proxyPath}`);
      } catch (error) {
        console.warn(`[ProjectCacheManager] Failed to delete proxy ${proxyPath}:`, error);
      }
    }

    // Clear waveform cache keys
    if (metadata.waveformCacheKeys.length > 0) {
      try {
        const { waveformService } = await import('./waveformService');
        for (const key of metadata.waveformCacheKeys) {
          await waveformService.clearCache(key);
        }
        console.log(`[ProjectCacheManager] Cleared ${metadata.waveformCacheKeys.length} waveform caches`);
      } catch (error) {
        console.warn('[ProjectCacheManager] Failed to clear waveform caches:', error);
      }
    }

    // Clear frame cache (WebCodecs frames cannot be persisted, but we track the flag)
    if (metadata.framesCached) {
      console.log(`[ProjectCacheManager] Frame cache will be cleared on next editor open`);
    }

    // Remove metadata
    await this.deleteProjectMetadata(projectId);
    console.log(`[ProjectCacheManager] ✅ All caches cleared for project ${projectId}`);
  }

  /**
   * Get project metadata from IndexedDB
   */
  private async getProjectMetadata(projectId: string): Promise<ProjectCacheMetadata | null> {
    if (!this.db) await this.initialize();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(projectId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save project metadata to IndexedDB
   */
  private async saveProjectMetadata(metadata: ProjectCacheMetadata): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(metadata);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete project metadata from IndexedDB
   */
  private async deleteProjectMetadata(projectId: string): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(projectId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Singleton instance
export const projectCacheManager = new ProjectCacheManager();
