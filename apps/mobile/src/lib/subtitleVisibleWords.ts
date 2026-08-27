import type { WordInfo } from '@clippster/shared-types';

export interface SubtitleTimingSegment {
  start: number;
  end: number;
  words?: WordInfo[];
  text?: string;
}

export function maxWordsChunkForAspectRatioString(
  targetAspectRatio: string,
  animationStyle?: string,
): number {
  const [w, h] = targetAspectRatio.split(':').map(Number);
  const aspectRatioValue = (w || 16) / (h || 9);
  if (aspectRatioValue > 1.5) return 6;
  if (aspectRatioValue > 0.9) return 4;
  if (
    animationStyle === 'karaoke' ||
    animationStyle === 'zoom' ||
    animationStyle === 'pop' ||
    animationStyle === 'glow' ||
    animationStyle === 'box-highlight' ||
    animationStyle === 'wave'
  ) {
    return 2;
  }
  return 3;
}

export function getVisibleWordsAtTime(
  words: WordInfo[],
  currentTime: number,
  maxWords: number,
): WordInfo[] {
  if (words.length === 0) return [];

  const activeIndex = words.findIndex((w) => currentTime >= w.start && currentTime < w.end);
  if (activeIndex === -1) {
    const upcoming = words.find((w) => w.start > currentTime);
    if (!upcoming) return [];
    const idx = words.indexOf(upcoming);
    return words.slice(idx, idx + maxWords);
  }

  const chunkStart = Math.floor(activeIndex / maxWords) * maxWords;
  return words.slice(chunkStart, chunkStart + maxWords);
}

export function transcriptWordsFromRaw(rawJson: string | null | undefined): WordInfo[] {
  if (!rawJson) return [];
  try {
    const parsed = JSON.parse(rawJson);
    const words: WordInfo[] =
      parsed.words ??
      parsed.segments?.flatMap((s: { words?: WordInfo[] }) => s.words ?? []) ??
      [];
    return words.filter((w) => typeof w.word === 'string' && w.word.trim().length > 0);
  } catch {
    return [];
  }
}

export function transcriptWordsForClip(
  rawJson: string,
  clipStart: number,
  clipEnd: number,
): WordInfo[] {
  try {
    const parsed = JSON.parse(rawJson);
    const words: WordInfo[] =
      parsed.words ??
      parsed.segments?.flatMap((s: { words?: WordInfo[] }) => s.words ?? []) ??
      [];
    return words
      .filter((w) => w.end > clipStart && w.start < clipEnd)
      .map((w) => ({
        ...w,
        start: Math.max(0, w.start - clipStart),
        end: Math.min(clipEnd - clipStart, w.end - clipStart),
      }));
  } catch {
    return [];
  }
}
