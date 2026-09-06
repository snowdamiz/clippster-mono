import type { ManualFramingConfig, ManualRegion } from '@clippster/shared-types';

export function hasVisibleFraming(config: ManualFramingConfig | null | undefined): boolean {
  if (!config) return false;
  return (
    config.sourceFrameMode === 'use16x9' ||
    config.regions.length > 0 ||
    Boolean(config.segmentConfigs?.some((segment) => segment.regions.length > 0))
  );
}

export function getActiveFramingRegions(
  config: ManualFramingConfig,
  currentTime: number,
): { regions: ManualRegion[]; segmentIndex: number } {
  const segmentIndex =
    config.segmentConfigs?.findIndex(
      (segment) => currentTime >= segment.startTime && currentTime <= segment.endTime,
    ) ?? -1;
  return {
    regions:
      segmentIndex >= 0
        ? (config.segmentConfigs?.[segmentIndex]?.regions ?? [])
        : config.regions,
    segmentIndex,
  };
}

export function replaceActiveFramingRegions(
  config: ManualFramingConfig,
  segmentIndex: number,
  regions: ManualRegion[],
): ManualFramingConfig {
  if (segmentIndex < 0 || !config.segmentConfigs) {
    return { ...config, regions };
  }
  return {
    ...config,
    segmentConfigs: config.segmentConfigs.map((segment, index) =>
      index === segmentIndex ? { ...segment, regions } : segment,
    ),
  };
}
