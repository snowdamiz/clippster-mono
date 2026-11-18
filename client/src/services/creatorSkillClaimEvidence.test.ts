import { expect, it } from 'vitest';
import type { CreatorSkillPackage } from '@clippster/shared-types';
import { creatorSkillClaimEvidence } from './creatorSkillClaimEvidence';

const item = { claims: [
  { time: 3, text: 'Pepsi reported revenue of $5.2B', sourceUrl: 'https://example.com/report' },
  { time: 9, text: 'Pepsi reported 50 billion cans', sourceUrl: 'https://example.com/report' },
  { time: 14, text: 'A private claim', sourceUrl: 'https://example.com/missing' },
] } as CreatorSkillPackage;

it('indexes a matching passage only from the cited captured page', () => {
  const evidence = creatorSkillClaimEvidence(item, [{ index: 2, url: 'https://example.com/report', text: 'Kind: source\nCaptured at: today\n\nPepsi reported revenue of $5.2B in the quarter.\nPepsi reported 500 billion cans in another report.' }]);
  expect(evidence).toHaveLength(1);
  expect(evidence[0]).toMatchObject({ claimIndex: 0, captureIndex: 2 });
  expect(evidence[0].excerpt).toContain('$5.2B');
});

it('does not turn a different number or missing page into candidate evidence', () => {
  expect(creatorSkillClaimEvidence(item, [{ index: 2, url: 'https://example.com/report', text: 'Kind: source\n\nPepsi reported revenue of $52B in the quarter.' }])).toEqual([]);
});
