import type { WhisperSegment, WordInfo } from '@/types';

/** Row in the subtitle transcript editor — one line per visible subtitle chunk or whole segment. */
export interface SubtitlePanelTranscriptRow {
  start: number;
  end: number;
  text: string;
  /** Index into project `whisperSegments` / raw JSON `segments` (stable for save). */
  whisperSegmentIndex: number;
  /** First index into `segment.words`; null = segment has no word timings (edit `segment.text`). */
  wordIndex: number | null;
  /** Last index into `segment.words`; null = segment has no word timings (edit `segment.text`). */
  wordEndIndex: number | null;
  /** VOD-absolute times (for syncing flat `words` during draft edits). */
  sourceStart: number;
  sourceEnd: number;
}

/**
 * One UI row per visible subtitle chunk when word timings exist; otherwise one row per overlapping Whisper segment.
 * Times are clip-relative [0, clipEnd - clipStart).
 */
export function flattenWhisperSegmentsForClipSubtitlePanel(
  segments: WhisperSegment[],
  clipStart: number,
  clipEnd: number,
  maxWordsPerRow = 6
): SubtitlePanelTranscriptRow[] {
  const rows: SubtitlePanelTranscriptRow[] = [];
  const clipLen = Math.max(0, clipEnd - clipStart);
  const chunkSize = Math.max(1, Math.floor(maxWordsPerRow));

  segments.forEach((seg, whisperSegmentIndex) => {
    if (seg.end <= clipStart || seg.start >= clipEnd) return;

    const words = seg.words;
    if (words && words.length > 0) {
      const overlappingWords = words
        .map((word: WordInfo, wordIndex: number) => ({ word, wordIndex }))
        .filter(({ word }) => word.end > clipStart && word.start < clipEnd);

      for (let i = 0; i < overlappingWords.length; i += chunkSize) {
        const chunk = overlappingWords.slice(i, i + chunkSize);
        const first = chunk[0];
        const last = chunk[chunk.length - 1];
        if (!first || !last) continue;

        rows.push({
          start: Math.max(0, first.word.start - clipStart),
          end: Math.min(clipLen, last.word.end - clipStart),
          text: chunk.map(({ word }) => word.word).join(' ').trim(),
          whisperSegmentIndex,
          wordIndex: first.wordIndex,
          wordEndIndex: last.wordIndex,
          sourceStart: first.word.start,
          sourceEnd: last.word.end,
        });
      }
    } else {
      const s = Math.max(seg.start, clipStart);
      const e = Math.min(seg.end, clipEnd);
      rows.push({
        start: s - clipStart,
        end: e - clipStart,
        text: (seg.text || '').trim(),
        whisperSegmentIndex,
        wordIndex: null,
        wordEndIndex: null,
        sourceStart: s,
        sourceEnd: e,
      });
    }
  });

  return rows.sort((a, b) => a.sourceStart - b.sourceStart || a.sourceEnd - b.sourceEnd);
}
