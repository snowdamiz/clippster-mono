import { SUPPORTED_TARGET_ASPECT_RATIOS } from '@/lib/creatorClipBuildDefaults';
import type { AspectRatio, Blueprint, EditFormat, MediaItem } from '../types';

export const ASPECT_RATIOS = SUPPORTED_TARGET_ASPECT_RATIOS;

const SIZES: Record<AspectRatio, Pick<EditFormat, 'width' | 'height'>> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
};

export function nearestAspect(width: number, height: number): AspectRatio {
  const ratio = width > 0 && height > 0 ? width / height : 16 / 9;
  if (ratio < 0.7) return '9:16';
  if (ratio < 0.9) return '4:5';
  if (ratio < 1.2) return '1:1';
  return '16:9';
}

/** The shape most of the user's clips and photos have, or 16:9 without any. */
export function mediaAspect(media: MediaItem[]): AspectRatio {
  const counts = new Map<AspectRatio, number>();
  for (const item of media) {
    if (item.kind === 'audio' || !item.width || !item.height) continue;
    const aspect = nearestAspect(item.width, item.height);
    counts.set(aspect, (counts.get(aspect) ?? 0) + 1);
  }
  let best: AspectRatio = '16:9';
  for (const [aspect, count] of counts) if (count > (counts.get(best) ?? 0)) best = aspect;
  return best;
}

export function aspectFormat(aspect: AspectRatio, fps = 30): EditFormat {
  return { ...SIZES[aspect], fps };
}

/** Output size and frame rate that follow the example's aspect ratio. */
export function outputFormat(example: Pick<Blueprint, 'width' | 'height' | 'fps'>): EditFormat {
  return aspectFormat(
    nearestAspect(example.width, example.height),
    [24, 25].includes(Math.round(example.fps)) ? Math.round(example.fps) : 30
  );
}
