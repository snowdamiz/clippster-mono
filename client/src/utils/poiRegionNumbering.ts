import type { ManualRegion } from '@/types';

/** Stable clip-wide region number used for labels (Region 1, Region 2, …). */
export function getRegionDisplayNumber(region: ManualRegion, fallbackIndex = 0): number {
  if (region.displayNumber != null && region.displayNumber > 0) {
    return region.displayNumber;
  }
  const fromLabel = region.label?.match(/^Region\s+(\d+)$/i);
  if (fromLabel) {
    return parseInt(fromLabel[1], 10);
  }
  return fallbackIndex + 1;
}

export function getRegionDisplayLabel(region: ManualRegion, fallbackIndex = 0): string {
  return region.label || `Region ${getRegionDisplayNumber(region, fallbackIndex)}`;
}

export function getNextRegionDisplayNumber(allRegionLists: ManualRegion[][]): number {
  let max = 0;
  for (const list of allRegionLists) {
    for (let i = 0; i < list.length; i++) {
      max = Math.max(max, getRegionDisplayNumber(list[i], i));
    }
  }
  return max + 1;
}

/** Assign displayNumber to legacy regions missing it (base first, then segments by start time). */
export function ensureGlobalDisplayNumbers(
  baseRegions: ManualRegion[],
  segmentConfigs: { startTime: number; regions: ManualRegion[] }[],
): void {
  let next = 1;
  const assign = (regions: ManualRegion[]) => {
    for (const region of regions) {
      if (region.displayNumber == null || region.displayNumber < 1) {
        region.displayNumber = next;
      }
      next = Math.max(next, region.displayNumber + 1);
    }
  };
  assign(baseRegions);
  const sorted = [...segmentConfigs].sort((a, b) => a.startTime - b.startTime);
  for (const seg of sorted) {
    assign(seg.regions);
  }
}
