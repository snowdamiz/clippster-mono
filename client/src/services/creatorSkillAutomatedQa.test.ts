import { expect, it } from 'vitest';
import type { EditDocument } from '../ai-video/types';
import { creatorSkillAutomatedQaBlockers } from './creatorSkillAutomatedQa';

const document = {
  format: { width: 1080, height: 1920, fps: 30 },
  shots: [{ id: 'source', mediaId: 'source', duration: 20 }],
  overlays: [{ id: 'hook', lane: 'graphics', label: 'Hook title', start: 0, duration: 2 }],
} as EditDocument;

it('blocks signoff for render defects but leaves editorial pacing for human review', () => {
  const input = {
    document, flashFindings: [] as string[], hasAudio: true, audioMeasured: true,
    integratedLufs: -14, truePeakDbtp: -1.2, renderedDuration: 20, expectedDuration: 20,
    renderedWidth: 1080, renderedHeight: 1920,
    streamDurationDeltaMs: 18, streamStartDeltaMs: 19,
  };
  expect(creatorSkillAutomatedQaBlockers(input)).toEqual([]);
  expect(creatorSkillAutomatedQaBlockers({ ...input, flashFindings: ['Brief flash at 3s'], integratedLufs: -20, truePeakDbtp: -.8, streamStartDeltaMs: 25 })).toEqual(expect.arrayContaining([
    'Brief flash at 3s',
    expect.stringContaining('outside the -14 ±2 LUFS target'),
    expect.stringContaining('above the -1 dBTP ceiling'),
    expect.stringContaining('start times differ by 25 ms'),
  ]));
  expect(creatorSkillAutomatedQaBlockers({ ...input, flashFindings: null })).toContain('Automated flash scan was unavailable.');
});
