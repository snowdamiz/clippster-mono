import { expect, it } from 'vitest';
import type { EditDocument } from '../ai-video/types';
import { auditCreatorSkillRemovedAudio, creatorSkillRemovedRanges } from './creatorSkillRemovedAudio';

const document = { shots: [
  { mediaId: 'source', scene: null, sourceIn: 0, duration: 2, speed: 1 },
  { mediaId: 'source', scene: null, sourceIn: 3, duration: 2, speed: 1 },
] } as EditDocument;

it('does not reject a partial-frame audio tail but still detects real cuts', () => {
  const clip = { format: { fps: 30 }, shots: [
    { mediaId: 'source', scene: null, sourceIn: 0, duration: 19.633, speed: 1 },
  ] } as EditDocument;
  expect(creatorSkillRemovedRanges(clip, 'source', 19.65)).toEqual([]);
  expect(creatorSkillRemovedRanges(clip, 'source', 19.8)).toEqual([{ start: 19.633, end: 19.8 }]);
  const cut = { ...clip, shots: [
    { ...clip.shots[0], duration: 10 },
    { ...clip.shots[0], sourceIn: 10.02, duration: 9.613 },
  ] };
  expect(creatorSkillRemovedRanges(cut, 'source', 19.65)).toEqual([{ start: 10, end: 10.02 }]);
});

it('identifies omitted source ranges after merging footage spans', () => {
  expect(creatorSkillRemovedRanges(document, 'source', 6)).toEqual([{ start: 2, end: 3 }, { start: 5, end: 6 }]);
});

it('accepts only removed ranges fully covered by measured silence', () => {
  const quiet = '[silencedetect] silence_start: 2\n[silencedetect] silence_end: 3 | silence_duration: 1\n[silencedetect] silence_start: 5\n[silencedetect] silence_end: 6 | silence_duration: 1';
  expect(auditCreatorSkillRemovedAudio(document, 'source', 6, quiet)).toEqual([]);
  expect(auditCreatorSkillRemovedAudio(document, 'source', 6, quiet.replace('silence_end: 3', 'silence_end: 2.6'))[0]).toContain('2.00-3.00s');
});
