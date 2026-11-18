import { expect, it } from 'vitest';
import type { CreatorSkillPackage } from '@clippster/shared-types';
import { auditCreatorSkillEditorialPackage } from './creatorSkillEditorialAudit';

const item: CreatorSkillPackage = {
  funnel: { stage: 'trust', reason: 'Explains a sourced topic', metric: 'saves' },
  claims: [], sources: [], sponsors: [], brandReferences: [],
  footageReview: [{ start: 1, end: 15, show: 'Article', hide: ['account name'], note: 'Check crop.' }],
  thumbnailConcepts: ['VOD frame'], thumbnailHeadlines: ['WHAT HAPPENED', 'THE BIG SHIFT'],
  platformCopy: [{ platform: 'YouTube', title: 'Why This Company Changed Its Plan This Year', description: '0:00 The question\n0:40 What changed\n1:20 The outcome\n\n#Company #News #Analysis', tags: Array.from({ length: 20 }, (_, index) => `company topic ${index + 1}`), pinnedComment: 'What do you think?' }],
  reviewItems: [],
};

it('audits long-form copy and source crop ranges against the rendered clip', () => {
  expect(auditCreatorSkillEditorialPackage(item, 180, 180)).toEqual([]);
  const issues = auditCreatorSkillEditorialPackage({ ...item, footageReview: [{ ...item.footageReview![0], end: 200 }], platformCopy: [{ ...item.platformCopy[0], description: '0:05 Intro\n0:08 Next' }] }, 180, 180);
  expect(issues).toEqual(expect.arrayContaining([expect.stringContaining('three accurate chapters'), expect.stringContaining('beyond the source clip')]));
});

it('requires short-platform copy for a short clip', () => {
  expect(auditCreatorSkillEditorialPackage(item, 45, 45)).toContain('No Shorts posting copy was drafted for this clip.');
  expect(auditCreatorSkillEditorialPackage(item, 45, 15)).toEqual(expect.arrayContaining([expect.stringContaining('20-second minimum')]));
  expect(auditCreatorSkillEditorialPackage(item, 90, 90)).toEqual(expect.arrayContaining([expect.stringContaining('20–60 second stream Short')]));
  expect(auditCreatorSkillEditorialPackage(item, 800, 800)).toEqual(expect.arrayContaining([expect.stringContaining('2–12 minute playbook range')]));
});

it('flags upload copy that lacks tag and hashtag coverage or retains placeholders', () => {
  const copy = { ...item.platformCopy[0], description: 'A story with X% growth.', tags: ['company'] };
  const issues = auditCreatorSkillEditorialPackage({ ...item, platformCopy: [copy] }, 180, 180);
  expect(issues).toEqual(expect.arrayContaining([
    expect.stringContaining('20–30 relevant phrases'),
    expect.stringContaining('three relevant hashtags'),
    expect.stringContaining('placeholder text'),
  ]));
});

it('flags a long-form tag list beyond the upload limit', () => {
  const copy = { ...item.platformCopy[0], tags: Array.from({ length: 20 }, (_, index) => `very long search phrase for this company and its market topic ${index}`) };
  expect(auditCreatorSkillEditorialPackage({ ...item, platformCopy: [copy] }, 180, 180)).toEqual(expect.arrayContaining([expect.stringContaining('500-character upload limit')]));
});
