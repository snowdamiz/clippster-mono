import * as FileSystem from 'expo-file-system/legacy';

function playableSiblingPath(path: string): string | null {
  if (path.endsWith('.play.mp4')) return null;
  return path.replace(/\.[^./]+$/, '') + '.play.mp4';
}

function originalSiblingFromPlayable(path: string): string | null {
  if (!path.endsWith('.play.mp4')) return null;
  return path.replace(/\.play\.mp4$/, '.mp4');
}

export function isDeletableLocalPath(path: string | null | undefined): path is string {
  if (!path) return false;
  if (
    path.startsWith('pending://') ||
    path.startsWith('clip://') ||
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('content://')
  ) {
    return false;
  }
  return true;
}

/** Delete a local media path and any faststart remux sibling (.play.mp4 / original). */
export async function deleteLocalMediaFile(path: string | null | undefined): Promise<void> {
  if (!isDeletableLocalPath(path)) return;

  const candidates = new Set<string>([path]);
  const playable = playableSiblingPath(path);
  if (playable) candidates.add(playable);
  const original = originalSiblingFromPlayable(path);
  if (original) candidates.add(original);

  for (const candidate of candidates) {
    try {
      await FileSystem.deleteAsync(candidate, { idempotent: true });
    } catch {
      // File may already be gone.
    }
  }
}
