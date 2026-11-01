import type { ManualFramingConfig, ManualRegionRect } from '@/types';
import type { FramingKeyframe } from '../../../../packages/shared-types/src/framingTracking';

export interface FaceBox extends ManualRegionRect {
  score: number;
}
export interface FramingSample {
  time: number;
  faces: FaceBox[];
  cut: boolean;
}
export const autoFramingSourceKey = (path: string, start: number, end: number) =>
  JSON.stringify([path, start, end]);
const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));

/** Keep the whole source height where possible; track people without artificial zoom. */
export function planAutoFraming(
  samples: FramingSample[],
  sourceWidth: number,
  sourceHeight: number,
  ratio: string,
  sourceKey: string
): ManualFramingConfig {
  const [w, h] = ratio.split(':').map(Number);
  if (!(w > 0 && h > 0 && sourceWidth > 0 && sourceHeight > 0) || !samples.length) {
    throw new Error('The video dimensions or duration could not be read.');
  }
  if (!samples.some((s) => s.faces.some((f) => f.score >= 0.6))) {
    throw new Error(
      'No reliable faces were found. Use Manual to frame gameplay, slides, or other subjects.'
    );
  }
  const cropWidth = Math.min(1, w / h / (sourceWidth / sourceHeight));
  const cropHeight = Math.min(1, sourceWidth / sourceHeight / (w / h));
  const points: FramingKeyframe[] = [];
  let subject: FaceBox | undefined;
  let lastSeen = -Infinity;
  let missing = 0,
    crowded = 0;
  for (const sample of samples) {
    if (sample.cut) {
      subject = undefined;
      lastSeen = -Infinity;
    }
    const faces = sample.faces.filter((f) => f.score >= 0.6);
    let x = points[points.length - 1]?.x ?? (1 - cropWidth) / 2;
    let y = points[points.length - 1]?.y ?? (1 - cropHeight) / 2;
    if (faces.length) {
      // Spatial continuity avoids jumping between people on alternating detections.
      const prior = subject;
      subject = [...faces].sort((a, b) => {
        const rank = (f: FaceBox) =>
          (f.width * f.height * f.score) /
          (prior
            ? 0.05 + Math.hypot(f.x + f.width / 2 - prior.x - prior.width / 2, f.y - prior.y)
            : 1);
        return rank(b) - rank(a);
      })[0];
      let centerX = subject.x + subject.width / 2;
      const left = Math.min(...faces.map((f) => f.x)),
        right = Math.max(...faces.map((f) => f.x + f.width));
      if (faces.length > 1 && right - left + 0.06 <= cropWidth) centerX = (left + right) / 2;
      else if (faces.length > 1) crowded++;
      x = clamp(centerX - cropWidth / 2, 1 - cropWidth);
      y = clamp(subject.y + subject.height / 2 - cropHeight * 0.38, 1 - cropHeight);
      lastSeen = sample.time;
    } else {
      missing++;
      // Short detection gaps hold the camera; long gaps and cuts use a stable center.
      if (sample.cut || sample.time - lastSeen > 2) {
        x = (1 - cropWidth) / 2;
        y = (1 - cropHeight) / 2;
      }
    }
    const previous = points[points.length - 1];
    if (previous && !sample.cut) {
      const maxMove = Math.max(0, sample.time - previous.time) * 0.25;
      const smooth = (target: number, before: number) =>
        Math.abs(target - before) < 0.015
          ? before
          : before + Math.max(-maxMove, Math.min(maxMove, (target - before) * 0.65));
      x = smooth(x, previous.x);
      y = smooth(y, previous.y);
    }
    points.push({ time: sample.time, x, y, ...(sample.cut ? { cut: true } : {}) });
  }
  const warnings: string[] = [];
  if (missing)
    warnings.push(
      `Faces were not detected in ${Math.round((missing / samples.length) * 100)}% of sampled frames. Review those moments before exporting.`
    );
  if (crowded)
    warnings.push(
      'Some people cannot fit together in this ratio. Auto follows a primary face; use manual regions for a split layout.'
    );
  return {
    mode: 'manual',
    targetAspectRatio: ratio,
    sourceAspectRatio: `${sourceWidth}:${sourceHeight}`,
    sourceFrameMode: 'none',
    autoFraming: { version: 1, reviewed: false, sourceKey, warnings },
    regions: [
      {
        id: 'auto-subject',
        color: '#4F9DFF',
        label: 'Auto subject',
        displayNumber: 1,
        source: { x: points[0].x, y: points[0].y, width: cropWidth, height: cropHeight },
        sourceKeyframes: points,
        output: { x: 0, y: 0, width: 1, height: 1 },
        aspectRatioLocked: true,
      },
    ],
  };
}
