import { expect, it } from 'vitest';
import type { CreatorSkillPackage } from '@clippster/shared-types';
import { finalizeCreatorSkillChapters } from './creatorSkillChapters';
import { auditCreatorSkillEditorialPackage } from './creatorSkillEditorialAudit';

const item = {
  funnel: { stage: 'trust', reason: 'Evidence', metric: 'saves' }, claims: [], sources: [], sponsors: [], thumbnailConcepts: [], thumbnailHeadlines: [], reviewItems: [],
  chapters: [{ time: 0, title: 'The opening question' }, { time: 55.9, title: 'What the report shows' }, { time: 120.1, title: 'The takeaway' }],
  platformCopy: [
    { platform: 'YouTube', title: 'What the report reveals about the latest news', description: 'A sourced discussion.\n\n0:00 Old start\n1:00 Old middle\n\nAd: Partner details', tags: [], pinnedComment: 'What changed your mind?' },
    { platform: 'YouTube Shorts', title: 'A short clip from the report and response', description: 'A short clip.', tags: [], pinnedComment: 'Thoughts?' },
  ],
} as CreatorSkillPackage;

it('uses proposed spoken sections with frame-safe final times and replaces stale description chapters', () => {
  const result = finalizeCreatorSkillChapters(item, 180);
  expect(result.item?.chapters?.map(chapter => chapter.time)).toEqual([0, 55, 120]);
  const long = result.item!.platformCopy[0].description;
  expect(long).toContain('0:00 The opening question\n0:55 What the report shows\n2:00 The takeaway');
  expect(long.indexOf('2:00 The takeaway')).toBeLessThan(long.indexOf('Ad: Partner details'));
  expect(long).not.toContain('Old middle');
  expect(result.item!.platformCopy[1].description).toBe('A short clip.');
  expect(auditCreatorSkillEditorialPackage(result.item, 180, 180)).not.toEqual(expect.arrayContaining([expect.stringContaining('three accurate chapters')]));
});

it('keeps invalid proposals out of posting copy for human correction', () => {
  const result = finalizeCreatorSkillChapters({ ...item, chapters: [{ time: 0, title: 'Start' }, { time: 9, title: 'Too close' }, { time: 178, title: 'Too late' }] }, 180);
  expect(result.item?.platformCopy[0].description).toContain('Old middle');
  expect(result.reviewItems[0]).toContain('three valid');
});

it('checks chapters already present in older long-form description drafts', () => {
  const result = finalizeCreatorSkillChapters({ ...item, chapters: [], platformCopy: [{ ...item.platformCopy[0], description: '0:00 Opening\n0:45 Evidence\n1:30 Takeaway' }] }, 150);
  expect(result.item?.chapters?.map(chapter => chapter.time)).toEqual([0, 45, 90]);
  expect(result.reviewItems[0]).toContain('Review each proposed chapter');
});
