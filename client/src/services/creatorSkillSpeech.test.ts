import { describe, expect, it } from 'vitest';
import { speechForCreatorSkillClip, wordSpeechForCreatorSkillClip } from './creatorSkillSpeech';

describe('creator skill detection speech', () => {
  it('rebases words across ordered source ranges without including skipped speech', () => {
    const transcript = JSON.stringify({ words: [
      { word: 'one', start: 10, end: 10.4 },
      { word: 'two', start: 10.5, end: 10.8 },
      { word: 'skip', start: 12, end: 12.4 },
      { word: 'three', start: 20, end: 20.5 },
    ] });
    const speech = speechForCreatorSkillClip(transcript, [{ start: 10, end: 11 }, { start: 20, end: 21 }]);
    expect(speech.map((turn) => turn.text)).toEqual(['one two', 'three']);
    expect(speech[0].start).toBeCloseTo(0);
    expect(speech[0].end).toBeCloseTo(0.8);
    expect(speech[1]).toMatchObject({ start: 1, end: 1.5 });
    expect(wordSpeechForCreatorSkillClip(transcript, [{ start: 10, end: 11 }, { start: 20, end: 21 }]).map(word => word.text)).toEqual(['one', 'two', 'three']);
  });

  it('uses segment text when word timing is unavailable', () => {
    const speech = speechForCreatorSkillClip(JSON.stringify({ segments: [
      { text: 'hello there', start: 3, end: 4 },
    ] }), [{ start: 2, end: 5 }]);
    expect(speech).toMatchObject([{ start: 1, end: 2, text: 'hello there' }]);
    expect(wordSpeechForCreatorSkillClip(JSON.stringify({ segments: [{ text: 'hello there', start: 3, end: 4 }] }), [{ start: 2, end: 5 }])).toEqual([]);
  });

  it('rejects malformed transcript data', () => {
    expect(speechForCreatorSkillClip('null', [{ start: 0, end: 10 }])).toEqual([]);
  });
});
