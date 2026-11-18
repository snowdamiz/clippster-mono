import { expect, it } from 'vitest';
import type { EditDocument } from '../ai-video/types';
import { auditCreatorSkillPresentation } from './creatorSkillPresentationAudit';

const document = {
  format: { width: 1920, height: 1080, fps: 30 },
  shots: [{ id: 'source', mediaId: 'source', duration: 18 }, { id: 'outro', mediaId: 'outro', duration: 2 }],
  overlays: [{ id: 'late-stat', lane: 'graphics', label: 'Final stat', start: 19, duration: .5 }, { id: 'captions', lane: 'captions', label: 'Captions', start: 0, duration: 20 }, { id: 'sponsor', lane: 'sponsor', label: 'Ad', start: 0, duration: 20 }],
} as EditDocument;

it('flags late visual changes while allowing captions and sponsor disclosure through the ending', () => {
  const issues = auditCreatorSkillPresentation(document, 'outro');
  expect(issues).toEqual(expect.arrayContaining([expect.stringContaining('begins in the final 1.5 seconds'), expect.stringContaining('less than 1.5 seconds')]));
  expect(issues).not.toEqual(expect.arrayContaining([expect.stringContaining('Captions'), expect.stringContaining('Ad')]));
});

it('requires the selected creator outro at the end', () => {
  const reordered = { ...document, shots: [...document.shots].reverse(), overlays: [] } as EditDocument;
  expect(auditCreatorSkillPresentation(reordered, 'outro')).toContain('The selected creator outro is not the final shot; place it over or after the real sign-off before publishing.');
});

it('requires a frame-one hook on vertical clips but not landscape clips', () => {
  const vertical = { ...document, format: { width: 1080, height: 1920, fps: 30 } } as EditDocument;
  expect(auditCreatorSkillPresentation(vertical)).toEqual(expect.arrayContaining([expect.stringContaining('hook title from frame 1')]));
  const withHook = { ...vertical, overlays: [...vertical.overlays, { id: 'hook', lane: 'graphics', label: 'Hook title', start: 0, duration: 2 }] } as EditDocument;
  expect(auditCreatorSkillPresentation(withHook)).not.toEqual(expect.arrayContaining([expect.stringContaining('hook title from frame 1')]));
  expect(auditCreatorSkillPresentation({ ...vertical, format: { width: 1920, height: 1080, fps: 30 } })).not.toEqual(expect.arrayContaining([expect.stringContaining('hook title from frame 1')]));
});

it('flags unreadably brief graphics and long-form visual gaps', () => {
  const long = { ...document, shots: [{ id: 'source', mediaId: 'source', duration: 24 }], overlays: [{ id: 'flash-card', lane: 'graphics', label: 'Fact card', start: 4, duration: .2 }] } as EditDocument;
  const issues = auditCreatorSkillPresentation(long);
  expect(issues).toEqual(expect.arrayContaining([
    expect.stringContaining('less than 0.5 seconds'),
    expect.stringContaining('No shot or editorial graphic changes'),
  ]));
});

it('flags short camera glimpses between editorial graphics', () => {
  const adjacent = { ...document, overlays: [
    { id: 'one', lane: 'graphics', start: 0, duration: 2, label: 'First graphic' },
    { id: 'two', lane: 'text', start: 2 + 5 / 30, duration: 2, label: 'Second graphic' },
  ] } as EditDocument;
  expect(auditCreatorSkillPresentation(adjacent)).toEqual(expect.arrayContaining([expect.stringContaining('5-frame gap')]));
});
