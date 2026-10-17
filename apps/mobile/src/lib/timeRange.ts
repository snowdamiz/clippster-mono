/** Format seconds as m:ss or h:mm:ss for download UI. */
export function formatClockTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export interface TimeRange {
  startTime: number;
  endTime: number;
}

/** Accept a clock value without silently rolling invalid minutes or seconds. */
export function parseClockTime(value: string): number | null {
  const parts = value.trim().split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some(part => !/^\d{1,3}$/.test(part))) return null;
  const numbers = parts.map(Number);
  if (numbers[numbers.length - 1] >= 60 || (numbers.length === 3 && numbers[1] >= 60)) return null;
  return numbers.reduce((seconds, part) => seconds * 60 + part, 0);
}

export function isFullStreamRange(range: TimeRange, totalDuration: number): boolean {
  if (totalDuration <= 0) return true;
  const tolerance = 2;
  return range.startTime <= tolerance && range.endTime >= totalDuration - tolerance;
}

export function rangeDuration(range: TimeRange): number {
  return Math.max(0, range.endTime - range.startTime);
}

export function buildSegmentJobs(
  range: TimeRange,
  partDurationSeconds: number,
): TimeRange[] {
  if (partDurationSeconds <= 0) return [range];
  const segments: TimeRange[] = [];
  let start = range.startTime;
  while (start < range.endTime) {
    const end = Math.min(start + partDurationSeconds, range.endTime);
    segments.push({ startTime: start, endTime: end });
    start = end;
  }
  return segments;
}
