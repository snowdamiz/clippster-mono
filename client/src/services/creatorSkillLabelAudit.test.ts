import { describe, expect, it } from 'vitest';
import type { CreatorSkillPackage } from '@clippster/shared-types';
import type { EditDocument } from '../ai-video/types';
import { auditCreatorSkillLabels } from './creatorSkillLabelAudit';

const document = {
  format: { width: 1080, height: 1920, fps: 30 },
  shots: [
    { mediaId: 'source', sourceIn: 10, duration: 5, speed: 1 },
    { mediaId: 'source', sourceIn: 20, duration: 5, speed: 1 },
  ],
  overlays: [{ id: 'label', start: 6, duration: 2, label: 'Unconfirmed report', composition: 'compositions/label.html', variables: {} }],
} as EditDocument;
const item = { claims: [
  { time: 11, text: 'A claim', verdict: 'unconfirmed', onScreenLabel: 'Unconfirmed report' },
  { time: 21, text: 'Another claim', verdict: 'unconfirmed', onScreenLabel: 'Unconfirmed report' },
  { time: 30, text: 'Cut claim', verdict: 'unconfirmed', onScreenLabel: 'Unconfirmed report' },
] } as CreatorSkillPackage;

describe('creator skill label audit', () => {
  it('keeps opinion classification off screen while still requiring factual qualifiers', () => {
    expect(auditCreatorSkillLabels(document, 'source', { ...item, claims: [{ ...item.claims[0], verdict: 'opinion', onScreenLabel: 'Opinion, not real policy' }] })).toEqual([]);
    expect(auditCreatorSkillLabels(document, 'source', item)).toHaveLength(1);
  });
  it('maps source time across cuts and reports missing timed labels', () => {
    expect(auditCreatorSkillLabels(document, 'source', item)).toEqual([
      'No matching on-screen label for claim at source 11.0s (output 1.0s): Unconfirmed report.',
    ]);
  });

  it('requires a proposed label for spoken claims', () => {
    expect(auditCreatorSkillLabels(document, 'source', { ...item, claims: [{ ...item.claims[0], onScreenLabel: undefined }] })).toEqual([
      'Claim at 11.0s has no proposed on-screen label; add a neutral label or source card.',
    ]);
  });
});
