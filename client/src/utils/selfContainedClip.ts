/**
 * Helpers for auto/manual livestream clips whose extracted MP4 is the playable
 * source (0-based timeline), as opposed to VOD clips that reference a segment
 * of a longer project video.
 */

export function normalizePathForCompare(path: string): string {
  return path.replace(/\\/g, '/').replace(/^file:\/\//, '').toLowerCase();
}

export function isAutoOrManualLiveClip(clip: { session_prompt?: string | null } | null | undefined): boolean {
  if (!clip) return false;
  const prompt = String(clip.session_prompt || '').toLowerCase();
  return prompt === 'manual clip creation' || prompt.includes('auto');
}

/** True when file_path points at a prior build output, not the original source. */
export function isClipBuildOutputPath(filePath: string | null | undefined): boolean {
  if (!filePath) return false;
  const normalizedPath = normalizePathForCompare(filePath);
  const fileName = normalizedPath.split('/').pop() || '';

  return (
    normalizedPath.includes('/clips/project_') ||
    normalizedPath.includes('/run-') ||
    normalizedPath.includes('/manual-builds/') ||
    /_\d+-\d+_\d+\.(mp4|mov)$/.test(fileName)
  );
}

export type ClipForSourceResolution = {
  id?: string;
  file_path?: string | null;
  session_prompt?: string | null;
  project_id?: string | null;
  current_version_start_time?: number | null;
  current_version_end_time?: number | null;
  start_time?: number | null;
  end_time?: number | null;
  duration?: number | null;
  current_version_segments?: Array<{ duration?: number; start_time?: number; end_time?: number }>;
};

export function isSelfContainedClip(clip: ClipForSourceResolution | null | undefined): boolean {
  if (!clip) return false;
  const filePath = typeof clip.file_path === 'string' ? clip.file_path.trim() : '';
  if (!filePath || isClipBuildOutputPath(filePath)) return false;
  return isAutoOrManualLiveClip(clip) && isExtractedLiveClipFilePath(filePath);
}

export function getSelfContainedClipDuration(clip: ClipForSourceResolution): number {
  if (clip.current_version_segments && clip.current_version_segments.length > 0) {
    return clip.current_version_segments.reduce((total, segment) => {
      const segDuration =
        Number(segment.duration) || Number(segment.end_time) - Number(segment.start_time);
      return total + Math.max(0, segDuration || 0);
    }, 0);
  }

  const startTime = clip.current_version_start_time ?? clip.start_time ?? 0;
  const endTime = clip.current_version_end_time ?? clip.end_time ?? 0;
  if (endTime > startTime) return endTime - startTime;
  return clip.duration || 0;
}

/** Path for publish / POI when the clip owns an extracted file. */
export function resolveClipPublishPath(
  clip: ClipForSourceResolution | null | undefined,
  fallbackProjectVideoPath?: string | null
): string {
  const clipOwn = typeof clip?.file_path === 'string' ? clip.file_path.trim() : '';
  if (clipOwn && !isClipBuildOutputPath(clipOwn)) {
    if (isSelfContainedClip(clip) || isExtractedLiveClipFilePath(clipOwn)) {
      return clipOwn;
    }
  }
  return fallbackProjectVideoPath?.trim() || clipOwn || '';
}

function isExtractedLiveClipFilePath(filePath: string): boolean {
  const normalized = normalizePathForCompare(filePath);
  return normalized.includes('/clips/') && !normalized.includes('livestream_recordings');
}

export interface ClipVideoSourceInfo {
  filePath: string;
  frameTimestamp: number;
  isSelfContained: boolean;
}

/**
 * Resolve which file ManualPOIEditor / build preview should use, and where the
 * first frame lives in that file.
 */
export async function resolveClipVideoSourceForPreview(
  clip: ClipForSourceResolution & { id: string },
  projectId?: string | null
): Promise<ClipVideoSourceInfo | null> {
  const clipFilePath = typeof clip.file_path === 'string' ? clip.file_path.trim() : '';

  if (isSelfContainedClip(clip) && clipFilePath) {
    return { filePath: clipFilePath, frameTimestamp: 1, isSelfContained: true };
  }

  const pid = projectId || clip.project_id;
  if (!pid) {
    if (clipFilePath && !isClipBuildOutputPath(clipFilePath)) {
      return { filePath: clipFilePath, frameTimestamp: 1, isSelfContained: true };
    }
    return null;
  }

  const { getRawVideosByProjectId } = await import('@/services/database');
  const rawVideos = await getRawVideosByProjectId(pid);
  if (rawVideos.length === 0) {
    if (clipFilePath && !isClipBuildOutputPath(clipFilePath)) {
      return { filePath: clipFilePath, frameTimestamp: 1, isSelfContained: true };
    }
    return null;
  }

  const clipOwnedRaw = rawVideos.find((rv) => rv.source_clip_id === clip.id);
  if (clipOwnedRaw) {
    return { filePath: clipOwnedRaw.file_path, frameTimestamp: 1, isSelfContained: true };
  }

  if (clipFilePath && !isClipBuildOutputPath(clipFilePath)) {
    const targetPath = normalizePathForCompare(clipFilePath);
    const matchingRawVideo = rawVideos.find((rv) => normalizePathForCompare(rv.file_path) === targetPath);

    if (matchingRawVideo) {
      const extractedFile = isExtractedLiveClipFilePath(clipFilePath);
      if (extractedFile) {
        return { filePath: matchingRawVideo.file_path, frameTimestamp: 1, isSelfContained: true };
      }

      const startTime = clip.current_version_start_time ?? clip.start_time ?? 0;
      return {
        filePath: matchingRawVideo.file_path,
        frameTimestamp: startTime + 1,
        isSelfContained: false,
      };
    }

    // Clip has its own file on disk but no raw_video row yet — still use it 0-based.
    return { filePath: clipFilePath, frameTimestamp: 1, isSelfContained: true };
  }

  const startTime = clip.current_version_start_time ?? clip.start_time ?? 0;
  return {
    filePath: rawVideos[0].file_path,
    frameTimestamp: startTime + 1,
    isSelfContained: false,
  };
}
