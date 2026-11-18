import { describe, expect, it } from 'vitest';
import type { EditDocument } from '@/ai-video/types';
import { creatorSkillFinalSrt, draftCreatorSkillSrt } from './creatorSkillCaptions';

describe('creator skill draft captions', () => {
  it('moves source speech through the edited shot timing and omits cut speech', () => {
    const document = {
      shots: [
        { mediaId: null, scene: { label: 'Intro' }, duration: 2 },
        { mediaId: 'source', scene: null, sourceIn: 10, duration: 4, speed: 2 },
      ],
    } as EditDocument;
    const result = draftCreatorSkillSrt(document, 'source', [
      { start: 12, end: 14, text: 'A complete line', speakerId: null },
      { start: 17, end: 19, text: 'Crosses the cut', speakerId: null },
    ]);
    expect(result.content).toContain('00:00:03,000 --> 00:00:04,000');
    expect(result.content).toContain('A complete line');
    expect(result.content).not.toContain('Crosses the cut');
    expect(result.omitted).toBe(1);
  });
});

it('groups final-audio words into short cues and at most two landscape lines', () => {
  const words = Array.from({ length: 8 }, (_, index) => ({ word: `word${index + 1}`, start: index * 0.25, end: index * 0.25 + 0.2 }));
  expect(creatorSkillFinalSrt(words, '9:16')).toContain('word1 word2 word3');
  expect(creatorSkillFinalSrt(words, '9:16')).not.toContain('word1 word2 word3 word4');
  expect(creatorSkillFinalSrt(words, '16:9')).toContain('word1 word2 word3 word4\nword5 word6 word7 word8');
  expect(creatorSkillFinalSrt([{ word: 'fucking!', start: 0, end: 0.4 }], '9:16')).toContain('f******!');
  const longWords = [{ word: 'extraordinarily', start: 0, end: .2 }, { word: 'complicated', start: .25, end: .45 }, { word: 'announcement', start: .5, end: .7 }];
  expect(creatorSkillFinalSrt(longWords, '9:16')).not.toContain('extraordinarily complicated announcement');
});
