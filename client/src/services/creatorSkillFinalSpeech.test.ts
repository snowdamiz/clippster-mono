import { expect, it } from 'vitest';
import { compareCreatorSkillFinalSpeech, creatorSkillFinalSpeechReport, creatorSkillFinalSpeechReview } from './creatorSkillFinalSpeech';
import { normalizeCreatorSkillTranscriptionWords } from '@clippster/shared-types';

it('compares final speech with source words in order and normalizes punctuation', () => {
  expect(compareCreatorSkillFinalSpeech(['Hello,', 'Pepsi', 'world!'], ['hello pepsi world'])).toMatchObject({ matchedWords: 3, missingWords: 0, matchPercent: 100 });
  expect(compareCreatorSkillFinalSpeech(['one', 'two', 'three'], ['one', 'three'])).toMatchObject({ matchedWords: 2, missingWords: 1, missingTokens: [{ index: 1, word: 'two' }], missingExamples: ['two'], matchPercent: 66.7 });
  const comparison = compareCreatorSkillFinalSpeech(['one', 'two'], ['one']);
  expect(creatorSkillFinalSpeechReview(comparison)).toContain('Review 1 unmatched source word');
  expect(creatorSkillFinalSpeechReport(comparison)).toContain('Source token 2: two');
  expect(compareCreatorSkillFinalSpeech(['one', 'three'], ['one', 'two', 'three'])).toMatchObject({ addedWords: 1, addedTokens: [{ index: 1, word: 'two' }] });
  expect(creatorSkillFinalSpeechReview(compareCreatorSkillFinalSpeech(['one'], ['one', 'extra']))).toContain('Review 1 unmatched rendered word');
  expect(creatorSkillFinalSpeechReport(compareCreatorSkillFinalSpeech(['one'], ['one', 'extra']))).toContain('Rendered token 2: extra');
});

it('accepts timed final words and rejects malformed transcription rows', () => {
  expect(normalizeCreatorSkillTranscriptionWords({ segments: [{ words: [{ word: 'hello', start: 0, end: 0.2 }, { word: 'bad', start: 5, end: 6 }] }] }, 1)).toEqual([{ word: 'hello', start: 0, end: 0.2 }]);
  expect(normalizeCreatorSkillTranscriptionWords({ words: 'invalid', segments: {} }, 1)).toEqual([]);
});
