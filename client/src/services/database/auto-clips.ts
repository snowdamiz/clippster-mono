import { getClipsByProjectId } from './clips';
import { createManualClip } from './manual-clips';

import { isShortVideoAutoClipEligible } from '@clippster/shared-types';
export { SHORT_VIDEO_CLIP_THRESHOLD_SECONDS, isShortVideoAutoClipEligible } from '@clippster/shared-types';

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
