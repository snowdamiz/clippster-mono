import type { WordInfo } from '@/types';

/** Minimal segment shape for timing (POI and DB payloads may omit `id`). */
export interface SubtitleTimingSegment {
  start: number;
  end: number;
  words?: WordInfo[];
  text?: string;
}

/** Words-per-line chunk sizing — matches VideoPlayer `maxWordsForAspectRatio`. */
export function maxWordsChunkForAspectRatioString(targetAspectRatio: string): number {
  const [w, h] = targetAspectRatio.split(':').map(Number);
  const aspectRatioValue = (w || 16) / (h || 9);
  if (aspectRatioValue > 1.5) return 6;
  if (aspectRatioValue > 0.9) return 4;
  return 3;
}

/** Build per-segment words the same way as VideoPlayer `segmentWords`. */
export function transcriptWordsForWhisperSegment(
  segment: SubtitleTimingSegment,
  transcriptWords: WordInfo[]
): WordInfo[] {
  if (transcriptWords.length > 0) {
    const filtered = transcriptWords.filter((word) => {
      return (
        (word.start >= segment.start && word.start < segment.end) ||
        (word.end > segment.start && word.end <= segment.end) ||
        (word.start <= segment.start && word.end >= segment.end)
      );
    });
    if (filtered.length > 0) return filtered;
  }

  const segWords = segment.words;
  if (segWords && Array.isArray(segWords) && segWords.length > 0) {
    const wordStart = segWords[0].start;
    const wordEnd = segWords[segWords.length - 1].end;
    const wordSpan = wordEnd - wordStart;
    const segSpan = segment.end - segment.start;
    const offset = segment.start - wordStart;
    const scale = wordSpan > 0 ? segSpan / wordSpan : 1;

    return segWords.map(
      (w): WordInfo => ({
        word: w.word,
        start:
          wordSpan > 0
            ? segment.start + (w.start - wordStart) * scale
            : segment.start + (w.start - wordStart) + offset,
        end:
          wordSpan > 0
            ? segment.start + (w.end - wordStart) * scale
            : segment.start + (w.end - wordStart) + offset,
        confidence: w.confidence,
      })
    );
  }

  return [];
}

/**
 * Single-word style: which token is "active" at time `t`.
 * - ASR often assigns very short intervals; `timeupdate` is sparse, so we extend each word's
 *   hit window to at least `minHitSec` and cap it so it never crosses the next word's start.
 * - No global "drop short words" rule — that was hiding real tokens.
 */
export function pickActiveSingleWordAtTime(
  words: WordInfo[],
  t: number,
  options?: { minHitSec?: number }
): WordInfo | null {
  if (words.length === 0) return null;
  const minHitSec = options?.minHitSec ?? 0.1;
  const eps = 1e-4;

  const sorted = [...words].sort((a, b) => a.start - b.start || a.end - b.end);

  for (let i = 0; i < sorted.length; i++) {
    const w = sorted[i];
    if (w.end <= w.start) continue;

    const next = sorted[i + 1];
    const nextStart = next ? next.start : Number.POSITIVE_INFINITY;
    const extendedEnd = Math.min(Math.max(w.end, w.start + minHitSec), nextStart - eps);

    if (t >= w.start && t < extendedEnd) {
      return w;
    }
  }
  return null;
}

/**
 * Which words to show at the current time — aligned with VideoPlayer subtitle logic
 * so POI preview stays consistent with playback and does not splash the whole transcript during gaps.
 */
export function getVisibleSubtitleWordsForClipTime(
  clipRelativeTime: number,
  transcriptWords: WordInfo[] | undefined,
  transcriptSegments: SubtitleTimingSegment[] | undefined,
  animationStyle: string | undefined,
  targetAspectRatio: string
): WordInfo[] {
  const words = transcriptWords ?? [];
  if (!words.length || !animationStyle) return [];

  const segs = transcriptSegments ?? [];
  if (!segs.length) return [];

  let segment: SubtitleTimingSegment | null = null;
  const t = clipRelativeTime;
  for (const seg of segs) {
    if (t >= seg.start && t <= seg.end) {
      segment = seg;
      break;
    }
  }
  if (!segment) return [];

  const allSegmentWords = transcriptWordsForWhisperSegment(segment, words);
  if (!allSegmentWords.length) return [];

  const maxWords = maxWordsChunkForAspectRatioString(targetAspectRatio);

  if (animationStyle === 'single-word') {
    const currentWord = pickActiveSingleWordAtTime(allSegmentWords, t);
    return currentWord ? [currentWord] : [];
  }

  if (allSegmentWords.length <= maxWords) {
    return allSegmentWords;
  }

  let currentWordIndex = -1;
  for (let i = 0; i < allSegmentWords.length; i++) {
    const word = allSegmentWords[i];
    if (t >= word.start && t < word.end) {
      currentWordIndex = i;
      break;
    }
  }

  if (currentWordIndex === -1) {
    for (let i = 0; i < allSegmentWords.length; i++) {
      if (allSegmentWords[i].start > t) {
        currentWordIndex = i;
        break;
      }
    }
  }

  if (currentWordIndex === -1) {
    currentWordIndex = 0;
  }

  const chunkIndex = Math.floor(currentWordIndex / maxWords);
  const startIndex = chunkIndex * maxWords;
  const endIndex = Math.min(startIndex + maxWords, allSegmentWords.length);
  return allSegmentWords.slice(startIndex, endIndex);
}
