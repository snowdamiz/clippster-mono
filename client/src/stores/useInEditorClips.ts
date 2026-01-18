import { defineStore } from 'pinia';
import { invoke } from '@tauri-apps/api/core';
import { getStoragePaths } from '@/services/storage';

export type InEditorOrigin = 'project' | 'other';

export interface InEditorClipEntry {
  clipId: string;
  projectId?: string | null;
  projectNameSnapshot?: string | null;
  origin: InEditorOrigin;
  assetPath?: string | null;
  createdAt: number;
}

interface State {
  entries: InEditorClipEntry[];
  hydrated: boolean;
}

const STORAGE_KEY = 'in-editor-clips';

function loadFromStorage(): InEditorClipEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((e) => e && e.clipId);
  } catch (err) {
    console.warn('[useInEditorClips] Failed to hydrate', err);
  }
  return [];
}

function saveToStorage(entries: InEditorClipEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    console.warn('[useInEditorClips] Failed to persist', err);
  }
}

async function ensureSafeAssetPath(clipId: string, assetPath?: string | null): Promise<string | null> {
  if (!assetPath) return null;
  // If this looks like a URL or data URL, just keep it
  if (assetPath.startsWith('http://') || assetPath.startsWith('https://') || assetPath.startsWith('data:')) {
    return assetPath;
  }
  const ext = (() => {
    const match = assetPath.match(/(\.[^./\\]+)$/);
    return match ? match[1] : '.mp4';
  })();

  // Verify file exists before copying
  try {
    const exists = await invoke<boolean>('check_file_exists', { path: assetPath });
    if (!exists) return assetPath;
  } catch (err) {
    console.warn('[useInEditorClips] check_file_exists failed, keeping original assetPath', err);
    return assetPath;
  }

  // Place copy into stable clips directory if not already under storage base
  try {
    const paths = await getStoragePaths();
    const normalizedAsset = assetPath.replace(/\\/g, '/');
    const normalizedBase = paths.base.replace(/\\/g, '/');
    if (normalizedAsset.startsWith(normalizedBase)) {
      return assetPath; // already in app storage
    }

    const destination = `${paths.clips}/in_editor_${clipId}_${Date.now()}${ext}`;
    await invoke<string>('copy_clip_to_destination', {
      sourcePath: assetPath,
      destinationPath: destination,
    });
    return destination;
  } catch (err) {
    console.warn('[useInEditorClips] Failed to copy asset to safe directory', err);
    return assetPath;
  }
}

export const useInEditorClips = defineStore('inEditorClips', {
  state: (): State => ({
    entries: loadFromStorage(),
    hydrated: true,
  }),
  getters: {
    isInEditor: (state) => (clipId: string) => state.entries.some((e) => e.clipId === clipId),
    list: (state) => (filter?: { projectId?: string | null }) => {
      if (!filter?.projectId) return state.entries;
      return state.entries.filter((e) => e.projectId === filter.projectId);
    },
  },
  actions: {
    hydrate() {
      if (this.hydrated) return;
      this.entries = loadFromStorage();
      this.hydrated = true;
    },
    persist() {
      saveToStorage(this.entries);
    },
    async addClip(payload: {
      clipId: string;
      projectId?: string | null;
      projectNameSnapshot?: string | null;
      origin?: InEditorOrigin;
      assetPath?: string | null;
    }) {
      const origin: InEditorOrigin = payload.origin ?? 'project';
      const safeAssetPath = await ensureSafeAssetPath(payload.clipId, payload.assetPath);
      const existingIdx = this.entries.findIndex((e) => e.clipId === payload.clipId);
      const entry: InEditorClipEntry = {
        clipId: payload.clipId,
        projectId: payload.projectId ?? null,
        projectNameSnapshot: payload.projectNameSnapshot ?? null,
        origin,
        assetPath: safeAssetPath,
        createdAt: existingIdx >= 0 ? this.entries[existingIdx].createdAt : Date.now(),
      };

      if (existingIdx >= 0) {
        this.entries.splice(existingIdx, 1, entry);
      } else {
        this.entries.unshift(entry);
      }
      this.persist();
      return entry;
    },
    clearClip(clipId: string) {
      const before = this.entries.length;
      this.entries = this.entries.filter((e) => e.clipId !== clipId);
      if (this.entries.length !== before) this.persist();
    },
    clearMany(clipIds: string[]) {
      if (!clipIds.length) return;
      const set = new Set(clipIds);
      const before = this.entries.length;
      this.entries = this.entries.filter((e) => !set.has(e.clipId));
      if (this.entries.length !== before) this.persist();
    },
    updateAssetPath(clipId: string, assetPath?: string | null) {
      const idx = this.entries.findIndex((e) => e.clipId === clipId);
      if (idx === -1) return;
      this.entries[idx].assetPath = assetPath ?? this.entries[idx].assetPath;
      this.persist();
    },
    /**
     * Validate that an in-editor clip's asset path exists.
     * Returns { valid: true } if the asset exists or is a URL/data URL.
     * Returns { valid: false, error: string } if the asset is missing.
     */
    async validateAssetPath(clipId: string): Promise<{ valid: boolean; error?: string }> {
      const entry = this.entries.find((e) => e.clipId === clipId);
      if (!entry) {
        return { valid: false, error: 'Clip not found in in-editor tracking' };
      }
      if (!entry.assetPath) {
        return { valid: false, error: 'No asset path stored for this clip' };
      }
      // URLs and data URLs are always considered valid
      if (
        entry.assetPath.startsWith('http://') ||
        entry.assetPath.startsWith('https://') ||
        entry.assetPath.startsWith('data:')
      ) {
        return { valid: true };
      }
      // Check if file exists
      try {
        const exists = await invoke<boolean>('check_file_exists', { path: entry.assetPath });
        if (!exists) {
          return {
            valid: false,
            error: `Asset file not found: ${entry.assetPath}. The source project may have been deleted.`,
          };
        }
        return { valid: true };
      } catch (err) {
        return {
          valid: false,
          error: `Failed to verify asset path: ${err}`,
        };
      }
    },
    /**
     * Get entry for a clip.
     */
    getEntry(clipId: string): InEditorClipEntry | undefined {
      return this.entries.find((e) => e.clipId === clipId);
    },
  },
});
