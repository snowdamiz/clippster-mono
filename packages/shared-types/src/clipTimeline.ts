import type { ClipSegment, WordInfo } from './clip';
/** Map source timestamps into a clip's assembled playback clock. */
export function clipWords<T extends Pick<ClipSegment, 'start_time' | 'end_time'>>(words: WordInfo[], segments: T[]): WordInfo[] {
  const result: WordInfo[] = []; let offset = 0;
  for (const segment of [...segments].sort((a, b) => a.start_time - b.start_time)) {
    for (const word of words) if (word.end > segment.start_time && word.start < segment.end_time) result.push({ ...word, start: Math.max(word.start, segment.start_time) - segment.start_time + offset, end: Math.min(word.end, segment.end_time) - segment.start_time + offset });
    offset += segment.end_time - segment.start_time;
  }
  return result;
}
