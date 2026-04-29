import type { WhisperSegment, WordInfo } from '@/types';

/** Row in the subtitle transcript editor — one line per timed token or whole segment. */
export interface SubtitlePanelTranscriptRow {
  start: number;
  end: number;
  text: string;
  /** Index into project `whisperSegments` / raw JSON `segments` (stable for save). */
  whisperSegmentIndex: number;
  /** Index into `segment.words`; null = segment has no word timings (edit `segment.text`). */
  wordIndex: number | null;
  /** VOD-absolute times (for syncing flat `words` during draft edits). */
  sourceStart: number;
  sourceEnd: number;
}

/**
 * One UI row per word when word timings exist; otherwise one row per overlapping Whisper segment.
 * Times are clip-relative [0, clipEnd - clipStart).
 */
export function flattenWhisperSegmentsForClipSubtitlePanel(
  segments: WhisperSegment[],
  clipStart: number,
  clipEnd: number
): SubtitlePanelTranscriptRow[] {
  const rows: SubtitlePanelTranscriptRow[] = [];
  const clipLen = Math.max(0, clipEnd - clipStart);

  segments.forEach((seg, whisperSegmentIndex) => {
    if (seg.end <= clipStart || seg.start >= clipEnd) return;

    const words = seg.words;
    if (words && words.length > 0) {
      words.forEach((w: WordInfo, wordIndex: number) => {
        if (w.end <= clipStart || w.start >= clipEnd) return;
        rows.push({
          start: Math.max(0, w.start - clipStart),
          end: Math.min(clipLen, w.end - clipStart),
          text: w.word,
          whisperSegmentIndex,
          wordIndex,
          sourceStart: w.start,
          sourceEnd: w.end,
        });
      });
    } else {
      const s = Math.max(seg.start, clipStart);
      const e = Math.min(seg.end, clipEnd);
      rows.push({
        start: s - clipStart,
        end: e - clipStart,
        text: (seg.text || '').trim(),
        whisperSegmentIndex,
        wordIndex: null,
        sourceStart: s,
        sourceEnd: e,
      });
    }
  });

  return rows.sort((a, b) => a.sourceStart - b.sourceStart || a.sourceEnd - b.sourceEnd);
}
