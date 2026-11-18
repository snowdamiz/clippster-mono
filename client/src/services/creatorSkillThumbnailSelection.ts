/** Three nearby VOD frames per draft position give the reviewer sharper local choices. */
export function creatorSkillThumbnailTimes(duration: number): number[] {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  return [0.15, 0.35, 0.60, 0.85].flatMap(center => [-0.025, 0, 0.025].map(offset =>
    Math.max(0, Math.min(duration - 0.05, duration * (center + offset)))));
}

/** Mean local luminance contrast. It detects blur, not faces or expression quality. */
export function creatorSkillFrameSharpness(data: Uint8ClampedArray, width: number, height: number): number {
  if (width < 3 || height < 3 || data.length < width * height * 4) return 0;
  const luminance = (x: number, y: number) => {
    const offset = (y * width + x) * 4;
    return data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
  };
  let contrast = 0, count = 0;
  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      contrast += Math.abs(4 * luminance(x, y) - luminance(x - 1, y) - luminance(x + 1, y) - luminance(x, y - 1) - luminance(x, y + 1));
      count++;
    }
  }
  return count ? contrast / count : 0;
}

type ThumbnailFace = { width: number; height: number; score: number; keypoints?: Array<{ x: number; y: number }> };

/** Favor a large, confident, roughly frontal face, then sharpness within each clip section. */
export function creatorSkillThumbnailFaceScore(sharpness: number, faces: ThumbnailFace[]): number {
  const best = faces.reduce((score, face) => {
    const area = face.width * face.height * face.score;
    if (area <= 0.005) return score;
    const [eyeA, eyeB, nose] = face.keypoints ?? [];
    const eyeSpan = eyeA && eyeB ? Math.hypot(eyeA.x - eyeB.x, eyeA.y - eyeB.y) : 0;
    const yaw = eyeSpan && nose ? Math.abs(nose.x - (eyeA.x + eyeB.x) / 2) / eyeSpan : 0;
    const roll = eyeSpan ? Math.abs(eyeA.y - eyeB.y) / eyeSpan : 0;
    const pose = eyeSpan ? Math.max(0, 1 - Math.max(0, yaw - 0.12) * 2 - Math.max(0, roll - 0.1) * 2) : 0;
    return Math.max(score, 1000 + Math.min(1, area) * 200 + pose * 100);
  }, 0);
  return sharpness + best;
}

/** Keep one candidate from each part of the clip instead of letting one bright scene dominate. */
export function selectCreatorSkillThumbnailStills<T extends { index: number; score: number }>(stills: T[]): T[] {
  return [0, 1, 2, 3].flatMap(group => {
    const candidates = stills.filter(still => Math.floor(still.index / 3) === group);
    return candidates.length ? [candidates.reduce((best, item) => item.score > best.score ? item : best)] : [];
  });
}
