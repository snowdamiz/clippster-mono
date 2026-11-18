import { expect, it } from 'vitest';
import type { CreatorSkillPackage } from '@clippster/shared-types';
import { creatorSkillCaptureDateIssues, creatorSkillPagePublishedDate } from './creatorSkillPageDate';

it('reads a valid page-advertised publication date regardless of meta attribute order', () => {
  expect(creatorSkillPagePublishedDate('<meta content="2026-11-02T16:30:00-08:00" property="article:published_time">')).toBe('2026-11-02');
  expect(creatorSkillPagePublishedDate('<meta itemprop="datePublished" content="2026/11/02">')).toBe('2026-11-02');
  expect(creatorSkillPagePublishedDate('<meta property="article:published_time" content="2026-02-30">')).toBeUndefined();
  expect(creatorSkillPagePublishedDate('<!-- <meta property="article:published_time" content="2026-11-02"> -->')).toBeUndefined();
});

it('flags an AI-proposed date that disagrees with the captured page', () => {
  const item = { claims: [{ time: 4, text: 'A claim', sourceUrl: 'https://example.com/article', publishedAt: '2026-11-01' }] } as CreatorSkillPackage;
  expect(creatorSkillCaptureDateIssues(item, 'https://example.com/article', '2026-11-02')[0]).toContain('proposed date 2026-11-01');
  expect(creatorSkillCaptureDateIssues(item, 'https://example.com/article', '2026-11-01')).toEqual([]);
});
