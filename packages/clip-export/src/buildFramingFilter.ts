import type { ManualFramingConfig, ManualRegion, TargetAspectRatio } from '@clippster/shared-types';
import { TARGET_DIMENSIONS } from '@clippster/shared-types';

export interface FramingFilterInput {
  framingConfig: ManualFramingConfig | null;
  targetRatio: TargetAspectRatio;
  sourceWidth?: number;
  sourceHeight?: number;
  fit?: 'cover' | 'contain';
}

export interface FramingFilterResult {
  filterComplex: string;
  outputLabel: string;
  width: number;
  height: number;
}

function ratioToValue(ratio: string): number {
  const [w, h] = ratio.split(':').map(Number);
  return (w || 16) / (h || 9);
}

export function getActiveRegionsForTime(
  config: ManualFramingConfig,
  clipRelativeTime: number,
): ManualRegion[] {
  const segmentConfigs = config.segmentConfigs ?? [];
  if (segmentConfigs.length === 0) {
    return config.regions;
  }

  const active = segmentConfigs.find(
    (seg) => clipRelativeTime >= seg.startTime && clipRelativeTime < seg.endTime,
  );
  return active?.regions ?? config.regions;
}

export function buildFramingFilterGraph(input: FramingFilterInput): FramingFilterResult | null {
  const { framingConfig, targetRatio } = input;
  const dims = TARGET_DIMENSIONS[targetRatio];
  const width = dims.width;
  const height = dims.height;

  if (!framingConfig || framingConfig.regions.length === 0) {
    const sourceRatio = ratioToValue(framingConfig?.sourceAspectRatio ?? '16:9');
    const targetRatioVal = ratioToValue(targetRatio);
    if (input.fit === 'cover' || (input.fit !== 'contain' && sourceRatio > targetRatioVal)) {
      return {
        filterComplex: `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}:(iw-${width})/2:(ih-${height})/2[framed]`,
        outputLabel: 'framed',
        width,
        height,
      };
    }
    return {
      filterComplex: `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black[framed]`,
      outputLabel: 'framed',
      width,
      height,
    };
  }

  const regions = framingConfig.regions;
  // Split the composed source explicitly: filtered output labels are single-use.
  // Derive the background from it as well to retain its full duration and frame rate.
  const filters: string[] = [
    `[0:v]split=${regions.length + 1}[base_source]${regions.map((_, index) => `[region_source${index}]`).join('')}`,
    `[base_source]scale=${width}:${height},setsar=1,drawbox=c=black:t=fill[base]`,
  ];
  let currentLabel = 'base';

  regions.forEach((region, index) => {
    const cropW = Math.max(0.01, region.source.width);
    const cropH = Math.max(0.01, region.source.height);
    const cropX = region.source.x;
    const cropY = region.source.y;
    const outX = Math.round(region.output.x * width);
    const outY = Math.round(region.output.y * height);
    const outW = Math.max(1, Math.round(region.output.width * width));
    const outH = Math.max(1, Math.round(region.output.height * height));

    const cropLabel = `crop${index}`;
    const scaleLabel = `scaled${index}`;
    const overlayLabel = index === regions.length - 1 ? 'framed' : `ovl${index}`;

    filters.push(
      `[region_source${index}]crop=iw*${cropW}:ih*${cropH}:iw*${cropX}:ih*${cropY}[${cropLabel}]`,
      `[${cropLabel}]scale=${outW}:${outH},setsar=1[${scaleLabel}]`,
      `[${currentLabel}][${scaleLabel}]overlay=${outX}:${outY}:shortest=1[${overlayLabel}]`,
    );
    currentLabel = overlayLabel;
  });

  return {
    filterComplex: filters.join(';'),
    outputLabel: 'framed',
    width,
    height,
  };
}
