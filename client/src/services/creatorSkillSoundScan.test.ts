import { expect, it } from 'vitest';
import { creatorSkillSoundScanReview } from './creatorSkillSoundScan';

it('records timestamped sound candidates without recommending a word cut', () => {
  const notes = creatorSkillSoundScanReview({ findings: [{ time: 12.345, label: 'Cough', score: 0.72 }], scannedSeconds: 30, analyzedWindows: 55, truncated: false }, true);
  expect(notes[0]).toContain('12.35s');
  expect(notes[0]).toContain('every spoken word stays intact');
});

it('records a completed scan with no candidates and flags truncation', () => {
  const notes = creatorSkillSoundScanReview({ findings: [], scannedSeconds: 1800, analyzedWindows: 3200, truncated: true }, true);
  expect(notes[0]).toContain('found no cough');
  expect(notes[1]).toContain('remaining audio');
  expect(creatorSkillSoundScanReview(null, false)).toEqual([]);
});
