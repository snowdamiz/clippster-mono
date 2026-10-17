/**
 * Export / save helpers for AI Image Creator results.
 * "Workable file" = editable Image Editor project document (PSD-like).
 */

import {
  acceptEditableThumbnail,
  acceptQuickThumbnail,
} from '@/services/thumbnailRecipeAssemble';
import { flushAndSerializeActiveImageProject } from '@/editor/bridge/image-project-document';

function isDesktopRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const candidate = window as unknown as Record<string, unknown>;
  return '__TAURI_INTERNALS__' in candidate || '__TAURI__' in candidate;
}

function sanitizeFilename(name: string, ext: string): string {
  const base = name.replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'ai-image';
  return base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`;
}

async function fetchBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch image (${response.status})`);
  return response.blob();
}

async function writeBytesToDisk(bytes: Uint8Array, defaultPath: string, filters: { name: string; extensions: string[] }[]) {
  if (isDesktopRuntime()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const path = await save({
      title: 'Save file',
      defaultPath,
      filters,
    });
    if (!path) return null;
    await writeFile(path, bytes);
    return path;
  }

  const blobForBrowser = new Blob([bytes]);
  const objectUrl = URL.createObjectURL(blobForBrowser);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = defaultPath;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
  return defaultPath;
}

export async function exportImageToDisk(opts: {
  imageUrl: string;
  name?: string;
}): Promise<string | null> {
  const blob = await fetchBlob(opts.imageUrl);
  const filename = sanitizeFilename(opts.name || 'ai-image', 'png');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return writeBytesToDisk(bytes, filename, [{ name: 'PNG Image', extensions: ['png'] }]);
}

export async function saveImageLocally(opts: {
  imageUrl: string;
  name?: string;
  canvasWidth?: number;
  canvasHeight?: number;
}): Promise<{ assetId: string; filePath: string }> {
  return acceptQuickThumbnail({
    imageUrl: opts.imageUrl,
    name: opts.name || 'AI Image',
    canvasWidth: opts.canvasWidth,
    canvasHeight: opts.canvasHeight,
  });
}

export async function createWorkableImageProject(opts: {
  imageUrl: string;
  name?: string;
  canvasWidth?: number;
  canvasHeight?: number;
  recipe?: Parameters<typeof acceptEditableThumbnail>[0]['recipe'];
}): Promise<{ backendProjectId: number; assetId: string; project: unknown }> {
  const result = await acceptEditableThumbnail({
    plateUrl: opts.imageUrl,
    recipe: opts.recipe ?? null,
    name: opts.name || 'AI Image',
    canvasWidth: opts.canvasWidth,
    canvasHeight: opts.canvasHeight,
  });

  const doc = await flushAndSerializeActiveImageProject();
  return {
    backendProjectId: result.backendProjectId,
    assetId: result.assetId,
    project: doc,
  };
}

export async function saveWorkableImageFile(opts: {
  imageUrl: string;
  name?: string;
  canvasWidth?: number;
  canvasHeight?: number;
  recipe?: Parameters<typeof acceptEditableThumbnail>[0]['recipe'];
}): Promise<{ backendProjectId: number; assetId: string; filePath: string | null }> {
  const result = await createWorkableImageProject(opts);

  const payload = {
    format: 'clippster-image-project',
    version: 1,
    backendProjectId: result.backendProjectId,
    project: result.project,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload, null, 2));
  const filename = sanitizeFilename(opts.name || 'ai-image', 'clipimg.json');
  const filePath = await writeBytesToDisk(bytes, filename, [
    { name: 'Clippster Image Project', extensions: ['clipimg.json', 'json'] },
  ]);

  return {
    backendProjectId: result.backendProjectId,
    assetId: result.assetId,
    filePath,
  };
}
