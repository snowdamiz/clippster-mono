import type { Blueprint, BlueprintShot, Candidate, EditFormat, MediaItem, SourceSegment } from '../types';

const OPTIONS_PER_SHOT = 4;
const SHOT_SCALE = ['extreme-wide', 'aerial', 'wide', 'medium', 'close-up', 'extreme-close-up', 'insert'];
const QUALITY_FACTOR: Record<string, number> = { good: 1, soft: 0.6, shaky: 0.5, dark: 0.55, overexposed: 0.55, unusable: 0 };

/** Output size and frame rate that follow the example's aspect ratio. */
export function outputFormat(example: Pick<Blueprint, 'width' | 'height' | 'fps'>): EditFormat {
  const ratio = example.width > 0 && example.height > 0 ? example.width / example.height : 16 / 9;
  const fps = [24, 25].includes(Math.round(example.fps)) ? Math.round(example.fps) : 30;
  if (ratio < 0.7) return { width: 1080, height: 1920, fps };
  if (ratio < 0.9) return { width: 1080, height: 1350, fps };
  if (ratio < 1.2) return { width: 1080, height: 1080, fps };
  return { width: 1920, height: 1080, fps };
}

function shotTypeScore(wanted: string | undefined, actual: string | undefined): number {
  if (!wanted || !actual) return 0.4;
  if (wanted === actual) return 1;
  const a = SHOT_SCALE.indexOf(wanted);
  const b = SHOT_SCALE.indexOf(actual);
  return a >= 0 && b >= 0 && Math.abs(a - b) === 1 ? 0.6 : 0.15;
}

function similarity(a: number, b: number): number {
  return 1 - Math.min(1, Math.abs(a - b));
}

function score(shot: BlueprintShot, segment: SourceSegment, isPhoto: boolean, length: number): number {
  const quality = QUALITY_FACTOR[segment.quality ?? 'good'] ?? 1;
  if (quality === 0) return 0;
  const label = shot.label ?? {};
  const camera = label.camera && segment.camera ? (label.camera === segment.camera ? 1 : 0.3) : 0.4;
  // A photo can take any move, so its stillness counts less against a moving example shot.
  const motion = isPhoto ? 0.6 : similarity(shot.motion, segment.motion);
  const fit = isPhoto ? 1 : Math.min(1, length / Math.max(shot.duration, 0.1));
  const value =
    shotTypeScore(label.shotType, segment.shotType) * 3 +
    camera * 1 +
    motion * 2 +
    similarity(shot.brightness, segment.brightness) * 1 +
    similarity(shot.saturation, segment.saturation) * 0.5 +
    (segment.hero ?? 0.5) * (label.role === 'hero' || label.role === 'hook' ? 2 : 0.8) +
    fit * 2;
  return Math.round(value * quality * 100) / 100;
}

/**
 * The best-matching source segments for every example shot, ranked. Opus makes the final picks;
 * this only narrows hundreds of segments to a handful per shot.
 */
export function buildCandidates(blueprint: Blueprint, media: MediaItem[], sources: Record<string, SourceSegment[]>) {
  const items = new Map(media.map((item) => [item.id, item]));
  const pool = Object.entries(sources).flatMap(([mediaId, segments]) => {
    const item = items.get(mediaId);
    if (!item || item.kind === 'audio') return [];
    return segments.map((segment) => ({ item, segment }));
  });

  return blueprint.shots.map((shot) => {
    const options: Candidate[] = pool
      .map(({ item, segment }) => {
        const isPhoto = item.kind === 'photo';
        const length = isPhoto ? Number.POSITIVE_INFINITY : Math.max(0, item.duration - segment.start);
        return {
          mediaId: item.id,
          sourceIn: segment.start,
          maxDuration: isPhoto ? 60 : Math.round(length * 1000) / 1000,
          score: score(shot, segment, isPhoto, isPhoto ? shot.duration : segment.end - segment.start),
          description: segment.description ?? '',
        };
      })
      .filter((option) => option.score > 0)
      .sort((a, b) => b.score - a.score || a.mediaId.localeCompare(b.mediaId) || a.sourceIn - b.sourceIn)
      .slice(0, OPTIONS_PER_SHOT);
    return { refShot: shot.index, duration: shot.duration, options };
  });
}
