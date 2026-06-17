import { getClipsByProjectId } from './clips';
import { createManualClip } from './manual-clips';

/** Videos shorter than this are auto-imported as a single full-length clip. */
export const SHORT_VIDEO_CLIP_THRESHOLD_SECONDS = 90;

export function isShortVideoAutoClipEligible(
  duration: number | null | undefined
): boolean {
  if (duration == null || !Number.isFinite(duration)) {
    return false;
  }
  return duration > 0 && duration < SHORT_VIDEO_CLIP_THRESHOLD_SECONDS;
}

/**
 * For project videos under 90s, create one manual clip spanning the full timeline.
 * Skips if the project already has clips.
 */
export async function ensureShortVideoAutoClip(
  projectId: string,
  duration: number | null | undefined,
  options?: { clipName?: string }
): Promise<string | null> {
  if (!projectId || !isShortVideoAutoClipEligible(duration)) {
    return null;
  }

  const dur = duration as number;
  const existing = await getClipsByProjectId(projectId);
  if (existing.length > 0) {
    return existing[0]?.id ?? null;
  }

  const clipId = await createManualClip(projectId, {
    name: options?.clipName?.trim() || 'Clip',
    startTime: 0,
    endTime: dur,
    description: 'Auto-created from short video (full length)',
  });

  window.dispatchEvent(
    new CustomEvent('refresh-clips-projects', {
      detail: { projectId },
    })
  );

  return clipId;
}
