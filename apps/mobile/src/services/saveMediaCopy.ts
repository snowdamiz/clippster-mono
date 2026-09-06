import { Directory, File } from 'expo-file-system';

function toFileUri(path: string): string {
  if (path.startsWith('file://') || path.startsWith('content://')) return path;
  return `file://${path}`;
}

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim();
  return cleaned.length > 0 ? cleaned : 'clip.mp4';
}

export type SaveMediaCopyResult = 'saved' | 'cancelled';

/**
 * Prompt the user to pick a folder, then copy the media file there.
 * Uses the system directory picker (Android SAF / iOS Files).
 */
export async function saveMediaCopyToPickedFolder(
  sourcePath: string,
  suggestedFileName: string,
): Promise<SaveMediaCopyResult> {
  const sourceUri = toFileUri(sourcePath);
  const fileName = sanitizeFileName(
    suggestedFileName.toLowerCase().endsWith('.mp4')
      ? suggestedFileName
      : `${suggestedFileName}.mp4`,
  );

  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/cancel|dismiss|abort|denied/i.test(message)) return 'cancelled';
    throw error;
  }

  const source = new File(sourceUri);
  if (!source.exists) {
    throw new Error('Source video file was not found.');
  }

  const destination = directory.createFile(fileName, 'video/mp4');
  await source.copy(destination, { overwrite: true });
  return 'saved';
}
