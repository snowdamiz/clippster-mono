export { formatDuration } from '@/utils/timelineUtils';

/** Player clock with tenths: `0:07.5`, `1:00.0`. */
export function formatClock(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${(safe - minutes * 60).toFixed(1).padStart(4, '0')}`;
}

export function plural(count: number, word: string, pluralWord = `${word}s`): string {
  return `${count} ${count === 1 ? word : pluralWord}`;
}

/** `a`, `a and b`, `a, b and c`. */
export function listPhrase(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
