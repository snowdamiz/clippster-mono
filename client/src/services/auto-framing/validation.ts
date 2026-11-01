import type { ManualFramingConfigs } from '@/types';
import { normalizePathForCompare } from '@/utils/selfContainedClip';

export function assertReviewedAutoFraming(
  settings: {
    framingMode?: string;
    aspectRatios: string[];
    manualFramingConfigs?: ManualFramingConfigs;
  },
  path: string,
  segments: { start_time: number; end_time: number }[]
) {
  for (const ratio of settings.aspectRatios.filter((r) => r !== '16:9')) {
    const config = settings.manualFramingConfigs?.[ratio as keyof ManualFramingConfigs];
    const info = config?.autoFraming;
    if (settings.framingMode !== 'auto' && !info) continue;
    if (!info?.reviewed || config?.targetAspectRatio !== ratio)
      throw new Error(`Preview and apply Auto framing for ${ratio} before exporting.`);
    const source = info.sourceIdentity;
    if (
      !source ||
      normalizePathForCompare(source.path) !== normalizePathForCompare(path) ||
      source.ranges.length !== segments.length ||
      source.ranges.some(
        (r, i) =>
          Math.abs(r.start - segments[i].start_time) > 0.02 ||
          Math.abs(r.end - segments[i].end_time) > 0.02
      )
    ) {
      throw new Error(
        `The clip source or cuts changed. Reopen the ${ratio} framing preview before exporting.`
      );
    }
  }
}
