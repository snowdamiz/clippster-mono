import type { ManualFramingConfig, ManualRegion, TargetAspectRatio } from '@clippster/shared-types';
import { TARGET_DIMENSIONS } from '@clippster/shared-types';

export interface FramingFilterInput {
  framingConfig: ManualFramingConfig | null;
  targetRatio: TargetAspectRatio;
  sourceWidth?: number;
  sourceHeight?: number;
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

function regionCropFilter(region: ManualRegion, inputLabel: string, index: number): string {
  const { source, output } = region;
  const cropLabel = `crop${index}`;
  const scaleLabel = `scaled${index}`;
  const overlayLabel = `ovl${index}`;

  const cropW = Math.max(1, Math.round(source.width * 1000)) / 1000;
  const cropH = Math.max(1, Math.round(source.height * 1000)) / 1000;
  const cropX = Math.max(0, Math.round(source.x * 1000)) / 1000;
  const cropY = Math.max(0, Math.round(source.y * 1000)) / 1000;

  const outW = Math.round(output.width * 1000) / 1000;
  const outH = Math.round(output.height * 1000) / 1000;
  const outX = Math.round(output.x * 1000) / 1000;
  const outY = Math.round(output.y * 1000) / 1000;

  return [
    `[${inputLabel}]crop=iw*${cropW}:ih*${cropH}:iw*${cropX}:ih*${cropY}[${cropLabel}]`,
    `[${cropLabel}]scale=iw*${outW / cropW}:ih*${outH / cropH}[${scaleLabel}]`,
    `[base][${scaleLabel}]overlay=main_w*${outX}:main_h*${outY}[${overlayLabel}]`,
  ].join(';');
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
    if (sourceRatio > targetRatioVal) {
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
  const filters: string[] = [`color=c=black:s=${width}x${height}:d=1[base]`];
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
      `[0:v]crop=iw*${cropW}:ih*${cropH}:iw*${cropX}:ih*${cropY}[${cropLabel}]`,
      `[${cropLabel}]scale=${outW}:${outH}[${scaleLabel}]`,
      `[${currentLabel}][${scaleLabel}]overlay=${outX}:${outY}[${overlayLabel}]`,
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
