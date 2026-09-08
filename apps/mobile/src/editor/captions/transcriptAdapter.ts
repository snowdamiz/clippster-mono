import type { WordInfo } from '@clippster/shared-types';

import type { EditorIdFactory } from '../model/ids';
import {
  EDITOR_TICKS_PER_SECOND,
  secondsToTicks,
  type CaptionPhrase,
  type CaptionWord,
  type MobileEditProjectV3,
} from '../model/schema';
import { getVideoTrack } from '../model/timeline';

export interface TranscriptCaptionResult {
  words: CaptionWord[];
  phrases: CaptionPhrase[];
}

const MAX_WORDS_PER_PHRASE = 6;
const PHRASE_GAP_TICKS = Math.round(0.7 * EDITOR_TICKS_PER_SECOND);

export function mapTranscriptToEditorCaptions(
  document: MobileEditProjectV3,
  wordsBySourceUri: Record<string, WordInfo[]>,
  idFactory: EditorIdFactory,
): TranscriptCaptionResult {
  const words: CaptionWord[] = [];
  for (const item of getVideoTrack(document).items) {
    const asset = document.assets[item.assetId];
    if (!asset) continue;
    const sourceWords = wordsBySourceUri[asset.sourceUri] ?? [];
    for (const sourceWord of sourceWords) {
      const sourceStart = secondsToTicks(sourceWord.start);
      const sourceEnd = secondsToTicks(sourceWord.end);
      if (sourceEnd <= item.sourceStart || sourceStart >= item.sourceEnd) continue;
      const clippedStart = Math.max(item.sourceStart, sourceStart);
      const clippedEnd = Math.min(item.sourceEnd, sourceEnd);
      const start =
        item.timelineStart + Math.round((clippedStart - item.sourceStart) / item.speed);
      const end = Math.min(
        item.timelineEnd,
        item.timelineStart + Math.round((clippedEnd - item.sourceStart) / item.speed),
      );
      if (end <= start) continue;
      words.push({
        id: idFactory('caption_word'),
        word: sourceWord.word,
        start,
        end,
        confidence: sourceWord.confidence,
      });
    }
  }
  words.sort((left, right) => left.start - right.start);
  return { words, phrases: buildCaptionPhrases(words, idFactory) };
}

export function buildCaptionPhrases(
  words: CaptionWord[],
  idFactory: EditorIdFactory,
): CaptionPhrase[] {
  const phrases: CaptionPhrase[] = [];
  let group: CaptionWord[] = [];
  const flush = () => {
    if (group.length === 0) return;
    phrases.push({
      id: idFactory('caption_phrase'),
      wordIds: group.map((word) => word.id),
      start: group[0].start,
      end: group[group.length - 1].end,
    });
    group = [];
  };
  for (const word of words) {
    const previous = group[group.length - 1];
    if (
      group.length >= MAX_WORDS_PER_PHRASE ||
      (previous && word.start - previous.end > PHRASE_GAP_TICKS)
    ) {
      flush();
    }
    group.push(word);
  }
  flush();
  return phrases;
}
