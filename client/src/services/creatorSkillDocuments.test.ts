import { expect, it } from 'vitest';
import { CREATOR_SKILL_DOCUMENT_NAMES, type CreatorSkillPackage } from '@clippster/shared-types';
import { creatorSkillDocuments } from './creatorSkillDocuments';

it('exports a dated claim kit and platform copy from the reconciled package', () => {
  const item: CreatorSkillPackage = {
    funnel: { stage: 'trust', reason: 'A sourced explanation', metric: 'saves' },
    claims: [{ time: 4.25, text: 'A figure', verdict: 'unconfirmed', sourceUrl: 'https://example.com/report', onScreenLabel: 'Unconfirmed' }],
    sources: [{ url: 'https://example.com/report', title: 'Report', retrievedAt: '2026-11-01' }],
    footageReview: [{ start: 3, end: 5, crop: { x: 0.1, y: 0.2, width: 0.6, height: 0.4 }, show: 'Dated article line', hide: ['account name'], note: 'Check transition frames.' }],
    sponsors: [], thumbnailConcepts: ['Use a source VOD frame'], thumbnailHeadlines: ['WHAT HAPPENED', 'THE BIG SHIFT'],
    platformCopy: [
      { platform: 'YouTube Shorts', title: 'A clip title', description: 'A description', tags: ['example'], pinnedComment: 'What did you notice?' },
      { platform: 'YouTube', title: 'A long title', description: '0:00 First point', tags: ['example'], pinnedComment: 'What do you think?' },
    ],
    reviewItems: ['Check the source page'],
  };
  const documents = creatorSkillDocuments(item, { selectedVersion: 'raw', durationSeconds: 42.35, availableFiles: ['Edited master MP4', 'Phone preview MP4'], reviewItems: ['Flash near 3.0s', 'Check the source page'], rawClipMd5: 'a'.repeat(32), masterMd5: 'b'.repeat(32), speechDiff: '# Final audio word comparison\n\nMatched 10/10 words.', soundScan: { scannedSeconds: 42.35, analyzedWindows: 80, truncated: false, findings: [{ time: 12.25, label: 'Cough', score: 0.72 }] }, creatorProfile: { name: 'Alex', preferences: { brand: { channelName: 'Alex Live' }, editing: { rules: ['No old photos'] }, sponsors: [{ name: 'Pepsi', disclosure: 'Paid promotion' }] } }, claimEvidence: [{ claimIndex: 0, captureIndex: 1, excerpt: 'The original report says a figure.', matchedTerms: 2 }] });
  expect(Object.keys(documents)).toEqual([...CREATOR_SKILL_DOCUMENT_NAMES]);
  expect(documents['creator.md']).toContain('Creator: Alex');
  expect(documents['creator.md']).toContain('No old photos');
  expect(documents['creator.md']).toContain('Pepsi | Referral URL: not supplied');
  expect(documents['sound-scan.md']).toContain('12.25s | Cough | score 0.72');
  expect(documents['sound-scan.md']).toContain(`Edited master MD5: ${'b'.repeat(32)}`);
  expect(documents['speech-diff.md']).toContain('Matched 10/10 words.');
  expect(documents['review-brief.md']).toContain('Independent review status: pending for current master.');
  expect(documents['footage.md']).toContain('Review status: pending human inspection.');
  expect(documents['footage.md']).toContain('Source 3.00–5.00s');
  expect(documents['footage.md']).toContain('Hide: account name');
  expect(documents['footage.md']).toContain('Human review: pending');
  expect(documents['claims.md']).toContain('4.3s: Unconfirmed');
  expect(documents['claims.md']).toContain('Candidate excerpt (not verified): The original report says a figure.');
  const dated = creatorSkillDocuments(item, { sourceCaptures: [{ index: 1, title: 'Report', url: 'https://example.com/report', fetchedAt: '2026-11-03T00:00:00Z', pagePublishedAt: '2026-11-02' }] });
  expect(dated['claims.md']).toContain('Captured page advertises date: 2026-11-02');
  expect(documents['claims.md']).toContain('date unconfirmed');
  expect(documents['shorts-copy.md']).toContain('Pinned comment: What did you notice?');
  expect(documents['shorts-copy.md']).toContain('Stage: trust');
  expect(documents['shorts-copy.md']).toContain('Metric to track: saves');
  expect(documents['shorts-copy.md']).toContain('YouTube: Includes paid promotion');
  expect(documents['shorts-copy.md']).toContain('Upload the final captions SRT');
  expect(documents['long-copy.md']).toContain('0:00 First point');
  expect(documents['long-copy.md']).toContain('YouTube Test & Compare');
  expect(documents['long-copy.md']).toContain('Stage: trust');
  expect(documents['long-copy.md']).not.toContain('A clip title');
  expect(documents['delivery-summary.md']).toContain('Funnel stage: trust');
  expect(documents['delivery-summary.md']).toContain('Selected workspace version: Raw');
  expect(documents['delivery-summary.md']).toContain('Length: 42.4 seconds');
  expect(documents['delivery-summary.md']).toContain('Phone preview MP4');
  expect(documents['delivery-summary.md']).toContain('Flash near 3.0s');
  expect(documents['delivery-summary.md']).toContain(`Raw extracted clip MD5: ${'a'.repeat(32)}`);
  expect(documents['delivery-summary.md']).toContain(`Edited master MD5: ${'b'.repeat(32)}`);
  expect(documents['delivery-summary.md'].match(/Check the source page/g)).toHaveLength(1);
  expect(documents['claims.md']).toContain('Human review: pending');
  const reviewed = creatorSkillDocuments({
    ...item,
    claimReviews: [{ claimIndex: 0, decision: 'source_checked', note: 'The source page supports this wording and date.', reviewedAt: '2026-11-02T00:00:00.000Z' }],
  });
  expect(reviewed['claims.md']).toContain('Human review: source checked');
  expect(reviewed['claims.md']).toContain('Review note: The source page supports this wording and date.');
  expect(reviewed['claims.md']).toContain('Verdict: UNCONFIRMED');
  expect(reviewed['creator.md']).toContain('No creator profile selected');
  expect(reviewed['creator.md']).toContain('brand mentions are not sponsor agreements');
});

it('flags a confirmed sponsor that is not allowed on the proposed platform', () => {
  const packageDraft: CreatorSkillPackage = {
    funnel: { stage: 'sponsor', reason: 'Sponsor read', metric: 'sign-ups' },
    claims: [], sources: [],
    sponsors: [{ name: 'Example', confirmed: true, platforms: ['YouTube'] }],
    thumbnailConcepts: [], thumbnailHeadlines: [],
    platformCopy: [{ platform: 'TikTok', title: 'A clip', description: 'A clip', tags: [], pinnedComment: 'What do you think?' }],
    reviewItems: [],
  };
  const copy = creatorSkillDocuments(packageDraft)['shorts-copy.md'];
  expect(copy).toContain('TikTok: Branded content');
  expect(copy).toContain('No confirmed sponsor is marked as allowed on this platform');
});
